import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeathReportAction, DeathReportRow, EstateAccessClaimRow, EstateClaimAction, VaultLifecycleState } from "./types.ts";

type AnySupabaseClient = SupabaseClient;

export const ESTATE_EVIDENCE_BUCKET = "estate-administration-evidence";
const DEATH_REPORT_SELECT = "id,owner_user_id,claimant_user_id,claimant_role,relationship,status,date_of_death,declaration_accepted,claimant_identity_level,claimant_presence_verified_at,vault_state_at_report,related_probate_case_id,submitted_at,reviewed_at,reviewed_by_user_id,decision_reason,closed_at,metadata,created_at,updated_at";
const ESTATE_CLAIM_SELECT = "id,death_report_id,probate_case_id,owner_user_id,claimant_user_id,access_grant_id,role_claimed,status,required_identity_level,authority_evidence_status,permissions,approved_at,approved_by_user_id,suspended_at,revoked_at,decision_reason,metadata";

export function normalizeDeathReportAction(value: string | null | undefined): DeathReportAction | null {
  const action = String(value ?? "").trim().toLowerCase();
  if (["review", "apply_protective_lock", "confirm_death", "reject", "dispute", "start_owner_recovery", "approve_owner_recovery", "close"].includes(action)) {
    return action as DeathReportAction;
  }
  return null;
}

export function normalizeEstateClaimAction(value: string | null | undefined): EstateClaimAction | null {
  const action = String(value ?? "").trim().toLowerCase();
  if (["mark_identity_verified", "submit_authority", "approve", "reject", "suspend", "revoke"].includes(action)) return action as EstateClaimAction;
  return null;
}

export async function getVaultLifecycleState(client: AnySupabaseClient, ownerUserId: string) {
  const { data, error } = await client.rpc("lf_vault_lifecycle_state", { p_owner_user_id: ownerUserId });
  if (error) throw new Error(error.message);
  return String(data ?? "OWNER_ACTIVE") as VaultLifecycleState;
}

export async function getIdentityPresenceLevel(client: AnySupabaseClient, userId: string) {
  const { data, error } = await client.rpc("lf_identity_presence_level", { p_user_id: userId });
  if (error) throw new Error(error.message);
  return Number(data ?? 1);
}

export async function createDeathReport(
  client: AnySupabaseClient,
  input: {
    ownerUserId: string;
    claimantUserId: string;
    claimantRole: string;
    relationship?: string | null;
    dateOfDeath?: string | null;
    declarationAccepted: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  if (!input.declarationAccepted) throw new Error("death_report_declaration_required");
  if (input.ownerUserId === input.claimantUserId) throw new Error("owner_dispute_flow_required_for_self_report");
  const presenceLevel = await getIdentityPresenceLevel(client, input.claimantUserId);
  if (presenceLevel < 3) throw new Error("level_3_required_for_death_report");
  const vaultState = await getVaultLifecycleState(client, input.ownerUserId);
  const now = new Date().toISOString();
  const insert = await client
    .from("death_reports")
    .insert({
      owner_user_id: input.ownerUserId,
      claimant_user_id: input.claimantUserId,
      claimant_role: normalizeClaimantRole(input.claimantRole),
      relationship: input.relationship ?? null,
      status: "submitted",
      date_of_death: input.dateOfDeath ?? null,
      declaration_accepted: true,
      claimant_identity_level: presenceLevel,
      claimant_presence_verified_at: now,
      vault_state_at_report: vaultState,
      submitted_at: now,
      metadata: sanitizeEstateMetadata(input.metadata ?? {}),
      created_at: now,
      updated_at: now,
    })
    .select(DEATH_REPORT_SELECT)
    .single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "death_report_create_failed");
  const report = insert.data as DeathReportRow;
  await recordEstateEvent(client, {
    ownerUserId: report.owner_user_id,
    deathReportId: report.id,
    actorUserId: report.claimant_user_id,
    actorType: "claimant",
    eventType: "death_report_submitted",
    reason: "Claimant submitted death report with Level 3 presence.",
    metadata: { claimant_role: report.claimant_role, date_of_death_present: Boolean(report.date_of_death) },
  });
  return report;
}

