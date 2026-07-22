import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccessState } from "./access.ts";

type AnySupabaseClient = SupabaseClient;

export const ENTERPRISE_ORGANISATION_TYPES = [
  "employer",
  "law_firm",
  "wealth_manager",
  "insurer",
  "funeral_provider",
  "employee_benefit_provider",
  "enterprise_reseller",
  "other",
] as const;

export const ENTERPRISE_LICENCE_STATUSES = ["draft", "pending_approval", "active", "expiring", "suspended", "cancelled"] as const;
export const ENTERPRISE_INVITATION_STATUSES = ["draft", "scheduled", "sent", "delivered", "accepted", "expired", "revoked", "failed"] as const;
export const ENTERPRISE_REPORT_MINIMUM_COHORT = 5;

type EnterpriseOrganisationRow = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  organisation_type: string;
  organisation_type_other: string | null;
  country: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  internal_account_owner: string | null;
  status: string;
  risk_status: string;
  created_at: string;
  updated_at: string;
};

type EnterpriseLicenceRow = {
  id: string;
  organisation_id: string;
  licence_plan: string;
  contract_reference: string | null;
  billing_reference: string | null;
  start_date: string;
  renewal_date: string;
  purchased_seats: number;
  allocated_seats: number;
  active_seats: number;
  invited_seats: number;
  suspended_seats: number;
  billing_status: string;
  licence_status: string;
  account_owner: string | null;
};

type EnterpriseInvitationRow = {
  id: string;
  organisation_id: string;
  licence_id: string | null;
  email_normalized: string;
  full_name: string | null;
  invitation_type: string;
  role_template: string;
  status: string;
  expires_at: string;
  require_mfa: boolean;
  sent_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  failure_reason: string | null;
  created_at: string;
};

type EnterpriseConsentRow = {
  organisation_id: string;
  adviser_insight_consent: boolean;
  marketing_consent: boolean;
  reporting_consent: boolean;
  export_permission: boolean;
  minimum_reporting_cohort: number;
  retention_rule: string;
};

export type EnterprisePortfolio = Awaited<ReturnType<typeof loadEnterprisePortfolio>>;

export function normalizeEnterpriseEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function assertEnterpriseEmail(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new EnterpriseOperationError("invalid_email", "Enter a valid email address.", 400);
  }
}

export class EnterpriseOperationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "EnterpriseOperationError";
    this.code = code;
    this.status = status;
  }
}

