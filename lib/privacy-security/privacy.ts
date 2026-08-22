import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient;

export const PRIVACY_REQUEST_TYPES = ["subject_access", "rectification", "erasure", "restriction", "portability", "objection", "marketing_objection", "other_privacy_enquiry"] as const;
export const RETENTION_STATES = ["active", "eligible_for_deletion", "restricted", "legal_hold", "deletion_pending", "deleted", "retained_by_policy"] as const;

export async function createPrivacyDataRightsCase(client: AnySupabaseClient, input: {
  requesterUserId: string;
  subjectUserId: string;
  requestType: string;
  scope?: Record<string, unknown>;
  syntheticRunMarker?: string | null;
}) {
  if (input.requesterUserId !== input.subjectUserId) throw new Error("privacy_case_subject_mismatch");
  const requestType = normalizePrivacyRequestType(input.requestType);
  const insert = await client.from("privacy_data_rights_cases").insert({
    requester_user_id: input.requesterUserId,
    subject_user_id: input.subjectUserId,
    request_type: requestType,
    status: requestType === "marketing_objection" ? "validated" : "received",
    identity_verification_status: requestType === "marketing_objection" ? "not_required" : "required",
    scope: input.scope ?? {},
    due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,request_type,status,identity_verification_status,due_at").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "privacy_case_create_failed");
  await recordPrivacyCaseEvent(client, insert.data.id, input.requesterUserId, "privacy_request_created", "success", { request_type: requestType });
  if (requestType === "marketing_objection") {
    await recordMarketingObjection(client, {
      userId: input.subjectUserId,
      actorUserId: input.requesterUserId,
      reason: "Privacy request marketing objection.",
      syntheticRunMarker: input.syntheticRunMarker ?? null,
    });
  }
  return insert.data;
}

export async function createPrivacyExport(client: AnySupabaseClient, input: {
  caseId?: string | null;
  subjectUserId: string;
  requestedByUserId: string;
  exportType?: "portability" | "subject_access" | "admin_review";
  manifest: Record<string, unknown>;
  syntheticRunMarker?: string | null;
}) {
  if (input.subjectUserId !== input.requestedByUserId && input.exportType !== "admin_review") throw new Error("privacy_export_subject_mismatch");
  const path = `${input.subjectUserId}/${Date.now()}-${crypto.randomUUID()}.json`;
  const insert = await client.from("privacy_data_exports").insert({
    case_id: input.caseId ?? null,
    subject_user_id: input.subjectUserId,
    requested_by_user_id: input.requestedByUserId,
    export_type: input.exportType ?? "portability",
    status: "created",
    storage_bucket: "privacy-data-exports",
    storage_path: path,
    manifest: sanitizeExportManifest(input.manifest),
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,storage_bucket,storage_path,expires_at,manifest").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "privacy_export_create_failed");
  const packageBody = Buffer.from(JSON.stringify({
    exportId: insert.data.id,
    generatedAt: new Date().toISOString(),
    manifest: insert.data.manifest,
  }));
  const upload = await client.storage
    .from(insert.data.storage_bucket)
    .upload(insert.data.storage_path, packageBody, { contentType: "application/json", upsert: false });
  if (upload.error) {
    await client.from("privacy_data_exports").delete().eq("id", insert.data.id);
    throw new Error(`privacy_export_package_failed:${upload.error.message}`);
  }
  if (input.caseId) await recordPrivacyCaseEvent(client, input.caseId, input.requestedByUserId, "data_export_created", "success", { export_type: input.exportType ?? "portability" });
  return insert.data;
}

export async function recordConsentPreference(client: AnySupabaseClient, input: {
  userId: string;
  purpose: string;
  status: "given" | "withdrawn" | "objected" | "not_required";
  channel?: string;
  partnerOrganisationId?: string | null;
  noticeVersion: string;
  noticeReference: string;
  source?: string;
  syntheticRunMarker?: string | null;
}) {
  const insert = await client.from("privacy_consents").insert({
    user_id: input.userId,
    purpose: normalizePurpose(input.purpose),
    partner_organisation_id: input.partnerOrganisationId ?? null,
    channel: normalizeChannel(input.channel ?? "in_app"),
    scope: input.partnerOrganisationId ? "partner" : "global",
    status: input.status,
    notice_version: input.noticeVersion,
    notice_reference: input.noticeReference,
    source: input.source ?? "contextual_notice",
    withdrawn_at: input.status === "withdrawn" || input.status === "objected" ? new Date().toISOString() : null,
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,status,captured_at").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "consent_record_failed");
  return insert.data;
}

export async function recordMarketingObjection(client: AnySupabaseClient, input: {
  userId: string;
  actorUserId: string;
  channel?: string;
  partnerOrganisationId?: string | null;
  reason: string;
  syntheticRunMarker?: string | null;
}) {
  await recordConsentPreference(client, {
    userId: input.userId,
    purpose: input.partnerOrganisationId ? "partner_campaign" : "marketing",
    partnerOrganisationId: input.partnerOrganisationId ?? null,
    channel: input.channel && input.channel !== "all" ? input.channel : "in_app",
    status: "objected",
    noticeVersion: "phase5-2026-08",
    noticeReference: "phase5-marketing-objection",
    source: "privacy_preference",
    syntheticRunMarker: input.syntheticRunMarker ?? null,
  });
  const insert = await client.from("marketing_suppressions").insert({
    user_id: input.userId,
    partner_organisation_id: input.partnerOrganisationId ?? null,
    channel: input.channel ?? "all",
    suppression_type: input.partnerOrganisationId ? "partner_opt_out" : "global_objection",
    status: "active",
    reason: input.reason,
    created_by_user_id: input.actorUserId,
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,status").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "marketing_objection_failed");
  return insert.data;
}

export async function createLegalHold(client: AnySupabaseClient, input: {
  subjectUserId: string;
  scopeType: string;
  scopeId?: string | null;
  reasonCode: string;
  reason: string;
  actorUserId: string;
  syntheticRunMarker?: string | null;
}) {
  const insert = await client.from("legal_holds").insert({
    subject_user_id: input.subjectUserId,
    scope_type: normalizeHoldScope(input.scopeType),
    scope_id: input.scopeId ?? null,
    reason_code: input.reasonCode,
    reason: input.reason,
    created_by_user_id: input.actorUserId,
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,status").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "legal_hold_create_failed");
  return insert.data;
}

export async function createRetentionItem(client: AnySupabaseClient, input: {
  subjectUserId: string;
  classification: string;
  resourceType: string;
  resourceId?: string | null;
  eligibleAt?: string | null;
  syntheticRunMarker?: string | null;
}) {
  const insert = await client.from("retention_items").insert({
    subject_user_id: input.subjectUserId,
    classification: input.classification,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    eligible_at: input.eligibleAt ?? null,
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,retention_state").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "retention_item_create_failed");
  return insert.data;
}

export async function evaluateRetentionItem(client: AnySupabaseClient, input: { itemId: string }) {
  const state = await client.rpc("lf_retention_item_effective_state", { p_item_id: input.itemId });
  if (state.error) throw new Error(state.error.message);
  return String(state.data ?? "active");
}

async function recordPrivacyCaseEvent(client: AnySupabaseClient, caseId: string, actorUserId: string, eventType: string, result: string, metadata: Record<string, unknown>) {
  await client.from("privacy_case_events").insert({ case_id: caseId, actor_user_id: actorUserId, event_type: eventType, result, metadata });
}

function normalizePrivacyRequestType(value: string) {
  const normalized = value.trim().toLowerCase();
  if ((PRIVACY_REQUEST_TYPES as readonly string[]).includes(normalized)) return normalized;
  return "other_privacy_enquiry";
}

function normalizeChannel(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["email", "sms", "push", "in_app", "phone", "post", "other"].includes(normalized) ? normalized : "other";
}

function normalizePurpose(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_").slice(0, 80);
  return normalized || "service";
}

function normalizeHoldScope(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["user", "wallet", "estate_case", "privacy_case", "organisation", "campaign", "record"].includes(normalized) ? normalized : "user";
}

function sanitizeExportManifest(manifest: Record<string, unknown>) {
  const blocked = ["jwt", "password", "secret", "service_role", "raw_dek", "wrapped_dek", "recovery_wrapped_dek"];
  const text = JSON.stringify(manifest);
  if (blocked.some((item) => text.toLowerCase().includes(item))) throw new Error("privacy_export_manifest_contains_internal_secret");
  return manifest;
}