export async function uploadDeathReportEvidence(
  client: AnySupabaseClient,
  input: {
    reportId: string;
    uploaderUserId: string;
    file: File;
    evidenceType: string;
  },
) {
  validateEstateEvidenceFile(input.file);
  const report = await getDeathReportForActor(client, input.reportId, input.uploaderUserId);
  if (!["submitted", "evidence_required", "under_review", "protective_lock_applied"].includes(report.status)) {
    throw new Error(`death_report_evidence_not_allowed:${report.status}`);
  }
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeName = sanitizeFileName(input.file.name);
  const path = `users/${input.uploaderUserId}/death-reports/${report.id}/${Date.now()}-${safeName}`;
  const upload = await client.storage.from(ESTATE_EVIDENCE_BUCKET).upload(path, buffer, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const insert = await client
    .from("death_report_evidence")
    .insert({
      death_report_id: report.id,
      owner_user_id: report.owner_user_id,
      uploaded_by_user_id: input.uploaderUserId,
      evidence_type: normalizeDeathEvidenceType(input.evidenceType),
      storage_bucket: ESTATE_EVIDENCE_BUCKET,
      storage_path: path,
      file_name: safeName,
      mime_type: input.file.type || "application/octet-stream",
      size_bytes: input.file.size,
      sha256_hash: sha256(buffer),
      provenance: {
        uploader_user_id: input.uploaderUserId,
        death_report_id: report.id,
        uploaded_at: new Date().toISOString(),
        source_context: "death_report",
      },
    })
    .select("id,storage_path")
    .single();
  if (insert.error || !insert.data) {
    await client.storage.from(ESTATE_EVIDENCE_BUCKET).remove([path]);
    throw new Error(insert.error?.message || "death_report_evidence_create_failed");
  }
  await recordEstateEvent(client, {
    ownerUserId: report.owner_user_id,
    deathReportId: report.id,
    actorUserId: input.uploaderUserId,
    actorType: "claimant",
    eventType: "death_evidence_uploaded",
    reason: "Death report evidence uploaded.",
    metadata: { evidence_type: normalizeDeathEvidenceType(input.evidenceType), file_name_present: true },
  });
  return insert.data as { id: string; storage_path: string };
}

export async function applyDeathReportAction(
  client: AnySupabaseClient,
  input: {
    reportId: string;
    action: DeathReportAction;
    actorUserId: string;
    actorType: "admin" | "owner" | "system";
    reason: string;
  },
) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("estate_action_reason_required");
  const report = await getDeathReport(client, input.reportId);
  await assertDeathReportActionAllowed(client, report, input.action, input.actorUserId);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { reviewed_at: now, reviewed_by_user_id: input.actorUserId, decision_reason: reason, updated_at: now };

  if (input.action === "review") update.status = "under_review";
  if (input.action === "apply_protective_lock") {
    await transitionVaultLifecycle(client, report.owner_user_id, "DEATH_REPORTED", input.actorUserId, reason, report.id, input.actorType);
    await transitionVaultLifecycle(client, report.owner_user_id, "PROTECTIVE_LOCK", input.actorUserId, reason, report.id, input.actorType);
    update.status = "protective_lock_applied";
  }
  if (input.action === "confirm_death") {
    await transitionVaultLifecycle(client, report.owner_user_id, "ESTATE_LOCKED", input.actorUserId, reason, report.id, input.actorType);
    update.status = "confirmed";
    update.closed_at = now;
  }
  if (input.action === "reject") {
    update.status = "rejected";
    update.closed_at = now;
  }
  if (input.action === "dispute") {
    await transitionVaultLifecycle(client, report.owner_user_id, "DEATH_STATUS_DISPUTED", input.actorUserId, reason, report.id, input.actorType);
    update.status = "disputed";
  }
  if (input.action === "start_owner_recovery") {
    if (input.actorType !== "owner") throw new Error("owner_actor_required_for_recovery");
    const presenceLevel = await getIdentityPresenceLevel(client, input.actorUserId);
    if (presenceLevel < 3) throw new Error("level_3_required_for_owner_recovery");
    await transitionVaultLifecycle(client, report.owner_user_id, "OWNER_RECOVERY", input.actorUserId, reason, report.id, input.actorType);
    update.status = "owner_recovery_required";
  }
  if (input.action === "approve_owner_recovery") {
    await transitionVaultLifecycle(client, report.owner_user_id, "OWNER_ACTIVE", input.actorUserId, reason, report.id, input.actorType);
    update.status = "closed";
    update.closed_at = now;
  }
  if (input.action === "close") {
    update.status = "closed";
    update.closed_at = now;
  }

  const result = await client.from("death_reports").update(update).eq("id", report.id).select(DEATH_REPORT_SELECT).single();
  if (result.error || !result.data) throw new Error(result.error?.message || "death_report_update_failed");
  await recordEstateEvent(client, {
    ownerUserId: report.owner_user_id,
    deathReportId: report.id,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    eventType: eventForDeathReportAction(input.action),
    reason,
    metadata: { action: input.action },
  });
  return result.data as DeathReportRow;
}

