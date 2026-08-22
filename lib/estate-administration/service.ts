import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTATE_EVIDENCE_BUCKET, getIdentityPresenceLevel, getVaultLifecycleState, recordEstateEvent } from "../estate-lifecycle/service.ts";
import type { EstateCaseRow, EstateParticipantRole, EstateParticipantRow, EstatePermission } from "./types.ts";

type AnySupabaseClient = SupabaseClient;

const ESTATE_CASE_SELECT = "id,owner_user_id,death_report_id,probate_case_id,case_reference,status,vault_state_at_open,opened_by_user_id,opened_at,closed_at,closure_reason,metadata,created_at,updated_at";
const PARTICIPANT_SELECT = "id,estate_case_id,estate_claim_id,user_id,participant_role,person_type,status,required_identity_level,permissions,added_by_user_id,suspended_at,revoked_at,decision_reason,metadata,created_at,updated_at";
const CLOSED_STATUSES = new Set(["closed", "suspended"]);

export const DEFAULT_ESTATE_CHECKLIST = [
  "verify_death_evidence",
  "identify_will",
  "identify_executors",
  "confirm_probate_or_letters_status",
  "identify_financial_accounts",
  "identify_property",
  "identify_liabilities",
  "obtain_valuations",
  "notify_institutions",
  "prepare_probate_data",
  "record_tax_hmrc_work",
  "settle_liabilities",
  "prepare_distribution_schedule",
  "record_distributions",
  "prepare_estate_accounts",
  "completion_review",
];

export const DEFAULT_EXECUTOR_PERMISSIONS: EstatePermission[] = [
  "view_estate_case",
  "view_estate_documents",
  "download_estate_documents",
  "contribute_estate_document",
  "create_estate_task",
  "update_estate_task",
  "submit_authority_evidence",
  "submit_valuation",
  "record_liability",
  "record_distribution",
  "request_sensitive_action",
];

export async function createEstateCase(
  client: AnySupabaseClient,
  input: {
    ownerUserId: string;
    deathReportId?: string | null;
    probateCaseId?: string | null;
    openedByUserId: string;
    status?: EstateCaseRow["status"];
    reason: string;
  },
) {
  const vaultState = await getVaultLifecycleState(client, input.ownerUserId);
  if (!["PROTECTIVE_LOCK", "ESTATE_LOCKED", "DEATH_STATUS_DISPUTED", "OWNER_RECOVERY"].includes(vaultState)) {
    throw new Error(`estate_case_requires_locked_vault:${vaultState}`);
  }
  const now = new Date().toISOString();
  const result = await client
    .from("estate_cases")
    .insert({
      owner_user_id: input.ownerUserId,
      death_report_id: input.deathReportId ?? null,
      probate_case_id: input.probateCaseId ?? null,
      status: input.status ?? "open",
      vault_state_at_open: vaultState,
      opened_by_user_id: input.openedByUserId,
      metadata: { checklist_template: DEFAULT_ESTATE_CHECKLIST },
      created_at: now,
      updated_at: now,
    })
    .select(ESTATE_CASE_SELECT)
    .single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_case_create_failed");
  await recordEstateEvent(client, {
    ownerUserId: input.ownerUserId,
    deathReportId: input.deathReportId ?? null,
    actorUserId: input.openedByUserId,
    actorType: "admin",
    eventType: "estate_case_opened",
    reason: input.reason,
    metadata: { estate_case_id: result.data.id },
  });
  return result.data as EstateCaseRow;
}

export async function addEstateParticipant(
  client: AnySupabaseClient,
  input: {
    estateCaseId: string;
    userId: string;
    role: string;
    permissions: EstatePermission[];
    addedByUserId: string;
    estateClaimId?: string | null;
    personType?: string;
    reason: string;
  },
) {
  const estateCase = await getEstateCase(client, input.estateCaseId);
  if (estateCase.status === "closed") throw new Error("estate_case_closed");
  const level = await getIdentityPresenceLevel(client, input.userId);
  const status = level >= 2 ? "active" : "identity_required";
  const now = new Date().toISOString();
  const result = await client
    .from("estate_participants")
    .insert({
      estate_case_id: estateCase.id,
      estate_claim_id: input.estateClaimId ?? null,
      user_id: input.userId,
      participant_role: normalizeParticipantRole(input.role),
      person_type: input.personType ?? "individual",
      status,
      permissions: { capabilities: unique(input.permissions) },
      added_by_user_id: input.addedByUserId,
      created_at: now,
      updated_at: now,
    })
    .select(PARTICIPANT_SELECT)
    .single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_participant_create_failed");
  await recordEstateEvent(client, {
    ownerUserId: estateCase.owner_user_id,
    deathReportId: estateCase.death_report_id,
    estateClaimId: input.estateClaimId ?? null,
    actorUserId: input.addedByUserId,
    actorType: "admin",
    eventType: "estate_permission_granted",
    reason: input.reason,
    metadata: { estate_case_id: estateCase.id, participant_role: input.role, permission_count: input.permissions.length },
  });
  return result.data as EstateParticipantRow;
}

