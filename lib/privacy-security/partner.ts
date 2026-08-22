import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient;

export const ALLOWED_COHORT_FILTERS = [
  "sponsored_entitlement_active",
  "age_band",
  "broad_region",
  "completion_state",
  "service_interest_category",
  "product_engagement_band",
  "licence_plan",
  "membership_status",
] as const;

const PROHIBITED_COHORT_FILTER_PATTERN = /(asset_value|beneficiar|will_content|vault_content|document_text|medical|death_certificate|identity_evidence|document_number|raw_sql|select\s|from\s)/i;

export function validateCohortDefinition(definition: Record<string, unknown>) {
  const keys = Object.keys(definition);
  const prohibited = keys.filter((key) => PROHIBITED_COHORT_FILTER_PATTERN.test(key) || PROHIBITED_COHORT_FILTER_PATTERN.test(JSON.stringify(definition[key])));
  const unsupported = keys.filter((key) => !(ALLOWED_COHORT_FILTERS as readonly string[]).includes(key));
  return {
    valid: prohibited.length === 0 && unsupported.length === 0,
    prohibited,
    unsupported,
    allowed: keys.filter((key) => (ALLOWED_COHORT_FILTERS as readonly string[]).includes(key)),
  };
}

export async function createPartnerCohortRequest(client: AnySupabaseClient, input: {
  organisationId: string;
  requestedByUserId: string;
  purpose: string;
  definition: Record<string, unknown>;
  minimumCohort?: number;
  syntheticRunMarker?: string | null;
}) {
  const validation = validateCohortDefinition(input.definition);
  if (!validation.valid) throw new Error(`partner_cohort_definition_rejected:${[...validation.prohibited, ...validation.unsupported].join(",")}`);
  const insert = await client.from("partner_cohort_requests").insert({
    organisation_id: input.organisationId,
    requested_by_user_id: input.requestedByUserId,
    purpose: input.purpose,
    status: "validated",
    cohort_definition: input.definition,
    allowed_filter_keys: validation.allowed,
    prohibited_filter_keys: [],
    minimum_cohort: Math.max(2, input.minimumCohort ?? 5),
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,status,minimum_cohort").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "partner_cohort_create_failed");
  return insert.data;
}

export async function evaluatePartnerCohort(client: AnySupabaseClient, input: {
  cohortRequestId: string;
  candidateUserIds: string[];
  channel?: string;
}) {
  const request = await client.from("partner_cohort_requests").select("id,organisation_id,minimum_cohort").eq("id", input.cohortRequestId).single();
  if (request.error || !request.data) throw new Error(request.error?.message || "partner_cohort_not_found");
  const organisationId = String(request.data.organisation_id);
  const channel = input.channel ?? "email";
  let marketingEligible = 0;
  for (const userId of input.candidateUserIds) {
    const eligible = await client.rpc("lf_partner_campaign_user_marketing_eligible", { p_user_id: userId, p_organisation_id: organisationId, p_channel: channel });
    if (eligible.error) throw new Error(eligible.error.message);
    if (eligible.data === true) marketingEligible += 1;
  }
  const analyticalEligible = input.candidateUserIds.length;
  const thresholdPassed = marketingEligible >= Number(request.data.minimum_cohort);
  const update = await client.from("partner_cohort_requests").update({
    status: "evaluated",
    analytical_eligible_count: analyticalEligible,
    marketing_eligible_count: marketingEligible,
    threshold_result: thresholdPassed ? "passed" : "blocked",
    policy_result: thresholdPassed ? "allowed" : "blocked",
    evaluated_at: new Date().toISOString(),
  }).eq("id", input.cohortRequestId).select("id,analytical_eligible_count,marketing_eligible_count,threshold_result,policy_result").single();
  if (update.error || !update.data) throw new Error(update.error?.message || "partner_cohort_evaluate_failed");
  return update.data;
}

export async function createPartnerCampaign(client: AnySupabaseClient, input: {
  organisationId: string;
  cohortRequestId?: string | null;
  createdByUserId: string;
  name: string;
  purpose: string;
  channel?: string;
  syntheticRunMarker?: string | null;
}) {
  const insert = await client.from("partner_campaigns").insert({
    organisation_id: input.organisationId,
    cohort_request_id: input.cohortRequestId ?? null,
    created_by_user_id: input.createdByUserId,
    name: input.name,
    purpose: input.purpose,
    channel: input.channel ?? "email",
    aggregate_only: true,
    raw_audience_export_allowed: false,
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,status,aggregate_only,raw_audience_export_allowed").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "partner_campaign_create_failed");
  return insert.data;
}

export async function addPartnerAudienceMember(client: AnySupabaseClient, input: {
  campaignId: string;
  organisationId: string;
  userId: string;
  marketingEligible: boolean;
  suppressionReasons?: string[];
  syntheticRunMarker?: string | null;
}) {
  const insert = await client.from("partner_campaign_audiences").insert({
    campaign_id: input.campaignId,
    organisation_id: input.organisationId,
    opaque_subject_ref: opaqueSubjectRef(input.organisationId, input.userId),
    user_id: input.userId,
    analytical_eligible: true,
    marketing_eligible: input.marketingEligible,
    suppression_reasons: input.suppressionReasons ?? [],
    delivery_status: input.marketingEligible ? "queued" : "suppressed",
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,opaque_subject_ref,marketing_eligible,delivery_status").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "partner_audience_insert_failed");
  return insert.data;
}

export async function createAggregateReport(client: AnySupabaseClient, input: {
  organisationId: string;
  campaignId?: string | null;
  metrics: Record<string, number | string | boolean>;
  minimumCohort?: number;
  syntheticRunMarker?: string | null;
}) {
  const eligible = Number(input.metrics.eligible ?? 0);
  const minimum = Math.max(2, input.minimumCohort ?? 5);
  const insert = await client.from("partner_aggregate_reports").insert({
    organisation_id: input.organisationId,
    campaign_id: input.campaignId ?? null,
    metrics: input.metrics,
    minimum_cohort: minimum,
    threshold_result: eligible >= minimum ? "passed" : "blocked",
    synthetic_run_marker: input.syntheticRunMarker ?? null,
  }).select("id,metrics,threshold_result").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "partner_report_create_failed");
  return insert.data;
}

function opaqueSubjectRef(organisationId: string, userId: string) {
  return `psu_${crypto.createHash("sha256").update(organisationId).update(":").update(userId).digest("hex").slice(0, 32)}`;
}