export async function createEstateClaimFromReport(
  client: AnySupabaseClient,
  input: {
    reportId: string;
    actorUserId: string;
    roleClaimed?: string | null;
  },
) {
  const report = await getDeathReportForActor(client, input.reportId, input.actorUserId);
  const level = await getIdentityPresenceLevel(client, input.actorUserId);
  const status = level >= 2 ? "identity_verified" : "identity_required";
  const insert = await client
    .from("estate_access_claims")
    .insert({
      death_report_id: report.id,
      owner_user_id: report.owner_user_id,
      claimant_user_id: input.actorUserId,
      role_claimed: input.roleClaimed ?? report.claimant_role,
      status,
      authority_evidence_status: "required",
      metadata: { source: "death_report", claimant_identity_level: level },
    })
    .select(ESTATE_CLAIM_SELECT)
    .single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "estate_claim_create_failed");
  await recordEstateEvent(client, {
    ownerUserId: report.owner_user_id,
    deathReportId: report.id,
    estateClaimId: insert.data.id,
    actorUserId: input.actorUserId,
    actorType: "claimant",
    eventType: "estate_claim_submitted",
    reason: "Estate claim submitted separately from death evidence.",
  });
  return insert.data as EstateAccessClaimRow;
}

export async function applyEstateClaimAction(
  client: AnySupabaseClient,
  input: {
    claimId: string;
    action: EstateClaimAction;
    actorUserId: string;
    reason: string;
    estateDocumentIds?: string[];
  },
) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("estate_action_reason_required");
  const claim = await getEstateClaim(client, input.claimId);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now, decision_reason: reason };
  const permissions = { ...(claim.permissions ?? {}) };
  if (input.estateDocumentIds?.length) permissions.estate_document_ids = input.estateDocumentIds;

  if (input.action === "mark_identity_verified") {
    const level = await getIdentityPresenceLevel(client, claim.claimant_user_id);
    if (level < 2) throw new Error("level_2_required_for_estate_claim");
    update.status = "identity_verified";
  }
  if (input.action === "submit_authority") {
    update.status = "authority_under_review";
    update.authority_evidence_status = "submitted";
  }
  if (input.action === "approve") {
    const level = await getIdentityPresenceLevel(client, claim.claimant_user_id);
    if (level < 2) throw new Error("level_2_required_for_estate_claim");
    update.status = "active";
    update.authority_evidence_status = "accepted";
    update.approved_at = now;
    update.approved_by_user_id = input.actorUserId;
    update.permissions = permissions;
  }
  if (input.action === "reject") {
    update.status = "rejected";
    update.authority_evidence_status = "rejected";
  }
  if (input.action === "suspend") {
    update.status = "suspended";
    update.suspended_at = now;
    update.suspended_by_user_id = input.actorUserId;
  }
  if (input.action === "revoke") {
    update.status = "revoked";
    update.revoked_at = now;
    update.revoked_by_user_id = input.actorUserId;
  }
  await assertEstateClaimActionAllowed(claim, input.action);
  const result = await client.from("estate_access_claims").update(update).eq("id", claim.id).select(ESTATE_CLAIM_SELECT).single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_claim_update_failed");
  await client.from("estate_access_decisions").insert({
    estate_claim_id: claim.id,
    owner_user_id: claim.owner_user_id,
    claimant_user_id: claim.claimant_user_id,
    decision: decisionForEstateClaimAction(input.action),
    decided_by_user_id: input.actorUserId,
    reason,
    permissions,
  });
  await recordEstateEvent(client, {
    ownerUserId: claim.owner_user_id,
    deathReportId: claim.death_report_id,
    estateClaimId: claim.id,
    actorUserId: input.actorUserId,
    actorType: "admin",
    eventType: eventForEstateClaimAction(input.action),
    reason,
    metadata: { action: input.action, estate_document_count: input.estateDocumentIds?.length ?? 0 },
  });
  return result.data as EstateAccessClaimRow;
}

