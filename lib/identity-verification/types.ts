export type IdentityVerificationPurpose =
  | "linked_access"
  | "registration_required"
  | "step_up_presence"
  | "admin_review";

export type IdentityVerificationStatus =
  | "draft"
  | "started"
  | "document_required"
  | "document_uploaded"
  | "document_processing"
  | "document_extracted"
  | "camera_required"
  | "camera_captured"
  | "comparison_processing"
  | "review_required"
  | "verified"
  | "failed"
  | "expired"
  | "cancelled";

export type IdentityVerificationDecision = "verified" | "failed" | "review_required";
export type IdentityDocumentSide = "front" | "back";
export type LivenessResult = "passed" | "failed" | "review_required";

export type IdentityVerificationRequestRow = {
  id: string;
  user_id: string;
  verification_purpose: IdentityVerificationPurpose;
  provider_key: string;
  provider_reference: string | null;
  status: IdentityVerificationStatus;
  requested_identity_level: number;
  achieved_identity_level: number | null;
  related_invitation_id: string | null;
  related_access_grant_id: string | null;
  attempt_count: number;
  manual_review_required: boolean;
  submitted_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  evidence_retention_until: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type IdentityVerificationDocumentRow = {
  id: string;
  request_id: string;
  user_id: string;
  document_side: IdentityDocumentSide;
  document_type: string | null;
  document_country: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash: string;
  extraction_status: "pending" | "processing" | "extracted" | "failed" | "deleted";
  extracted_fields: Record<string, unknown>;
  extraction_confidence: number | null;
  extraction_warnings: string[];
  portrait_reference: string | null;
};

export type IdentityPresenceChallengeRow = {
  id: string;
  request_id: string;
  user_id: string;
  challenge_type: string;
  challenge_prompt: string;
  status: "issued" | "captured" | "passed" | "failed" | "expired" | "cancelled";
  storage_bucket: string | null;
  storage_path: string | null;
  liveness_status: LivenessResult | null;
  liveness_confidence: number | null;
  issued_at: string;
  captured_at: string | null;
  expires_at: string;
  metadata: Record<string, unknown>;
};

export type ProviderStartInput = {
  userId: string;
  purpose: IdentityVerificationPurpose;
  requestedIdentityLevel: 2 | 3;
};

export type ProviderDocumentExtraction = {
  status: "extracted" | "failed";
  documentType: "passport" | "driving_licence" | "unknown";
  documentCountry: string | null;
  fields: {
    fullName?: string;
    dateOfBirth?: string;
    expiryDate?: string;
    documentNumberHash?: string;
  };
  confidence: number;
  warnings: string[];
  portraitReference?: string | null;
};

export type ProviderPresenceChallenge = {
  challengeType: "active_camera_prompt";
  prompt: string;
  nonce: string;
  expiresAt: string;
};

export type ProviderLivenessEvaluation = {
  result: LivenessResult;
  confidence: number;
  reasonCodes: string[];
};

export type ProviderFaceComparison = {
  score: number;
  threshold: number;
  passed: boolean;
  reasonCodes: string[];
};

export type ProviderDecisionInput = {
  request: IdentityVerificationRequestRow;
  document: IdentityVerificationDocumentRow | null;
  challenge: IdentityPresenceChallengeRow | null;
  liveness: ProviderLivenessEvaluation | null;
  comparison: ProviderFaceComparison | null;
};

export type ProviderVerificationDecision = {
  providerKey: string;
  providerAssuranceClass: string;
  decision: IdentityVerificationDecision;
  identityLevel: 2 | 3 | null;
  reasonCodes: string[];
  requiresManualReview: boolean;
  faceMatchScore: number | null;
  faceMatchThreshold: number | null;
  livenessResult: LivenessResult | null;
  documentConfidence: number | null;
  completedAt: string;
  expiresAt: string | null;
  evidenceReferences: Record<string, unknown>;
  retentionSummary: Record<string, unknown>;
};

export interface IdentityVerificationProvider {
  readonly providerKey: string;
  readonly providerLabel: string;
  readonly experimental: boolean;
  startVerification(input: ProviderStartInput): Promise<{ providerReference: string; status: IdentityVerificationStatus }>;
  extractDocumentData(input: { requestId: string; userId: string; fileName: string; mimeType: string; sha256Hash: string; sizeBytes: number }): Promise<ProviderDocumentExtraction>;
  capturePresenceChallenge(input: { requestId: string; userId: string; requestedIdentityLevel: 2 | 3 }): Promise<ProviderPresenceChallenge>;
  evaluateLiveness(input: { challenge: IdentityPresenceChallengeRow; captureHash: string; mimeType: string; sizeBytes: number }): Promise<ProviderLivenessEvaluation>;
  compareFaces(input: { document: IdentityVerificationDocumentRow | null; challenge: IdentityPresenceChallengeRow | null; captureHash: string }): Promise<ProviderFaceComparison>;
  completeVerification(input: ProviderDecisionInput): Promise<ProviderVerificationDecision>;
  getVerificationStatus(input: { request: IdentityVerificationRequestRow }): Promise<IdentityVerificationStatus>;
  cancelVerification(input: { requestId: string; userId: string }): Promise<void>;
  deleteProviderEvidence(input: { requestId: string; userId: string; evidenceReferences: Record<string, unknown> }): Promise<{ deleted: boolean; retained: Record<string, unknown> }>;
}
