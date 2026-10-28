export function normalizeDocumentDisplayTitle(value: string | null | undefined, originalFileName: string) {
  const title = String(value ?? "").trim();
  if (!title || title === originalFileName.trim()) return null;
  if (title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)) {
    throw new Error("Document title must be 1–160 characters without control characters.");
  }
  return title;
}