export async function addEstateAdministrationDocument(
  client: AnySupabaseClient,
  input: {
    claimId: string;
    uploaderUserId: string;
    file: File;
    documentType: string;
  },
) {
  validateEstateEvidenceFile(input.file);
  const claim = await getEstateClaim(client, input.claimId);
  if (claim.claimant_user_id !== input.uploaderUserId || claim.status !== "active") {
    throw new Error("active_estate_claim_required_for_document");
  }
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeName = sanitizeFileName(input.file.name);
  const path = `users/${input.uploaderUserId}/estate-admin/${claim.owner_user_id}/${claim.id}/${Date.now()}-${safeName}`;
  const upload = await client.storage.from(ESTATE_EVIDENCE_BUCKET).upload(path, buffer, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);
  const insert = await client
    .from("estate_administration_documents")
    .insert({
      owner_user_id: claim.owner_user_id,
      death_report_id: claim.death_report_id,
      estate_claim_id: claim.id,
      probate_case_id: claim.probate_case_id,
      uploaded_by_user_id: input.uploaderUserId,
      document_type: normalizeEstateDocumentType(input.documentType),
      storage_bucket: ESTATE_EVIDENCE_BUCKET,
      storage_path: path,
      file_name: safeName,
      mime_type: input.file.type || "application/octet-stream",
      size_bytes: input.file.size,
      provenance: {
        uploader_user_id: input.uploaderUserId,
        estate_claim_id: claim.id,
        source_context: "estate_administration",
        uploaded_at: new Date().toISOString(),
      },
    })
    .select("id,storage_path,provenance")
    .single();
  if (insert.error || !insert.data) {
    await client.storage.from(ESTATE_EVIDENCE_BUCKET).remove([path]);
    throw new Error(insert.error?.message || "estate_document_create_failed");
  }
  await recordEstateEvent(client, {
    ownerUserId: claim.owner_user_id,
    deathReportId: claim.death_report_id,
    estateClaimId: claim.id,
    actorUserId: input.uploaderUserId,
    actorType: "claimant",
    eventType: "estate_document_added",
    reason: "Estate administration document added with provenance.",
    metadata: { document_type: normalizeEstateDocumentType(input.documentType) },
  });
  return insert.data as { id: string; storage_path: string; provenance: Record<string, unknown> };
}

