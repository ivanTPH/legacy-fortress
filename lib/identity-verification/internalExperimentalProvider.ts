import crypto from "node:crypto";
import type {
  IdentityVerificationProvider,
  LivenessResult,
  ProviderDecisionInput,
  ProviderDocumentExtraction,
  ProviderFaceComparison,
  ProviderLivenessEvaluation,
  ProviderPresenceChallenge,
  ProviderStartInput,
  ProviderVerificationDecision,
} from "./types.ts";

export const INTERNAL_EXPERIMENTAL_PROVIDER_KEY = "lf_internal_experimental_v1";

const LEVEL_2_TTL_DAYS = 365;
const LEVEL_3_TTL_MINUTES = 10;

export class InternalExperimentalIdentityProvider implements IdentityVerificationProvider {
  readonly providerKey = INTERNAL_EXPERIMENTAL_PROVIDER_KEY;
  readonly providerLabel = "Legacy Fortress internal experimental provider";
  readonly experimental = true;

  async startVerification(input: ProviderStartInput) {
    return {
      providerReference: `lf-int-${input.purpose}-${crypto.randomUUID()}`,
      status: input.requestedIdentityLevel === 3 ? "camera_required" as const : "document_required" as const,
    };
  }

  async extractDocumentData(input: {
    fileName: string;
    mimeType: string;
    sha256Hash: string;
    sizeBytes: number;
  }): Promise<ProviderDocumentExtraction> {
    const lowerName = input.fileName.toLowerCase();
    const documentType = lowerName.includes("passport")
      ? "passport"
      : lowerName.includes("licence") || lowerName.includes("license")
        ? "driving_licence"
        : "unknown";
    const warnings: string[] = [];
    if (documentType === "unknown") warnings.push("document_type_uncertain");
    if (!["image/jpeg", "image/png", "application/pdf"].includes(input.mimeType)) warnings.push("unsupported_mime_type");
    if (input.sizeBytes < 24) warnings.push("document_too_small_for_processing");
    if (lowerName.includes("expired")) warnings.push("document_appears_expired");
    if (lowerName.includes("blur")) warnings.push("document_blur_warning");

    const failed = warnings.includes("unsupported_mime_type") || warnings.includes("document_too_small_for_processing");
    return {
      status: failed ? "failed" : "extracted",
      documentType,
      documentCountry: lowerName.includes("us") ? "US" : "GB",
      fields: {
        fullName: "Synthetic Legacy Fortress Claimant",
        dateOfBirth: "1990-01-01",
        expiryDate: lowerName.includes("expired") ? "2020-01-01" : "2035-01-01",
        documentNumberHash: hashValue(input.sha256Hash.slice(0, 16)),
      },
      confidence: warnings.length ? 0.68 : 0.93,
      warnings,
      portraitReference: failed ? null : "document_portrait_extracted",
    };
  }

  async capturePresenceChallenge(input: { requestedIdentityLevel: 2 | 3 }): Promise<ProviderPresenceChallenge> {
    return {
      challengeType: "active_camera_prompt",
      prompt: input.requestedIdentityLevel === 3
        ? "Align your face in the frame, look left, then capture for step-up presence."
        : "Align your face in the frame and capture a fresh selfie for 1:1 comparison.",
      nonce: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + LEVEL_3_TTL_MINUTES * 60_000).toISOString(),
    };
  }

  async evaluateLiveness(input: { captureHash: string; mimeType: string; sizeBytes: number }): Promise<ProviderLivenessEvaluation> {
    const reasonCodes: string[] = [];
    if (!input.mimeType.startsWith("image/")) reasonCodes.push("camera_capture_not_image");
    if (input.sizeBytes < 24) reasonCodes.push("camera_capture_too_small");
    if (input.captureHash.endsWith("0000")) reasonCodes.push("synthetic_liveness_low_confidence");
    const result: LivenessResult = reasonCodes.length ? "review_required" : "passed";
    return { result, confidence: result === "passed" ? 0.91 : 0.58, reasonCodes };
  }

  async compareFaces(input: { document: { extraction_warnings?: string[] | null } | null; captureHash: string }): Promise<ProviderFaceComparison> {
    const warnings = input.document?.extraction_warnings ?? [];
    const forcedMismatch = input.captureHash.includes("mismatch") || warnings.includes("document_appears_expired");
    const score = forcedMismatch ? 0.31 : warnings.length ? 0.72 : 0.89;
    const threshold = 0.82;
    return {
      score,
      threshold,
      passed: score >= threshold,
      reasonCodes: score >= threshold ? ["face_match_passed"] : ["face_match_below_threshold"],
    };
  }

  async completeVerification(input: ProviderDecisionInput): Promise<ProviderVerificationDecision> {
    const now = new Date();
    const reasonCodes = [
      ...(input.document?.extraction_warnings ?? []),
      ...(input.liveness?.reasonCodes ?? []),
      ...(input.comparison?.reasonCodes ?? []),
    ];
    const livenessPassed = input.liveness?.result === "passed";
    const facePassed = input.request.requested_identity_level === 3 || input.comparison?.passed === true;
    const documentUsable = input.request.requested_identity_level === 3 || input.document?.extraction_status === "extracted";
    const needsReview = reasonCodes.includes("document_appears_expired") || input.liveness?.result === "review_required" || input.comparison?.score === 0.72;
    const verified = documentUsable && livenessPassed && facePassed && !needsReview;
    const decision: ProviderVerificationDecision["decision"] = verified ? "verified" : needsReview ? "review_required" : "failed";
    const identityLevel = verified ? input.request.requested_identity_level as 2 | 3 : null;
    const expiresAt = identityLevel === 3
      ? new Date(now.getTime() + LEVEL_3_TTL_MINUTES * 60_000).toISOString()
      : identityLevel === 2
        ? new Date(now.getTime() + LEVEL_2_TTL_DAYS * 24 * 60 * 60_000).toISOString()
        : null;

    return {
      providerKey: this.providerKey,
      providerAssuranceClass: identityLevel === 3 ? "level_3_experimental_presence" : "level_2_experimental_document_face",
      decision,
      identityLevel,
      reasonCodes: reasonCodes.length ? reasonCodes : [verified ? "experimental_checks_passed" : "experimental_checks_failed"],
      requiresManualReview: decision === "review_required",
      faceMatchScore: input.comparison?.score ?? null,
      faceMatchThreshold: input.comparison?.threshold ?? null,
      livenessResult: input.liveness?.result ?? null,
      documentConfidence: input.document?.extraction_confidence ?? null,
      completedAt: now.toISOString(),
      expiresAt,
      evidenceReferences: {
        document_id: input.document?.id ?? null,
        challenge_id: input.challenge?.id ?? null,
        provider_reference: input.request.provider_reference,
      },
      retentionSummary: {
        decision_metadata_retained: true,
        raw_document_retention: "temporary_until_retention_cleanup",
        raw_camera_retention: "temporary_until_retention_cleanup",
        face_template_retained: false,
      },
    };
  }

  async getVerificationStatus(input: { request: { status: string } }) {
    return input.request.status as never;
  }

  async cancelVerification() {}

  async deleteProviderEvidence() {
    return {
      deleted: true,
      retained: { decision_metadata_retained: true, raw_biometric_templates_retained: false },
    };
  }
}

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
