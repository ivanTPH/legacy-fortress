import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Server-side face analysis for the in-house ID check (owner decision 31 Oct 2026):
 * a live selfie with head movement is compared with the photo on the document. Runs on our own
 * server with open-source models (@vladmandic/human, MIT; TensorFlow.js WASM backend), so there is
 * no per-check cost. Nothing is kept: embeddings live only in memory for one comparison.
 *
 * Scores are similarities, not probabilities. Thresholds are deliberately strict: anything that
 * isn't clearly the same live person goes to a human reviewer.
 */

type HumanInstance = {
  load(): Promise<void>;
  detect(input: unknown): Promise<{ face: Array<{ embedding?: number[]; real?: number; live?: number; score: number; boxScore: number; box: [number, number, number, number]; rotation?: { angle: { yaw: number; pitch: number; roll: number } } }> }>;
  match: { similarity(a: number[], b: number[], options?: Record<string, unknown>): number };
  tf: { tensor3d(values: Uint8Array, shape: [number, number, number], dtype?: string): { dispose(): void } };
};

export const FACE_THRESHOLDS = {
  /** Selfie vs document photo: clear match for automatic verification. */
  autoVerifySimilarity: Number(process.env.IDV_AUTO_VERIFY_SIMILARITY ?? 0.62),
  /** Frames of the same live session must clearly be one person. */
  sameSessionSimilarity: Number(process.env.IDV_SAME_SESSION_SIMILARITY ?? 0.6),
  /** Anti-spoofing and liveness model scores (0–1). */
  minReal: Number(process.env.IDV_MIN_REAL ?? 0.6),
  minLive: Number(process.env.IDV_MIN_LIVE ?? 0.6),
  /** Head turn needed for the motion steps, in radians (about 12°). */
  minYaw: 0.2,
};

let humanPromise: Promise<HumanInstance> | null = null;

function root() {
  return process.cwd();
}

async function getHuman(): Promise<HumanInstance> {
  if (humanPromise) return humanPromise;
  humanPromise = (async () => {
    // Model and WASM files are read from node_modules; the Node WASM build fetches them, so
    // answer file:// fetches from disk.
    const nativeFetch = globalThis.fetch;
    if (!(globalThis as { __lfFileFetch?: boolean }).__lfFileFetch) {
      (globalThis as { __lfFileFetch?: boolean }).__lfFileFetch = true;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith("file://")) {
          const buffer = fs.readFileSync(new URL(url));
          return new Response(buffer, { status: 200, headers: { "content-type": url.endsWith(".json") ? "application/json" : url.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" } });
        }
        return nativeFetch(input, init);
      }) as typeof fetch;
    }
    const require = createRequire(path.join(root(), "package.json"));
    const humanModule = require(path.join(root(), "node_modules/@vladmandic/human/dist/human.node-wasm.js")) as { Human?: new (config: unknown) => HumanInstance; default?: new (config: unknown) => HumanInstance };
    const Human = humanModule.Human ?? humanModule.default;
    if (!Human) throw new Error("face_analysis_unavailable");
    const human = new Human({
      backend: "wasm",
      wasmPath: `file://${path.join(root(), "node_modules/@tensorflow/tfjs-backend-wasm/dist")}/`,
      modelBasePath: `file://${path.join(root(), "node_modules/@vladmandic/human/models")}/`,
      debug: false,
      cacheSensitivity: 0,
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 3, minConfidence: 0.5 },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
      },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
    });
    await human.load();
    return human;
  })();
  humanPromise.catch(() => { humanPromise = null; });
  return humanPromise;
}

export type FaceReading = {
  faces: number;
  embedding: number[] | null;
  real: number | null;
  live: number | null;
  yaw: number | null;
  confidence: number | null;
};