export async function transitionVaultLifecycle(
  client: AnySupabaseClient,
  ownerUserId: string,
  toState: VaultLifecycleState,
  actorUserId: string,
  reason: string,
  deathReportId: string | null,
  actorType: "owner" | "claimant" | "admin" | "system",
) {
  const { data, error } = await client.rpc("lf_transition_vault_lifecycle", {
    p_owner_user_id: ownerUserId,
    p_to_state: toState,
    p_actor_user_id: actorUserId,
    p_reason: reason,
    p_death_report_id: deathReportId,
    p_context: { actor_type: actorType },
  });
  if (error) throw new Error(error.message);
  return String(data) as VaultLifecycleState;
}

export async function getDeathReport(client: AnySupabaseClient, reportId: string) {
  const res = await client.from("death_reports").select(DEATH_REPORT_SELECT).eq("id", reportId).single();
  if (res.error || !res.data) throw new Error(res.error?.message || "death_report_not_found");
  return res.data as DeathReportRow;
}

export async function getEstateClaim(client: AnySupabaseClient, claimId: string) {
  const res = await client.from("estate_access_claims").select(ESTATE_CLAIM_SELECT).eq("id", claimId).single();
  if (res.error || !res.data) throw new Error(res.error?.message || "estate_claim_not_found");
  return res.data as EstateAccessClaimRow;
}

export async function listDeathReportsForAdmin(client: AnySupabaseClient) {
  const res = await client.from("death_reports").select(DEATH_REPORT_SELECT).order("updated_at", { ascending: false }).limit(100);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as DeathReportRow[];
}

export async function listEstateClaimsForAdmin(client: AnySupabaseClient) {
  const res = await client.from("estate_access_claims").select(ESTATE_CLAIM_SELECT).order("updated_at", { ascending: false }).limit(100);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as EstateAccessClaimRow[];
}

async function getDeathReportForActor(client: AnySupabaseClient, reportId: string, actorUserId: string) {
  const report = await getDeathReport(client, reportId);
  if (report.claimant_user_id !== actorUserId && report.owner_user_id !== actorUserId) throw new Error("death_report_actor_mismatch");
  return report;
}

async function assertDeathReportActionAllowed(client: AnySupabaseClient, report: DeathReportRow, action: DeathReportAction, actorUserId: string) {
  const allowed: Record<string, DeathReportAction[]> = {
    draft: [],
    submitted: ["review", "apply_protective_lock", "reject"],
    evidence_required: ["review", "apply_protective_lock", "reject"],
    under_review: ["apply_protective_lock", "reject"],
    protective_lock_applied: ["confirm_death", "dispute"],
    confirmed: ["dispute", "close"],
    rejected: ["close"],
    disputed: ["start_owner_recovery"],
    cancelled: [],
    owner_recovery_required: ["approve_owner_recovery"],
    closed: [],
  };
  if (!allowed[report.status]?.includes(action)) throw new Error(`invalid_death_report_transition:${report.status}:${action}`);
  if (action === "start_owner_recovery" && actorUserId !== report.owner_user_id) throw new Error("owner_required_for_recovery");
  if (action === "approve_owner_recovery") {
    const level = await getIdentityPresenceLevel(client, report.owner_user_id);
    if (level < 3) throw new Error("level_3_required_for_owner_recovery_approval");
  }
}

async function assertEstateClaimActionAllowed(claim: EstateAccessClaimRow, action: EstateClaimAction) {
  const allowed: Record<string, EstateClaimAction[]> = {
    claimed: ["mark_identity_verified", "submit_authority", "reject"],
    identity_required: ["mark_identity_verified", "reject"],
    identity_verified: ["submit_authority", "approve", "reject"],
    authority_evidence_required: ["submit_authority", "reject"],
    authority_under_review: ["approve", "reject"],
    approved: ["suspend", "revoke"],
    active: ["suspend", "revoke"],
    suspended: ["revoke"],
    revoked: [],
    rejected: [],
  };
  if (!allowed[claim.status]?.includes(action)) throw new Error(`invalid_estate_claim_transition:${claim.status}:${action}`);
}