export async function requireEstatePermission(client: AnySupabaseClient, estateCaseId: string, userId: string, permission: EstatePermission) {
  const { data, error } = await client
    .from("estate_participants")
    .select(`${PARTICIPANT_SELECT}, estate_cases!inner(status)`)
    .eq("estate_case_id", estateCaseId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const participant = data as (EstateParticipantRow & { estate_cases?: { status?: string } }) | null;
  if (!participant) throw new Error("active_estate_participant_required");
  if (CLOSED_STATUSES.has(String(participant.estate_cases?.status ?? ""))) throw new Error("estate_case_not_open_for_action");
  const level = await getIdentityPresenceLevel(client, userId);
  if (level < participant.required_identity_level) throw new Error("estate_identity_level_required");
  const permissions = participant.permissions ?? {};
  const capabilities = Array.isArray(permissions.capabilities) ? permissions.capabilities.map(String) : [];
  if (!capabilities.includes(permission) && permissions[permission] !== true) throw new Error(`estate_permission_required:${permission}`);
  return participant;
}

export async function addEstateTask(client: AnySupabaseClient, input: {
  estateCaseId: string;
  actorUserId: string;
  title: string;
  category?: string;
  status?: string;
}) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "create_estate_task");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const result = await client.from("estate_tasks").insert({
    estate_case_id: input.estateCaseId,
    title: input.title.trim(),
    category: input.category ?? "general",
    status: input.status ?? "not_started",
    created_by_user_id: input.actorUserId,
  }).select("id,status,title").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_task_create_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_task_changed", reason: "Estate task created.", metadata: { estate_case_id: input.estateCaseId, task_id: result.data.id } });
  return result.data;
}

export async function updateEstateTask(client: AnySupabaseClient, input: {
  estateCaseId: string;
  taskId: string;
  actorUserId: string;
  status: string;
  completionNotes?: string | null;
}) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "update_estate_task");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const patch: Record<string, unknown> = { status: normalizeTaskStatus(input.status), updated_at: new Date().toISOString() };
  if (input.status === "completed") {
    patch.completed_by_user_id = input.actorUserId;
    patch.completed_at = new Date().toISOString();
    patch.completion_notes = input.completionNotes ?? null;
  }
  const result = await client.from("estate_tasks").update(patch).eq("id", input.taskId).eq("estate_case_id", input.estateCaseId).select("id,status").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_task_update_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_task_changed", reason: "Estate task updated.", metadata: { estate_case_id: input.estateCaseId, task_id: input.taskId, status: input.status } });
  return result.data;
}

