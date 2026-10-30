/**
 * In-house document text reader. Runs inside the Legacy Fortress server process only:
 * no document bytes or text are sent to any third party, written to disk, or logged.
 *
 * - Digital PDFs: text layer via pdf.js.
 * - Photos (JPEG/PNG) and scanned PDF pages without a text layer: OCR via tesseract.js
 *   with the English model bundled from node_modules (no network download).
 */
import path from "node:path";
import { createRequire } from "node:module";

export type DocumentPageText = { page: number; text: string; source: "pdf_text" | "ocr" };
export type DocumentKind = "pdf" | "png" | "jpeg";
export type ReadDocumentResult =
  | { ok: true; kind: DocumentKind; pages: DocumentPageText[]; truncated: boolean }
  | { ok: false; reason: "unsupported_type" | "too_large" | "unreadable" | "timeout" };

export const EXTRACTION_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxPdfPages: 30,
  maxOcrPages: 6,
  timeoutMs: 90_000,
};

/** Identify the file from its bytes, never from the browser-declared MIME type. */
export function detectDocumentKind(bytes: Uint8Array): DocumentKind | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  return null;
}

export async function readDocumentText(bytes: Uint8Array): Promise<ReadDocumentResult> {
  if (bytes.length === 0 || bytes.length > EXTRACTION_LIMITS.maxBytes) return { ok: false, reason: "too_large" };
  const kind = detectDocumentKind(bytes);
  if (!kind) return { ok: false, reason: "unsupported_type" };
  try {
    return await withTimeout(kind === "pdf" ? readPdf(bytes) : readImage(bytes, kind), EXTRACTION_LIMITS.timeoutMs);
  } catch (error) {
    if (error instanceof Error && error.message === "extraction_timeout") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "unreadable" };
  }
}

async function readImage(bytes: Uint8Array, kind: DocumentKind): Promise<ReadDocumentResult> {
  const text = await ocr([Buffer.from(bytes)]);
  return { ok: true, kind, pages: [{ page: 1, text: text[0] ?? "", source: "ocr" }], truncated: false };
}

async function readPdf(bytes: Uint8Array): Promise<ReadDocumentResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  try {
    const total = Math.min(doc.numPages, EXTRACTION_LIMITS.maxPdfPages);
    const pages: DocumentPageText[] = [];
    const needsOcr: number[] = [];
    for (let index = 1; index <= total; index += 1) {
      const page = await doc.getPage(index);
      const content = await page.getTextContent();
      const text = joinTextItems(content.items as Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>);
      pages.push({ page: index, text, source: "pdf_text" });
      if (text.replace(/\s/g, "").length < 20 && needsOcr.length < EXTRACTION_LIMITS.maxOcrPages) needsOcr.push(index);
      page.cleanup();
    }
    if (needsOcr.length) {
      const images: Buffer[] = [];
      for (const index of needsOcr) images.push(await renderPdfPage(doc, index));
      const texts = await ocr(images);
      needsOcr.forEach((index, position) => {
        const target = pages.find((item) => item.page === index);
        if (target && texts[position]) { target.text = texts[position]; target.source = "ocr"; }
      });
    }
    return { ok: true, kind: "pdf", pages, truncated: doc.numPages > total };
  } finally {
    await doc.destroy();
  }
}

/** Rebuild lines from pdf.js text items using their vertical position. */
function joinTextItems(items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>) {
  const lines: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];
  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const x = item.transform?.[4] ?? 0;
    const y = Math.round(item.transform?.[5] ?? 0);
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, text: item.str });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function renderPdfPage(doc: { getPage(n: number): Promise<unknown> }, index: number): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const page = await doc.getPage(index) as {
    getViewport(options: { scale: number }): { width: number; height: number };
    render(options: { canvasContext: unknown; viewport: unknown }): { promise: Promise<void> };
    cleanup(): void;
  };
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  page.cleanup();
  return canvas.toBuffer("image/png");
}

async function ocr(images: Buffer[]): Promise<string[]> {
  const { createWorker } = await import("tesseract.js");
  const require = createRequire(import.meta.url);
  const langPath = path.join(path.dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
  const worker = await createWorker("eng", 1, { langPath, gzip: true, cacheMethod: "none", logger: () => undefined, errorHandler: () => undefined });
  try {
    const results: string[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(image);
      results.push(data.text ?? "");
    }
    return results;
  } finally {
    await worker.terminate();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("extraction_timeout")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
