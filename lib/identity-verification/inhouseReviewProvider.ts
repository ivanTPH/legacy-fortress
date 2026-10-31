import crypto from "node:crypto";
import type {
  IdentityVerificationProvider,
  ProviderDecisionInput,
  ProviderDocumentExtraction,
  ProviderFaceComparison,
  ProviderLivenessEvaluation,
  ProviderPresenceChallenge,
  ProviderStartInput,
  ProviderVerificationDecision,
} from "./types.ts";

/**
 * In-house identity check (owner-approved method, 30 Oct 2026; no third-party costs).
 * The person photographs their document and takes a live selfie while following a random prompt.
 * Nothing is decided automatically: a trained reviewer in Platform Admin compares the two and
 * approves or rejects. Approval gives identity level 2 for a year. It never gives access to records.
 * Level 3 (a fresh "it's you" check) is a separate one-time email code on top of level 2.
 */
export const INHOUSE_REVIEW_PROVIDER_KEY = "lf_inhouse_review_v1";
export const INHOUSE_LEVEL_2_TTL_DAYS = 365;
export const INHOUSE_EVIDENCE_RETENTION_DAYS = 14;
export const INHOUSE_CHALLENGE_MINUTES = 15;

const PROMPTS = [
  "Hold up two fingers next to your face",
  "Hold up three fingers next to your face",
  "Touch your nose with one finger",
  "Put one hand flat on top of your head",
  "Give a thumbs up next to your face",
  "Cover one eye with your hand",
];

export class InhouseReviewIdentityProvider implements IdentityVerificationProvider {
  readonly providerKey = INHOUSE_REVIEW_PROVIDER_KEY;
  readonly providerLabel = "Legacy Fortress reviewer check";
  readonly experimental = false;
  readonly mode = "commercial" as const;
  readonly capabilities = {
    documentCapture: true,
    documentAuthenticity: false,
    liveness: false,
    faceComparison: false,
    signedCallbacks: false,
    hostedCapture: false,
  } as const;

  async startVerification(input: ProviderStartInput) {
    if (input.requestedIdentityLevel !== 2) throw new Error("inhouse_review_level_2_only");
    return { providerReference: `lf-review-${crypto.randomUUID()}`, status: "document_required" as const };
  }

  async extractDocumentData(input: { mimeType: string; sizeBytes: number }): Promise<ProviderDocumentExtraction> {
    const warnings: string[] = [];
    if (!["image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf"].includes(input.mimeType)) warnings.push("unsupported_mime_type");
    if (input.sizeBytes < 1024) warnings.push("document_too_small_for_review");
    const failed = warnings.length > 0;
    // Nothing is read automatically: the reviewer looks at the photo.
    return { status: failed ? "failed" : "extracted", documentType: "unknown", documentCountry: null, fields: {}, confidence: 0, warnings, portraitReference: null };
  }

  async capturePresenceChallenge(): Promise<ProviderPresenceChallenge> {
    const prompt = PROMPTS[crypto.randomInt(PROMPTS.length)];
    return { challengeType: "active_camera_prompt", prompt, nonce: crypto.randomUUID(), expiresAt: new Date(Date.now() + INHOUSE_CHALLENGE_MINUTES * 60_000).toISOString() };
  }

  async evaluateLiveness(input: { mimeType: string; sizeBytes: number }): Promise<ProviderLivenessEvaluation> {
    const reasonCodes = ["reviewer_checks_prompt"];
    if (!input.mimeType.startsWith("image/")) return { result: "failed", confidence: 0, reasonCodes: ["camera_capture_not_image"] };
    if (input.sizeBytes < 1024) return { result: "failed", confidence: 0, reasonCodes: ["camera_capture_too_small"] };
    return { result: "review_required", confidence: 0, reasonCodes };
  }

  async compareFaces(): Promise<ProviderFaceComparison> {
    return { score: 0, threshold: 0, passed: false, reasonCodes: ["reviewer_compares_faces"] };
  }

  async completeVerification(input: ProviderDecisionInput): Promise<ProviderVerificationDecision> {
    const now = new Date().toISOString();
    const usable = input.document?.extraction_status === "extracted" && input.liveness?.result === "review_required";
    return {
      providerKey: this.providerKey,
      providerAssuranceClass: "level_2_reviewer_document_selfie",
      decision: usable ? "review_required" : "failed",
      identityLevel: null,
      reasonCodes: usable ? ["awaiting_reviewer"] : [...(input.document?.extraction_warnings ?? []), ...(input.liveness?.reasonCodes ?? [])],
      requiresManualReview: usable,
      faceMatchScore: null,
      faceMatchThreshold: null,
      livenessResult: input.liveness?.result ?? null,
      documentConfidence: null,
      completedAt: now,
      expiresAt: null,
      evidenceReferences: { document_id: input.document?.id ?? null, challenge_id: input.challenge?.id ?? null, provider_reference: input.request.provider_reference },
      retentionSummary: { raw_document_retention: "until_review_decision", raw_camera_retention: "until_review_decision", face_template_retained: false },
    };
  }

  async getVerificationStatus(input: { request: { status: string } }) {
    return input.request.status as never;
  }

  async cancelVerification() {}

  async deleteProviderEvidence() {
    return { deleted: true, retained: { decision_metadata_retained: true, raw_biometric_templates_retained: false } };
  }
}