export async function addEstateAdministrationDocumentVersion(client: AnySupabaseClient, input: {
  estateCaseId: string;
  actorUserId: string;
  file: File;
  documentCategory: string;
  priorVersionId?: string | null;
  purpose?: string | null;
  notes?: string | null;
}) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "contribute_estate_document");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const prior = input.priorVersionId ? await client.from("estate_administration_documents").select("id,version_number,estate_case_id").eq("id", input.priorVersionId).maybeSingle() : { data: null, error: null };
  if (prior.error) throw new Error(prior.error.message);
  if (prior.data && prior.data.estate_case_id !== input.estateCaseId) throw new Error("prior_version_cross_case_denied");
  const buffer = Buffer.from(await input.file.arrayBuffer());
  validateEstateFile(input.file);
  const safeName = sanitizeFileName(input.file.name);
  const path = `cases/${input.estateCaseId}/participants/${input.actorUserId}/${Date.now()}-${safeName}`;
  const upload = await client.storage.from(ESTATE_EVIDENCE_BUCKET).upload(path, buffer, { contentType: input.file.type || "application/octet-stream", upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  const result = await client.from("estate_administration_documents").insert({
    owner_user_id: estateCase.owner_user_id,
    death_report_id: estateCase.death_report_id,
    estate_case_id: estateCase.id,
    uploaded_by_user_id: input.actorUserId,
    document_type: normalizeDocumentType(input.documentCategory),
    document_category: input.documentCategory.trim().toLowerCase(),
    storage_bucket: ESTATE_EVIDENCE_BUCKET,
    storage_path: path,
    file_name: safeName,
    mime_type: input.file.type || "application/octet-stream",
    size_bytes: input.file.size,
    prior_version_id: input.priorVersionId ?? null,
    version_number: Number(prior.data?.version_number ?? 0) + 1,
    purpose: input.purpose ?? null,
    notes: input.notes ?? null,
    provenance: { uploader_user_id: input.actorUserId, estate_case_id: estateCase.id, prior_version_id: input.priorVersionId ?? null, source_context: "estate_administration", uploaded_at: new Date().toISOString() },
  }).select("id,storage_path,version_number,provenance").single();
  if (result.error || !result.data) {
    await client.storage.from(ESTATE_EVIDENCE_BUCKET).remove([path]);
    throw new Error(result.error?.message || "estate_document_version_create_failed");
  }
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_document_added", reason: "Estate administration document version added.", metadata: { estate_case_id: estateCase.id, document_id: result.data.id, prior_version_id: input.priorVersionId ?? null } });
  return result.data;
}

export async function addEstateValuation(client: AnySupabaseClient, input: { estateCaseId: string; actorUserId: string; assetId?: string | null; amountMinor: number; valuerName?: string | null }) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "submit_valuation");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const result = await client.from("estate_valuations").insert({ estate_case_id: estateCase.id, owner_user_id: estateCase.owner_user_id, asset_id: input.assetId ?? null, valuation_amount_minor: input.amountMinor, valuer_name: input.valuerName ?? null, uploaded_by_user_id: input.actorUserId, provenance: { source_context: "estate_administration", recorded_by: input.actorUserId } }).select("id,valuation_amount_minor").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_valuation_create_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_valuation_added", reason: "Estate valuation recorded separately from historic asset value.", metadata: { estate_case_id: estateCase.id, valuation_id: result.data.id } });
  return result.data;
}

export async function addEstateLiability(client: AnySupabaseClient, input: { estateCaseId: string; actorUserId: string; creditorName: string; amountMinor: number; category?: string }) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "record_liability");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const result = await client.from("estate_liabilities").insert({ estate_case_id: estateCase.id, owner_user_id: estateCase.owner_user_id, creditor_name: input.creditorName, category: input.category ?? "other", claimed_amount_minor: input.amountMinor, recorded_by_user_id: input.actorUserId, provenance: { source_context: "estate_administration", recorded_by: input.actorUserId } }).select("id,status").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_liability_create_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_liability_added", reason: "Estate liability recorded separately from historic vault records.", metadata: { estate_case_id: estateCase.id, liability_id: result.data.id } });
  return result.data;
}

export async function addEstateDistribution(client: AnySupabaseClient, input: { estateCaseId: string; actorUserId: string; description: string; amountMinor: number; status?: string }) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "record_distribution");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const result = await client.from("estate_distributions").insert({ estate_case_id: estateCase.id, owner_user_id: estateCase.owner_user_id, asset_or_cash_description: input.description, amount_minor: input.amountMinor, status: normalizeDistributionStatus(input.status ?? "proposed"), recorded_by_user_id: input.actorUserId, provenance: { source_context: "estate_administration", recorded_by: input.actorUserId } }).select("id,status").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_distribution_create_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_distribution_recorded", reason: "Estate distribution recorded as administration data only.", metadata: { estate_case_id: estateCase.id, distribution_id: result.data.id } });
  return result.data;
}

export async function requestSensitiveEstateAction(client: AnySupabaseClient, input: { estateCaseId: string; actorUserId: string; actionType: string; targetType: string; targetId?: string | null; justification: string; requiredApprovals?: number }) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "request_sensitive_action");
  const presence = await getIdentityPresenceLevel(client, input.actorUserId);
  if (presence < 3) throw new Error("level_3_required_for_sensitive_action");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const result = await client.from("sensitive_action_requests").insert({ estate_case_id: estateCase.id, owner_user_id: estateCase.owner_user_id, requester_user_id: input.actorUserId, action_type: input.actionType, target_type: input.targetType, target_id: input.targetId ?? null, status: "pending_approval", justification: input.justification, required_approvals: Math.max(1, input.requiredApprovals ?? 2), requester_presence_verified_at: new Date().toISOString() }).select("id,status,required_approvals").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "sensitive_action_create_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "sensitive_action_requested", reason: input.justification, metadata: { estate_case_id: estateCase.id, request_id: result.data.id, action_type: input.actionType } });
  return result.data;
}

