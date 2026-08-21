import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InternalExperimentalIdentityProvider, INTERNAL_EXPERIMENTAL_PROVIDER_KEY } from "./internalExperimentalProvider.ts";
import type {
  IdentityPresenceChallengeRow,
  IdentityVerificationDecision,
  IdentityVerificationDocumentRow,
  IdentityVerificationProvider,
  IdentityVerificationPurpose,
  IdentityVerificationRequestRow,
  IdentityVerificationStatus,
} from "./types.ts";

type AnySupabaseClient = SupabaseClient;

export const IDENTITY_EVIDENCE_BUCKET = "identity-verification-evidence";
export const LEVEL_3_TTL_MINUTES = Number.parseInt(process.env.IDENTITY_LEVEL3_TTL_MINUTES ?? "10", 10) || 10;

export function getIdentityVerificationProvider(): IdentityVerificationProvider {
  if (!isInternalExperimentalProviderAllowed()) {
    throw new Error("identity_provider_not_enabled");
  }
  return new InternalExperimentalIdentityProvider();
}

export function isInternalExperimentalProviderAllowed() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "");
  return (
    process.env.IDENTITY_VERIFICATION_PROVIDER === INTERNAL_EXPERIMENTAL_PROVIDER_KEY
    || process.env.LEGACY_FORTRESS_ENV === "staging"
    || url.includes("supabase-test.mylegacyfortress.com")
    || url.includes("127.0.0.1")
    || url.includes("localhost")
    || appUrl.includes("test.mylegacyfortress.com")
  );
}