export async function recordEstateEvent(
  client: AnySupabaseClient,
  input: {
    ownerUserId: string;
    deathReportId?: string | null;
    estateClaimId?: string | null;
    actorUserId: string;
    actorType: "owner" | "claimant" | "admin" | "system";
    eventType: string;
    reason: string;
    metadata?: Record<string, unknown>;
  },
) {
  await client.from("estate_security_actions").insert({
    owner_user_id: input.ownerUserId,
    death_report_id: input.deathReportId ?? null,
    estate_claim_id: input.estateClaimId ?? null,
    action_type: input.eventType,
    actor_user_id: input.actorUserId,
    actor_type: input.actorType,
    reason: input.reason,
    metadata: sanitizeEstateMetadata(input.metadata ?? {}),
  });
  await client.from("death_report_events").insert({
    death_report_id: input.deathReportId ?? null,
    owner_user_id: input.ownerUserId,
    actor_user_id: input.actorUserId,
    actor_type: input.actorType,
    event_type: input.eventType,
    metadata: sanitizeEstateMetadata(input.metadata ?? {}),
  });
}

function eventForDeathReportAction(action: DeathReportAction) {
  if (action === "review") return "death_report_reviewed";
  if (action === "apply_protective_lock") return "protective_lock_applied";
  if (action === "confirm_death") return "death_confirmed";
  if (action === "reject") return "death_report_rejected";
  if (action === "dispute") return "death_status_disputed";
  if (action === "start_owner_recovery") return "owner_recovery_started";
  if (action === "approve_owner_recovery") return "owner_active_restored";
  return "estate_security_action";
}

function eventForEstateClaimAction(action: EstateClaimAction) {
  if (action === "mark_identity_verified") return "estate_claim_identity_verified";
  if (action === "submit_authority") return "estate_authority_submitted";
  if (action === "approve") return "estate_claim_approved";
  if (action === "reject") return "estate_claim_rejected";
  if (action === "suspend") return "estate_access_suspended";
  return "estate_access_revoked";
}

function decisionForEstateClaimAction(action: EstateClaimAction) {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "suspend") return "suspended";
  if (action === "revoke") return "revoked";
  return "retry_requested";
}

function normalizeClaimantRole(value: string) {
  const role = value.trim().toLowerCase();
  if (["executor", "family_member", "professional_representative", "administrator", "authorised_admin", "other"].includes(role)) return role;
  return "other";
}

function normalizeDeathEvidenceType(value: string) {
  const type = String(value ?? "").trim().toLowerCase();
  if (["death_certificate", "medical_confirmation", "registry_reference", "relationship_statement", "professional_attestation", "other_supporting_evidence"].includes(type)) return type;
  return "other_supporting_evidence";
}

function normalizeEstateDocumentType(value: string) {
  const type = String(value ?? "").trim().toLowerCase();
  if (["death_certificate", "grant_of_probate", "letters_of_administration", "estate_valuation", "hmrc_correspondence", "executor_correspondence", "creditor_claim", "distribution_record", "professional_report", "other_estate_document"].includes(type)) return type;
  return "other_estate_document";
}

function validateEstateEvidenceFile(file: File) {
  const allowed = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
  if (!allowed.includes(file.type)) throw new Error("unsupported_estate_evidence_type");
  if (file.size <= 0 || file.size > 15 * 1024 * 1024) throw new Error("estate_evidence_size_invalid");
}

function sanitizeFileName(fileName: string) {
  return String(fileName || "estate-evidence")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "estate-evidence";
}

function sanitizeEstateMetadata(metadata: Record<string, unknown>) {
  const blocked = new Set(["token", "jwt", "password", "signedUrl", "raw_document", "raw_image", "secret"]);
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
}

function sha256(input: Buffer | string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