export async function approveSensitiveEstateAction(client: AnySupabaseClient, input: { requestId: string; approverUserId: string; reason: string }) {
  type SensitiveActionRequestRow = {
    id: string;
    estate_case_id: string;
    owner_user_id: string;
    requester_user_id: string;
    status: string;
    required_approvals: number;
    expires_at: string;
  };
  const response = await client
    .from("sensitive_action_requests")
    .select("id,estate_case_id,owner_user_id,requester_user_id,status,required_approvals,expires_at")
    .eq("id", input.requestId)
    .single();
  if (response.error || !response.data) throw new Error(response.error?.message || "sensitive_action_not_found");
  const request = response.data as SensitiveActionRequestRow;
  if (request.status !== "pending_approval") throw new Error(`sensitive_action_not_pending:${request.status}`);
  if (new Date(request.expires_at).getTime() <= Date.now()) throw new Error("sensitive_action_expired");
  await requireEstatePermission(client, request.estate_case_id, input.approverUserId, "approve_sensitive_action");
  const presence = await getIdentityPresenceLevel(client, input.approverUserId);
  if (presence < 3) throw new Error("level_3_required_for_sensitive_action_approval");
  const result = await client.from("sensitive_action_approvals").insert({ request_id: input.requestId, approver_user_id: input.approverUserId, decision: "approved", reason: input.reason, approver_presence_verified_at: new Date().toISOString() }).select("id").single();
  if (result.error || !result.data) throw new Error(result.error?.message || "sensitive_action_approval_failed");
  const quorum = await client.rpc("lf_sensitive_action_quorum_met", { p_request_id: input.requestId });
  if (quorum.error) throw new Error(quorum.error.message);
  if (quorum.data === true) await client.from("sensitive_action_requests").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", input.requestId);
  await recordEstateEvent(client, { ownerUserId: request.owner_user_id, actorUserId: input.approverUserId, actorType: "admin", eventType: "sensitive_action_approved", reason: input.reason, metadata: { request_id: input.requestId, quorum_met: quorum.data === true } });
  return { id: input.requestId, quorumMet: quorum.data === true };
}

export async function closeEstateCase(client: AnySupabaseClient, input: { estateCaseId: string; actorUserId: string; reason: string }) {
  await requireEstatePermission(client, input.estateCaseId, input.actorUserId, "close_estate_case");
  const estateCase = await getEstateCase(client, input.estateCaseId);
  const result = await client.from("estate_cases").update({ status: "closed", closed_at: new Date().toISOString(), closure_reason: input.reason, updated_at: new Date().toISOString() }).eq("id", input.estateCaseId).select(ESTATE_CASE_SELECT).single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_case_close_failed");
  await recordEstateEvent(client, { ownerUserId: estateCase.owner_user_id, deathReportId: estateCase.death_report_id, actorUserId: input.actorUserId, actorType: "claimant", eventType: "estate_case_closed", reason: input.reason, metadata: { estate_case_id: input.estateCaseId } });
  return result.data as EstateCaseRow;
}

export async function getEstateCase(client: AnySupabaseClient, estateCaseId: string) {
  const result = await client.from("estate_cases").select(ESTATE_CASE_SELECT).eq("id", estateCaseId).single();
  if (result.error || !result.data) throw new Error(result.error?.message || "estate_case_not_found");
  return result.data as EstateCaseRow;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function normalizeParticipantRole(value: string): EstateParticipantRole {
  const role = value.trim().toLowerCase().replace(/-/g, "_");
  if (["executor", "administrator", "co_executor", "solicitor", "accountant", "tax_adviser", "valuer", "trustee", "beneficiary", "authorised_representative", "other"].includes(role)) return role as EstateParticipantRole;
  return "other";
}

function normalizeTaskStatus(value: string) {
  const status = value.trim().toLowerCase();
  if (["not_started", "in_progress", "waiting_external", "blocked", "completed", "cancelled"].includes(status)) return status;
  return "in_progress";
}

function normalizeDistributionStatus(value: string) {
  const status = value.trim().toLowerCase();
  if (["draft", "proposed", "approved", "paid_transferred", "cancelled", "disputed"].includes(status)) return status;
  return "proposed";
}

function normalizeDocumentType(value: string) {
  const type = value.trim().toLowerCase();
  if (["death_certificate", "grant_of_probate", "letters_of_administration", "estate_valuation", "hmrc_correspondence", "executor_correspondence", "creditor_claim", "distribution_record", "professional_report", "other_estate_document"].includes(type)) return type;
  return "other_estate_document";
}

function validateEstateFile(file: File) {
  const allowed = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
  if (!allowed.includes(file.type)) throw new Error("unsupported_estate_evidence_type");
  if (file.size <= 0 || file.size > 15 * 1024 * 1024) throw new Error("estate_evidence_size_invalid");
}

function sanitizeFileName(fileName: string) {
  return String(fileName || `estate-${crypto.randomUUID()}`)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "estate-document";
}