export async function startIdentityVerification(
  client: AnySupabaseClient,
  input: {
    userId: string;
    purpose: IdentityVerificationPurpose;
    requestedIdentityLevel: 2 | 3;
    invitationId?: string | null;
    accessGrantId?: string | null;
  },
) {
  const provider = getIdentityVerificationProvider();
  const started = await provider.startVerification(input);
  const now = new Date().toISOString();
  const insert = await client
    .from("identity_verification_requests")
    .insert({
      user_id: input.userId,
      verification_purpose: input.purpose,
      provider_key: provider.providerKey,
      provider_reference: started.providerReference,
      status: started.status,
      requested_identity_level: input.requestedIdentityLevel,
      related_invitation_id: input.invitationId ?? null,
      related_access_grant_id: input.accessGrantId ?? null,
      evidence_retention_until: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      metadata: {
        provider_experimental: provider.experimental,
        product_notice: "Internal experimental provider for controlled staging/UAT only.",
      },
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "verification_start_failed");
  const request = insert.data as IdentityVerificationRequestRow;
  await recordIdentityEvent(client, request.id, input.userId, "verification_started", "user", {
    purpose: input.purpose,
    requested_identity_level: input.requestedIdentityLevel,
    provider_key: provider.providerKey,
  });
  if (input.purpose === "linked_access") {
    await markLinkedAccessIdentityRequired(client, input.userId, input.accessGrantId ?? null);
  }
  return request;
}

export async function getOwnedVerificationRequest(client: AnySupabaseClient, requestId: string, userId: string) {
  const res = await client
    .from("identity_verification_requests")
    .select("*")
    .eq("id", requestId)
    .eq("user_id", userId)
    .single();
  if (res.error || !res.data) throw new Error(res.error?.message || "verification_request_not_found");
  return res.data as IdentityVerificationRequestRow;
}

export function validateEvidenceFile(file: File, kind: "document" | "camera") {
  const allowed = kind === "document"
    ? ["image/jpeg", "image/png", "application/pdf"]
    : ["image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) {
    throw new Error("unsupported_identity_evidence_type");
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("identity_evidence_size_invalid");
  }
}

export async function uploadDocumentEvidence(
  client: AnySupabaseClient,
  input: {
    userId: string;
    requestId: string;
    file: File;
    documentSide: "front" | "back";
  },
) {
  validateEvidenceFile(input.file, "document");
  const request = await getOwnedVerificationRequest(client, input.requestId, input.userId);
  assertTransition(request.status, ["document_required", "document_uploaded", "document_extracted", "started"]);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const hash = sha256(buffer);
  const ext = extensionForMime(input.file.type);
  const path = `users/${input.userId}/${input.requestId}/document-${input.documentSide}-${Date.now()}.${ext}`;
  const upload = await client.storage.from(IDENTITY_EVIDENCE_BUCKET).upload(path, buffer, {
    contentType: input.file.type,
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const provider = getIdentityVerificationProvider();
  const extraction = await provider.extractDocumentData({
    requestId: input.requestId,
    userId: input.userId,
    fileName: input.file.name,
    mimeType: input.file.type,
    sha256Hash: hash,
    sizeBytes: input.file.size,
  });
  const now = new Date().toISOString();
  const doc = await client
    .from("identity_verification_documents")
    .insert({
      request_id: input.requestId,
      user_id: input.userId,
      document_side: input.documentSide,
      document_type: extraction.documentType,
      document_country: extraction.documentCountry,
      storage_bucket: IDENTITY_EVIDENCE_BUCKET,
      storage_path: path,
      mime_type: input.file.type,
      size_bytes: input.file.size,
      sha256_hash: hash,
      extraction_status: extraction.status,
      extracted_fields: extraction.fields,
      extraction_confidence: extraction.confidence,
      extraction_warnings: extraction.warnings,
      portrait_reference: extraction.portraitReference ?? null,
      retention_until: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (doc.error || !doc.data) throw new Error(doc.error?.message || "document_record_failed");
  await client.from("identity_verification_requests").update({
    status: extraction.status === "extracted" ? "document_extracted" : "review_required",
    attempt_count: Number(request.attempt_count ?? 0) + 1,
    manual_review_required: extraction.status !== "extracted" || extraction.warnings.length > 0,
    submitted_at: now,
    updated_at: now,
  }).eq("id", input.requestId);
  await recordIdentityEvent(client, input.requestId, input.userId, extraction.status === "extracted" ? "document_processed" : "document_extraction_failed", "provider", {
    document_type: extraction.documentType,
    confidence: extraction.confidence,
    warning_count: extraction.warnings.length,
  });
  return doc.data as IdentityVerificationDocumentRow;
}

export async function createPresenceChallenge(client: AnySupabaseClient, requestId: string, userId: string) {
  const request = await getOwnedVerificationRequest(client, requestId, userId);
  assertTransition(request.status, ["document_extracted", "camera_required", "started"]);
  const provider = getIdentityVerificationProvider();
  const challenge = await provider.capturePresenceChallenge({
    requestId,
    userId,
    requestedIdentityLevel: request.requested_identity_level as 2 | 3,
  });
  const nonceHash = sha256(challenge.nonce);
  const insert = await client
    .from("identity_presence_challenges")
    .insert({
      request_id: requestId,
      user_id: userId,
      challenge_type: challenge.challengeType,
      challenge_prompt: challenge.prompt,
      challenge_nonce_hash: nonceHash,
      status: "issued",
      expires_at: challenge.expiresAt,
      metadata: { provider_key: provider.providerKey },
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "challenge_create_failed");
  await client.from("identity_verification_requests").update({ status: "camera_required", updated_at: new Date().toISOString() }).eq("id", requestId);
  await recordIdentityEvent(client, requestId, userId, "camera_started", "user", { challenge_type: challenge.challengeType });
  return { challenge: insert.data as IdentityPresenceChallengeRow, nonce: challenge.nonce };
}

export async function uploadCameraEvidence(
  client: AnySupabaseClient,
  input: { userId: string; requestId: string; challengeId: string; file: File },
) {
  validateEvidenceFile(input.file, "camera");
  const request = await getOwnedVerificationRequest(client, input.requestId, input.userId);
  assertTransition(request.status, ["camera_required", "camera_captured", "comparison_processing"]);
  const challengeRes = await client
    .from("identity_presence_challenges")
    .select("*")
    .eq("id", input.challengeId)
    .eq("request_id", input.requestId)
    .eq("user_id", input.userId)
    .single();
  if (challengeRes.error || !challengeRes.data) throw new Error(challengeRes.error?.message || "challenge_not_found");
  const challenge = challengeRes.data as IdentityPresenceChallengeRow;
  if (Date.parse(challenge.expires_at) <= Date.now()) throw new Error("presence_challenge_expired");
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const hash = syntheticCaptureHash(input.file.name, sha256(buffer));
  const ext = extensionForMime(input.file.type);
  const path = `users/${input.userId}/${input.requestId}/camera-${input.challengeId}.${ext}`;
  const upload = await client.storage.from(IDENTITY_EVIDENCE_BUCKET).upload(path, buffer, {
    contentType: input.file.type,
    upsert: true,
  });
  if (upload.error) throw new Error(upload.error.message);
  const provider = getIdentityVerificationProvider();
  const liveness = await provider.evaluateLiveness({
    challenge,
    captureHash: hash,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
  });
  const now = new Date().toISOString();
  await client.from("identity_presence_challenges").update({
    status: liveness.result === "passed" ? "passed" : "failed",
    storage_path: path,
    liveness_status: liveness.result,
    liveness_confidence: liveness.confidence,
    captured_at: now,
    retention_until: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    updated_at: now,
    metadata: { ...challenge.metadata, capture_hash: hash, liveness_reason_codes: liveness.reasonCodes },
  }).eq("id", input.challengeId);
  await client.from("identity_verification_requests").update({ status: "camera_captured", updated_at: now }).eq("id", input.requestId);
  await recordIdentityEvent(client, input.requestId, input.userId, "camera_captured", "user", { challenge_id: input.challengeId });
  await recordIdentityEvent(client, input.requestId, input.userId, liveness.result === "passed" ? "liveness_passed" : "liveness_failed", "provider", {
    confidence: liveness.confidence,
    reason_codes: liveness.reasonCodes,
  });
  return { captureHash: hash, liveness };
}

export async function completeIdentityVerification(client: AnySupabaseClient, requestId: string, userId: string) {
  const request = await getOwnedVerificationRequest(client, requestId, userId);
  assertTransition(request.status, ["camera_captured", "comparison_processing", "review_required"]);
  const document = await latestDocument(client, requestId, userId);
  const challenge = await latestChallenge(client, requestId, userId);
  const provider = getIdentityVerificationProvider();
  const captureHash = String(challenge?.metadata?.capture_hash ?? challenge?.id ?? "");
  const comparison = await provider.compareFaces({ document, challenge, captureHash });
  const liveness = {
    result: challenge?.liveness_status ?? "failed",
    confidence: Number(challenge?.liveness_confidence ?? 0),
    reasonCodes: Array.isArray(challenge?.metadata?.liveness_reason_codes) ? challenge.metadata.liveness_reason_codes as string[] : [],
  };
  const decision = await provider.completeVerification({
    request,
    document,
    challenge,
    liveness,
    comparison,
  });
  await persistDecision(client, request, decision);
  return decision;
}

export async function cleanupExpiredIdentityEvidence(client: AnySupabaseClient, userId: string, requestId: string) {
  const request = await getOwnedVerificationRequest(client, requestId, userId);
  const docs = await client.from("identity_verification_documents").select("id,storage_path").eq("request_id", requestId).eq("user_id", userId);
  const challenges = await client.from("identity_presence_challenges").select("id,storage_path").eq("request_id", requestId).eq("user_id", userId);
  const paths = [
    ...((docs.data ?? []) as Array<{ storage_path?: string | null }>).map((row) => row.storage_path),
    ...((challenges.data ?? []) as Array<{ storage_path?: string | null }>).map((row) => row.storage_path),
  ].filter(Boolean) as string[];
  if (paths.length) {
    await client.storage.from(IDENTITY_EVIDENCE_BUCKET).remove(paths);
  }
  await client.from("identity_verification_documents").update({ extraction_status: "deleted", updated_at: new Date().toISOString() }).eq("request_id", requestId).eq("user_id", userId);
  await recordIdentityEvent(client, requestId, userId, "evidence_deleted", "system", {
    deleted_object_count: paths.length,
    decision_metadata_retained: true,
    face_templates_retained: false,
  });
  return { deletedObjectCount: paths.length, requestStatus: request.status };
}

async function persistDecision(client: AnySupabaseClient, request: IdentityVerificationRequestRow, decision: Awaited<ReturnType<IdentityVerificationProvider["completeVerification"]>>) {
  const now = new Date().toISOString();
  await client.from("identity_verification_decisions").insert({
    request_id: request.id,
    user_id: request.user_id,
    provider_key: decision.providerKey,
    provider_assurance_class: decision.providerAssuranceClass,
    decision: decision.decision,
    decision_reason_codes: decision.reasonCodes,
    requested_identity_level: request.requested_identity_level,
    achieved_identity_level: decision.identityLevel,
    face_match_score: decision.faceMatchScore,
    face_match_threshold: decision.faceMatchThreshold,
    liveness_result: decision.livenessResult,
    document_confidence: decision.documentConfidence,
    requires_manual_review: decision.requiresManualReview,
    evidence_references: decision.evidenceReferences,
    retention_summary: decision.retentionSummary,
    decided_at: decision.completedAt,
  });
  await client.from("identity_verification_requests").update({
    status: decision.decision === "verified" ? "verified" : decision.decision,
    achieved_identity_level: decision.identityLevel,
    manual_review_required: decision.requiresManualReview,
    verified_at: decision.decision === "verified" ? decision.completedAt : null,
    expires_at: decision.expiresAt,
    updated_at: now,
  }).eq("id", request.id);

  await recordIdentityEvent(client, request.id, request.user_id, eventForDecision(decision.decision), "provider", {
    provider_key: decision.providerKey,
    requested_identity_level: request.requested_identity_level,
    achieved_identity_level: decision.identityLevel,
    reason_codes: decision.reasonCodes,
  });
  if (decision.faceMatchScore !== null && decision.faceMatchThreshold !== null) {
    await recordIdentityEvent(client, request.id, request.user_id, decision.faceMatchScore >= decision.faceMatchThreshold ? "face_match_passed" : "face_match_failed", "provider", {
      provider_key: decision.providerKey,
      score: decision.faceMatchScore,
      threshold: decision.faceMatchThreshold,
    });
  }

  if (decision.decision === "verified" && decision.identityLevel) {
    await upsertIdentityAssurance(client, request, decision);
    if (decision.identityLevel === 2) await activateEligibleLinkedAccess(client, request.user_id, request.related_access_grant_id);
  }
}

async function upsertIdentityAssurance(client: AnySupabaseClient, request: IdentityVerificationRequestRow, decision: Awaited<ReturnType<IdentityVerificationProvider["completeVerification"]>>) {
  const now = new Date().toISOString();
  await client.from("identity_assurance_states").upsert({
    user_id: request.user_id,
    identity_level: decision.identityLevel,
    provider_key: decision.providerKey,
    provider_assurance_class: decision.providerAssuranceClass,
    verified_at: decision.identityLevel === 2 ? decision.completedAt : now,
    presence_reverified_at: decision.identityLevel === 3 ? now : null,
    expires_at: decision.expiresAt,
    evidence_reference: request.provider_reference,
    metadata: {
      request_id: request.id,
      decision: decision.decision,
      reason_codes: decision.reasonCodes,
      experimental_provider: decision.providerKey === INTERNAL_EXPERIMENTAL_PROVIDER_KEY,
    },
    updated_at: now,
  }, { onConflict: "user_id" });
  await recordIdentityEvent(client, request.id, request.user_id, decision.identityLevel === 3 ? "presence_reverified" : "identity_level_changed", "system", {
    identity_level: decision.identityLevel,
    expires_at: decision.expiresAt,
  });
}

async function activateEligibleLinkedAccess(client: AnySupabaseClient, userId: string, accessGrantId: string | null) {
  let query = client
    .from("account_access_grants")
    .update({ activation_status: "verified", updated_at: new Date().toISOString() })
    .eq("linked_user_id", userId)
    .in("activation_status", ["accepted", "pending_verification", "identity_required", "verification_submitted"]);
  if (accessGrantId) query = query.eq("id", accessGrantId);
  await query;
  if (accessGrantId) {
    const grant = await client.from("account_access_grants").select("invitation_id").eq("id", accessGrantId).maybeSingle();
    if (grant.data?.invitation_id) {
      await client
        .from("role_assignments")
        .update({ activation_status: "verified", updated_at: new Date().toISOString() })
        .eq("invitation_id", grant.data.invitation_id)
        .in("activation_status", ["accepted", "pending_verification", "identity_required", "verification_submitted"]);
    }
  }
}

async function markLinkedAccessIdentityRequired(client: AnySupabaseClient, userId: string, accessGrantId: string | null) {
  let query = client
    .from("account_access_grants")
    .update({ activation_status: "identity_required", updated_at: new Date().toISOString() })
    .eq("linked_user_id", userId)
    .in("activation_status", ["accepted", "pending_verification", "verification_submitted"]);
  if (accessGrantId) query = query.eq("id", accessGrantId);
  await query;
}

async function latestDocument(client: AnySupabaseClient, requestId: string, userId: string) {
  const res = await client
    .from("identity_verification_documents")
    .select("*")
    .eq("request_id", requestId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (res.data ?? null) as IdentityVerificationDocumentRow | null;
}

async function latestChallenge(client: AnySupabaseClient, requestId: string, userId: string) {
  const res = await client
    .from("identity_presence_challenges")
    .select("*")
    .eq("request_id", requestId)
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (res.data ?? null) as IdentityPresenceChallengeRow | null;
}

export async function recordIdentityEvent(
  client: AnySupabaseClient,
  requestId: string | null,
  userId: string,
  eventType: string,
  actorType: "user" | "admin" | "system" | "provider",
  metadata: Record<string, unknown> = {},
) {
  await client.from("identity_verification_events").insert({
    request_id: requestId,
    user_id: userId,
    event_type: eventType,
    actor_user_id: actorType === "user" || actorType === "admin" ? userId : null,
    actor_type: actorType,
    provider_key: metadata.provider_key ?? INTERNAL_EXPERIMENTAL_PROVIDER_KEY,
    metadata: sanitizeIdentityMetadata(metadata),
  });
}

function sanitizeIdentityMetadata(metadata: Record<string, unknown>) {
  const blocked = new Set(["token", "jwt", "password", "signedUrl", "document_number", "raw_image", "face_template"]);
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
}

function assertTransition(status: IdentityVerificationStatus, allowed: IdentityVerificationStatus[]) {
  if (!allowed.includes(status)) {
    throw new Error(`invalid_identity_verification_transition:${status}`);
  }
}

function eventForDecision(decision: IdentityVerificationDecision) {
  if (decision === "verified") return "verification_verified";
  if (decision === "review_required") return "review_required";
  return "verification_failed";
}

function extensionForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "pdf";
}

function sha256(input: Buffer | string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function syntheticCaptureHash(fileName: string, hash: string) {
  const lower = fileName.toLowerCase();
  if (!isInternalExperimentalProviderAllowed()) return hash;
  if (lower.includes("mismatch")) return `mismatch-${hash}`;
  if (lower.includes("low-confidence")) return `${hash.slice(0, -4)}0000`;
  return hash;
}