export async function readFace(image: Buffer): Promise<FaceReading> {
  const human = await getHuman();
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(image).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tensor = human.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
  try {
    const result = await human.detect(tensor);
    const faces = result.face.filter((face) => face.boxScore >= 0.5);
    // The largest face is the subject (documents can carry a small ghost image).
    const main = [...faces].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
    return {
      faces: faces.length,
      embedding: main?.embedding?.length ? main.embedding : null,
      real: typeof main?.real === "number" ? main.real : null,
      live: typeof main?.live === "number" ? main.live : null,
      yaw: typeof main?.rotation?.angle?.yaw === "number" ? main.rotation.angle.yaw : null,
      confidence: main ? main.score : null,
    };
  } finally {
    tensor.dispose();
  }
}

export async function similarity(a: number[], b: number[]) {
  const human = await getHuman();
  return human.match.similarity(a, b);
}

export type FaceAssessment = {
  outcome: "auto_verified" | "needs_review";
  reasons: string[];
  documentSelfieSimilarity: number | null;
  sessionSimilarity: number | null;
  real: number | null;
  live: number | null;
  motionPassed: boolean;
};

/**
 * Compare a document photo with a live session: the main selfie plus frames taken while the person
 * turned their head as asked. Automatic only when every check is clearly passed.
 */
export async function assessFaces(input: { document: Buffer; selfie: Buffer; frames: Array<{ direction: "left" | "right"; image: Buffer }> }): Promise<FaceAssessment> {
  const reasons: string[] = [];
  const [doc, selfie, ...frames] = await Promise.all([readFace(input.document), readFace(input.selfie), ...input.frames.map((frame) => readFace(frame.image))]);
  if (!doc.embedding) reasons.push("no_face_on_document");
  if (!selfie.embedding) reasons.push("no_face_in_selfie");
  if (selfie.faces > 1) reasons.push("more_than_one_face_in_selfie");
  const documentSelfieSimilarity = doc.embedding && selfie.embedding ? await similarity(doc.embedding, selfie.embedding) : null;
  if (documentSelfieSimilarity !== null && documentSelfieSimilarity < FACE_THRESHOLDS.autoVerifySimilarity) reasons.push("face_match_below_auto_threshold");

  // Motion: each frame must show the same person turned the way they were asked.
  let motionPassed = input.frames.length >= 2;
  let sessionSimilarity: number | null = null;
  for (let index = 0; index < input.frames.length; index += 1) {
    const reading = frames[index];
    const expected = input.frames[index].direction;
    if (!reading?.embedding || !selfie.embedding || reading.yaw === null || selfie.yaw === null) { motionPassed = false; continue; }
    const same = await similarity(selfie.embedding, reading.embedding);
    sessionSimilarity = sessionSimilarity === null ? same : Math.min(sessionSimilarity, same);
    const turned = reading.yaw - selfie.yaw;
    // Yaw sign depends on camera mirroring; require a clear turn and opposite directions for left/right.
    if (Math.abs(turned) < FACE_THRESHOLDS.minYaw) motionPassed = false;
    if (same < FACE_THRESHOLDS.sameSessionSimilarity) motionPassed = false;
    void expected;
  }
  if (input.frames.length >= 2 && motionPassed) {
    const yaws = input.frames.map((frame, index) => ({ direction: frame.direction, yaw: frames[index]?.yaw ?? 0 }));
    const left = yaws.find((item) => item.direction === "left");
    const right = yaws.find((item) => item.direction === "right");
    if (!left || !right || Math.sign(left.yaw - (selfie.yaw ?? 0)) === Math.sign(right.yaw - (selfie.yaw ?? 0))) motionPassed = false;
  }
  if (!motionPassed) reasons.push("motion_check_not_passed");
  if (selfie.real !== null && selfie.real < FACE_THRESHOLDS.minReal) reasons.push("antispoof_below_threshold");
  if (selfie.live !== null && selfie.live < FACE_THRESHOLDS.minLive) reasons.push("liveness_below_threshold");
  if (selfie.real === null || selfie.live === null) reasons.push("liveness_unavailable");

  return {
    outcome: reasons.length === 0 ? "auto_verified" : "needs_review",
    reasons,
    documentSelfieSimilarity,
    sessionSimilarity,
    real: selfie.real,
    live: selfie.live,
    motionPassed,
  };
}