export async function loadEnterprisePortfolio(client: AnySupabaseClient, access: AdminAccessState) {
  const [organisationsRes, licencesRes, invitationsRes, consentRes, savedViewsRes] = await Promise.all([
    client
      .from("enterprise_organisations")
      .select("id,legal_name,trading_name,organisation_type,organisation_type_other,country,primary_contact_name,primary_contact_email,internal_account_owner,status,risk_status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("enterprise_licences")
      .select("id,organisation_id,licence_plan,contract_reference,billing_reference,start_date,renewal_date,purchased_seats,allocated_seats,active_seats,invited_seats,suspended_seats,billing_status,licence_status,account_owner")
      .order("renewal_date", { ascending: true })
      .limit(300),
    client
      .from("enterprise_invitations")
      .select("id,organisation_id,licence_id,email_normalized,full_name,invitation_type,role_template,status,expires_at,require_mfa,sent_at,accepted_at,revoked_at,failure_reason,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    client
      .from("enterprise_consent_settings")
      .select("organisation_id,adviser_insight_consent,marketing_consent,reporting_consent,export_permission,minimum_reporting_cohort,retention_rule"),
    client
      .from("enterprise_saved_views")
      .select("id,name,view_type,filters,created_at")
      .eq("owner_user_id", access.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  for (const result of [organisationsRes, licencesRes, invitationsRes, consentRes, savedViewsRes]) {
    if (result.error) throw new EnterpriseOperationError("enterprise_query_failed", result.error.message, 500);
  }

  const organisations = ((organisationsRes.data ?? []) as EnterpriseOrganisationRow[]).map((row) => mapOrganisation(row));
  const licences = ((licencesRes.data ?? []) as EnterpriseLicenceRow[]).map((row) => mapLicence(row));
  const invitations = ((invitationsRes.data ?? []) as EnterpriseInvitationRow[]).map((row) => mapInvitation(row));
  const consentByOrg = new Map(((consentRes.data ?? []) as EnterpriseConsentRow[]).map((row) => [row.organisation_id, row]));
  const today = new Date();
  const renewalsDue = licences.filter((licence) => {
    const renewal = new Date(licence.renewalDate);
    return renewal.getTime() >= today.getTime() && renewal.getTime() <= today.getTime() + 90 * 24 * 60 * 60 * 1000;
  });
  const activeLicences = licences.filter((licence) => licence.status === "active" || licence.status === "expiring");
  const seats = licences.reduce(
    (acc, licence) => {
      acc.purchased += licence.purchasedSeats;
      acc.allocated += licence.allocatedSeats;
      acc.active += licence.activeSeats;
      acc.invited += licence.invitedSeats;
      acc.suspended += licence.suspendedSeats;
      return acc;
    },
    { purchased: 0, allocated: 0, active: 0, invited: 0, suspended: 0 },
  );
  const consentRestricted = organisations.filter((org) => {
    const consent = consentByOrg.get(org.id);
    return !consent?.reporting_consent || !consent?.adviser_insight_consent;
  });
  const adoptionBands = buildAdoptionBands(organisations, licences, invitations, consentByOrg);

  return {
    summary: {
      organisations: organisations.length,
      activeLicences: activeLicences.length,
      renewalsDue: renewalsDue.length,
      pendingInvitations: invitations.filter((item) => ["scheduled", "sent", "delivered"].includes(item.status)).length,
      atRiskOrganisations: organisations.filter((item) => item.risk === "at_risk" || item.risk === "restricted").length,
      consentRestricted: consentRestricted.length,
      seats,
    },
    organisations,
    licences,
    invitations,
    consent: Object.fromEntries([...consentByOrg.entries()].map(([id, row]) => [id, mapConsent(row)])),
    adoptionBands,
    savedViews: savedViewsRes.data ?? [],
    privacyBoundary: {
      vaultContentExcluded: true,
      documentContentExcluded: true,
      financialValuesExcluded: true,
      reportingMinimumCohort: ENTERPRISE_REPORT_MINIMUM_COHORT,
    },
  };
}

export async function createEnterpriseOrganisation(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: Record<string, unknown>,
) {
  const legalName = requiredText(input.legalName, "Legal name is required.");
  const organisationType = normalizeChoice(input.organisationType, ENTERPRISE_ORGANISATION_TYPES, "Choose a valid organisation type.");
  const country = requiredText(input.country ?? "GB", "Country is required.");
  const now = new Date().toISOString();
  const insert = await client
    .from("enterprise_organisations")
    .insert({
      legal_name: legalName,
      trading_name: optionalText(input.tradingName),
      organisation_type: organisationType,
      organisation_type_other: organisationType === "other" ? requiredText(input.organisationTypeOther, "Describe the organisation type.") : null,
      registration_number: optionalText(input.registrationNumber),
      country,
      registered_address: structuredAddress(input.registeredAddress),
      operating_address: structuredAddress(input.operatingAddress),
      primary_contact_name: optionalText(input.primaryContactName),
      primary_contact_email: optionalEmail(input.primaryContactEmail),
      website: optionalText(input.website),
      internal_account_owner: optionalText(input.internalAccountOwner),
      status: "pending_setup",
      risk_status: "normal",
      created_by_user_id: access.user.id,
      updated_at: now,
    })
    .select("id,legal_name,trading_name,organisation_type,organisation_type_other,country,primary_contact_name,primary_contact_email,internal_account_owner,status,risk_status,created_at,updated_at")
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("organisation_create_failed", insert.error?.message ?? "Could not create organisation.", 500);

  await client.from("enterprise_consent_settings").upsert({
    organisation_id: insert.data.id,
    adviser_insight_consent: Boolean(input.adviserInsightConsent),
    marketing_consent: Boolean(input.marketingConsent),
    reporting_consent: input.reportingConsent !== false,
    export_permission: Boolean(input.exportPermission),
    minimum_reporting_cohort: Math.max(Number(input.minimumReportingCohort ?? 10), ENTERPRISE_REPORT_MINIMUM_COHORT),
    retention_rule: optionalText(input.retentionRule) ?? "standard",
    updated_by_user_id: access.user.id,
    updated_at: now,
  }, { onConflict: "organisation_id" });

  return mapOrganisation(insert.data as EnterpriseOrganisationRow);
}

export async function createEnterpriseLicence(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: Record<string, unknown>,
) {
  const organisationId = requiredText(input.organisationId, "Organisation is required.");
  const purchasedSeats = Math.max(Number(input.purchasedSeats ?? 0), 0);
  const allocatedSeats = Math.max(Number(input.allocatedSeats ?? 0), 0);
  if (allocatedSeats > purchasedSeats) {
    throw new EnterpriseOperationError("seat_entitlement_exceeded", "Allocated seats cannot exceed purchased seats.", 409);
  }
  const insert = await client
    .from("enterprise_licences")
    .insert({
      organisation_id: organisationId,
      licence_plan: requiredText(input.licencePlan, "Licence plan is required."),
      contract_reference: optionalText(input.contractReference),
      billing_reference: optionalText(input.billingReference),
      start_date: requiredText(input.startDate, "Start date is required."),
      renewal_date: requiredText(input.renewalDate, "Renewal date is required."),
      purchased_seats: purchasedSeats,
      allocated_seats: allocatedSeats,
      invited_seats: 0,
      active_seats: 0,
      suspended_seats: 0,
      billing_status: optionalText(input.billingStatus) ?? "pending",
      licence_status: optionalText(input.licenceStatus) ?? "pending_approval",
      account_owner: optionalText(input.accountOwner),
      created_by_user_id: access.user.id,
    })
    .select("id,organisation_id,licence_plan,contract_reference,billing_reference,start_date,renewal_date,purchased_seats,allocated_seats,active_seats,invited_seats,suspended_seats,billing_status,licence_status,account_owner")
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("licence_create_failed", insert.error?.message ?? "Could not create licence.", 500);
  return mapLicence(insert.data as EnterpriseLicenceRow);
}

export async function createEnterpriseInvitation(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: Record<string, unknown>,
) {
  const organisationId = requiredText(input.organisationId, "Organisation is required.");
  const email = normalizeEnterpriseEmail(input.email as string);
  assertEnterpriseEmail(email);
  const invitationType = String(input.invitationType ?? "enterprise_user") === "organisation_admin" ? "organisation_admin" : "enterprise_user";
  const tokenHash = hashInvitationToken(randomBytes(32).toString("base64url"));
  const expiresAt = new Date(Date.now() + Math.max(Number(input.expiryDays ?? 14), 1) * 24 * 60 * 60 * 1000).toISOString();
  const insert = await client
    .from("enterprise_invitations")
    .insert({
      organisation_id: organisationId,
      licence_id: optionalText(input.licenceId),
      email_normalized: email,
      full_name: optionalText(input.fullName),
      invitation_type: invitationType,
      role_template: invitationType === "organisation_admin" ? "organisation_admin" : "enterprise_user",
      status: "sent",
      token_hash: tokenHash,
      expires_at: expiresAt,
      require_mfa: Boolean(input.requireMfa),
      sent_at: new Date().toISOString(),
      created_by_user_id: access.user.id,
    })
    .select("id,organisation_id,licence_id,email_normalized,full_name,invitation_type,role_template,status,expires_at,require_mfa,sent_at,accepted_at,revoked_at,failure_reason,created_at")
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("invitation_create_failed", insert.error?.message ?? "Could not create invitation.", 500);
  await incrementLicenceInvitedSeats(client, optionalText(input.licenceId));
  return mapInvitation(insert.data as EnterpriseInvitationRow);
}

export async function updateEnterpriseInvitationStatus(client: AnySupabaseClient, id: string, status: string) {
  const normalized = normalizeChoice(status, ENTERPRISE_INVITATION_STATUSES, "Choose a valid invitation status.");
  const patch: Record<string, unknown> = { status: normalized, updated_at: new Date().toISOString() };
  if (normalized === "revoked") patch.revoked_at = new Date().toISOString();
  const update = await client
    .from("enterprise_invitations")
    .update(patch)
    .eq("id", id)
    .select("id,organisation_id,licence_id,email_normalized,full_name,invitation_type,role_template,status,expires_at,require_mfa,sent_at,accepted_at,revoked_at,failure_reason,created_at")
    .single();
  if (update.error || !update.data) throw new EnterpriseOperationError("invitation_update_failed", update.error?.message ?? "Could not update invitation.", 500);
  return mapInvitation(update.data as EnterpriseInvitationRow);
}

export async function saveEnterpriseView(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const insert = await client
    .from("enterprise_saved_views")
    .insert({
      owner_user_id: access.user.id,
      name: requiredText(input.name, "Saved view name is required."),
      view_type: optionalText(input.viewType) ?? "portfolio",
      filters: typeof input.filters === "object" && input.filters !== null ? input.filters : {},
    })
    .select("id,name,view_type,filters,created_at")
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("saved_view_failed", insert.error?.message ?? "Could not save view.", 500);
  return insert.data;
}

export async function buildEnterpriseReportExportDecision(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const portfolio = await loadEnterprisePortfolio(client, access);
  const cohort = portfolio.organisations.length;
  const exportAllowed = portfolio.organisations.some((org) => portfolio.consent[org.id]?.exportPermission)
    && cohort >= ENTERPRISE_REPORT_MINIMUM_COHORT;
  return {
    ok: exportAllowed,
    code: exportAllowed ? "export_ready" : "export_blocked",
    message: exportAllowed
      ? "Aggregated report export can be prepared by a governed export worker."
      : "Export blocked: cohort threshold or organisation export consent is not met.",
    reportType: optionalText(input.reportType) ?? "portfolio",
    cohort,
    minimumCohort: ENTERPRISE_REPORT_MINIMUM_COHORT,
  };
}

async function incrementLicenceInvitedSeats(client: AnySupabaseClient, licenceId: string | null) {
  if (!licenceId) return;
  const current = await client
    .from("enterprise_licences")
    .select("id,purchased_seats,allocated_seats,invited_seats")
    .eq("id", licenceId)
    .single();
  if (current.error || !current.data) return;
  const invited = Number(current.data.invited_seats ?? 0) + 1;
  const allocated = Number(current.data.allocated_seats ?? 0) + 1;
  if (allocated > Number(current.data.purchased_seats ?? 0)) {
    throw new EnterpriseOperationError("seat_entitlement_exceeded", "No unallocated licence seats are available.", 409);
  }
  await client.from("enterprise_licences").update({ invited_seats: invited, allocated_seats: allocated, updated_at: new Date().toISOString() }).eq("id", licenceId);
}

function buildAdoptionBands(
  organisations: ReturnType<typeof mapOrganisation>[],
  licences: ReturnType<typeof mapLicence>[],
  invitations: ReturnType<typeof mapInvitation>[],
  consentByOrg: Map<string, EnterpriseConsentRow>,
) {
  return organisations.map((org) => {
    const orgLicences = licences.filter((licence) => licence.organisationId === org.id);
    const orgInvitations = invitations.filter((invitation) => invitation.organisationId === org.id);
    const seats = orgLicences.reduce((sum, licence) => sum + licence.purchasedSeats, 0);
    const activeSeats = orgLicences.reduce((sum, licence) => sum + licence.activeSeats, 0);
    const acceptanceRate = orgInvitations.length
      ? Math.round((orgInvitations.filter((item) => item.status === "accepted").length / orgInvitations.length) * 100)
      : 0;
    const utilisation = seats ? Math.round((activeSeats / seats) * 100) : 0;
    const score = Math.round((acceptanceRate + utilisation) / 2);
    const consent = consentByOrg.get(org.id);
    return {
      organisationId: org.id,
      organisationName: org.name,
      band: score >= 75 ? "high" : score >= 40 ? "medium" : "low",
      acceptanceRate,
      seatUtilisation: utilisation,
      consentRestricted: !consent?.reporting_consent || !consent?.adviser_insight_consent,
    };
  });
}

function mapOrganisation(row: EnterpriseOrganisationRow) {
  return {
    id: row.id,
    name: row.trading_name || row.legal_name,
    legalName: row.legal_name,
    tradingName: row.trading_name,
    type: row.organisation_type,
    typeOther: row.organisation_type_other,
    country: row.country,
    status: row.status,
    risk: row.risk_status,
    primaryContactName: row.primary_contact_name,
    primaryContactEmail: row.primary_contact_email,
    accountOwner: row.internal_account_owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLicence(row: EnterpriseLicenceRow) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    plan: row.licence_plan,
    contractReference: row.contract_reference,
    billingReference: row.billing_reference,
    startDate: row.start_date,
    renewalDate: row.renewal_date,
    purchasedSeats: Number(row.purchased_seats ?? 0),
    allocatedSeats: Number(row.allocated_seats ?? 0),
    activeSeats: Number(row.active_seats ?? 0),
    invitedSeats: Number(row.invited_seats ?? 0),
    suspendedSeats: Number(row.suspended_seats ?? 0),
    billingStatus: row.billing_status,
    status: row.licence_status,
    accountOwner: row.account_owner,
  };
}

function mapInvitation(row: EnterpriseInvitationRow) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    licenceId: row.licence_id,
    email: row.email_normalized,
    fullName: row.full_name,
    invitationType: row.invitation_type,
    roleTemplate: row.role_template,
    status: row.status,
    expiresAt: row.expires_at,
    requireMfa: row.require_mfa,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

function mapConsent(row: EnterpriseConsentRow) {
  return {
    adviserInsightConsent: row.adviser_insight_consent,
    marketingConsent: row.marketing_consent,
    reportingConsent: row.reporting_consent,
    exportPermission: row.export_permission,
    minimumReportingCohort: row.minimum_reporting_cohort,
    retentionRule: row.retention_rule,
  };
}

function requiredText(value: unknown, message: string) {
  const text = optionalText(value);
  if (!text) throw new EnterpriseOperationError("invalid_payload", message, 400);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalEmail(value: unknown) {
  const email = normalizeEnterpriseEmail(value as string);
  if (!email) return null;
  assertEnterpriseEmail(email);
  return email;
}

function normalizeChoice<T extends readonly string[]>(value: unknown, choices: T, message: string): T[number] {
  const text = String(value ?? "").trim().toLowerCase();
  if (choices.includes(text as T[number])) return text as T[number];
  throw new EnterpriseOperationError("invalid_payload", message, 400);
}

function structuredAddress(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
