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
export const ENTERPRISE_ORGANISATION_STATUSES = ["draft", "pending_setup", "pending_administrator_acceptance", "active", "suspended", "expiring", "cancelled", "archived"] as const;
export const ENTERPRISE_ONBOARDING_STATUSES = ["not_started", "pending", "in_progress", "blocked", "complete"] as const;
export const ENTERPRISE_RISK_STATUSES = ["normal", "watch", "at_risk", "critical", "restricted"] as const;
export const ENTERPRISE_REPORT_MINIMUM_COHORT = 5;
const ORGANISATION_SELECT = "id,legal_name,trading_name,organisation_type,organisation_type_other,registration_number,country,registered_address,operating_address,primary_contact_name,primary_contact_email,primary_contact_telephone,website,internal_account_owner,contract_reference,customer_reference,onboarding_status,onboarding_notes,nominated_admin_name,nominated_admin_email,nominated_admin_require_mfa,nominated_admin_expiry_days,status,risk_status,same_operating_address,archived_at,created_at,updated_at";

type EnterpriseOrganisationRow = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  organisation_type: string;
  organisation_type_other: string | null;
  country: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_telephone: string | null;
  website: string | null;
  internal_account_owner: string | null;
  registration_number: string | null;
  registered_address: Record<string, unknown>;
  operating_address: Record<string, unknown>;
  same_operating_address: boolean;
  contract_reference: string | null;
  customer_reference: string | null;
  onboarding_status: string;
  onboarding_notes: string | null;
  nominated_admin_name: string | null;
  nominated_admin_email: string | null;
  nominated_admin_require_mfa: boolean;
  nominated_admin_expiry_days: number;
  status: string;
  risk_status: string;
  archived_at: string | null;
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
      .select(ORGANISATION_SELECT)
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
  const primaryContactEmail = requiredEmail(input.primaryContactEmail, "Primary contact email is required.");
  const internalAccountOwner = requiredText(input.internalAccountOwner, "Internal account owner is required.");
  const website = optionalUrl(input.website);
  const status = normalizeChoice(input.initialStatus ?? input.status ?? "pending_setup", ENTERPRISE_ORGANISATION_STATUSES, "Choose a valid organisation status.");
  const risk = normalizeChoice(input.riskStatus ?? "normal", ENTERPRISE_RISK_STATUSES, "Choose a valid risk classification.");
  const onboardingStatus = normalizeChoice(input.onboardingStatus ?? "not_started", ENTERPRISE_ONBOARDING_STATUSES, "Choose a valid onboarding status.");
  await assertNoDuplicateRegistration(client, optionalText(input.registrationNumber));
  const now = new Date().toISOString();
  const registeredAddress = structuredAddress(input.registeredAddress);
  const sameOperatingAddress = Boolean(input.sameOperatingAddress);
  const insert = await client
    .from("enterprise_organisations")
    .insert({
      legal_name: legalName,
      trading_name: optionalText(input.tradingName),
      organisation_type: organisationType,
      organisation_type_other: organisationType === "other" ? requiredText(input.organisationTypeOther, "Describe the organisation type.") : null,
      registration_number: optionalText(input.registrationNumber),
      country,
      registered_address: registeredAddress,
      operating_address: sameOperatingAddress ? registeredAddress : structuredAddress(input.operatingAddress),
      same_operating_address: sameOperatingAddress,
      primary_contact_name: optionalText(input.primaryContactName),
      primary_contact_email: primaryContactEmail,
      primary_contact_telephone: optionalText(input.primaryContactTelephone),
      website,
      internal_account_owner: internalAccountOwner,
      contract_reference: optionalText(input.contractReference),
      customer_reference: optionalText(input.customerReference),
      onboarding_status: onboardingStatus,
      onboarding_notes: optionalText(input.onboardingNotes),
      nominated_admin_name: optionalText(input.nominatedAdminName),
      nominated_admin_email: optionalEmail(input.nominatedAdminEmail),
      nominated_admin_require_mfa: input.nominatedAdminRequireMfa !== false,
      nominated_admin_expiry_days: Math.max(Number(input.nominatedAdminExpiryDays ?? 14), 1),
      status,
      risk_status: risk,
      created_by_user_id: access.user.id,
      updated_at: now,
    })
    .select(ORGANISATION_SELECT)
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

export async function getEnterpriseOrganisationDetail(client: AnySupabaseClient, organisationId: string) {
  const orgRes = await client.from("enterprise_organisations").select(ORGANISATION_SELECT).eq("id", organisationId).maybeSingle();
  if (orgRes.error) throw new EnterpriseOperationError("organisation_query_failed", orgRes.error.message, 500);
  if (!orgRes.data) throw new EnterpriseOperationError("organisation_not_found", "Organisation not found.", 404);
  const [licencesRes, invitationsRes, consentRes, auditRes] = await Promise.all([
    client.from("enterprise_licences").select("id,organisation_id,licence_plan,contract_reference,billing_reference,start_date,renewal_date,purchased_seats,allocated_seats,active_seats,invited_seats,suspended_seats,billing_status,licence_status,account_owner").eq("organisation_id", organisationId).order("renewal_date", { ascending: true }),
    client.from("enterprise_invitations").select("id,organisation_id,licence_id,email_normalized,full_name,invitation_type,role_template,status,expires_at,require_mfa,sent_at,accepted_at,revoked_at,failure_reason,created_at").eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    client.from("enterprise_consent_settings").select("organisation_id,adviser_insight_consent,marketing_consent,reporting_consent,export_permission,minimum_reporting_cohort,retention_rule").eq("organisation_id", organisationId).maybeSingle(),
    client.from("audit_events").select("id,action,result,actor_email_normalized,actor_role,resource_type,resource_id,resource_label,policy_decision,metadata,created_at").eq("resource_type", "organisation").eq("resource_id", organisationId).order("created_at", { ascending: false }).limit(50),
  ]);
  for (const result of [licencesRes, invitationsRes, auditRes]) {
    if (result.error) throw new EnterpriseOperationError("organisation_detail_failed", result.error.message, 500);
  }
  return {
    organisation: mapOrganisation(orgRes.data as EnterpriseOrganisationRow),
    licences: ((licencesRes.data ?? []) as EnterpriseLicenceRow[]).map(mapLicence),
    invitations: ((invitationsRes.data ?? []) as EnterpriseInvitationRow[]).map(mapInvitation),
    consent: consentRes.data ? mapConsent(consentRes.data as EnterpriseConsentRow) : null,
    auditEvents: auditRes.data ?? [],
    privacyBoundary: {
      vaultContentExcluded: true,
      documentContentExcluded: true,
      financialValuesExcluded: true,
    },
  };
}

export async function updateEnterpriseOrganisation(
  client: AnySupabaseClient,
  organisationId: string,
  input: Record<string, unknown>,
) {
  const current = await getOrganisationRow(client, organisationId);
  const expectedUpdatedAt = optionalText(input.expectedUpdatedAt);
  if (expectedUpdatedAt && expectedUpdatedAt !== current.updated_at) {
    throw new EnterpriseOperationError("stale_organisation_update", "This organisation changed since you opened it. Reload before saving.", 409);
  }
  const organisationType = normalizeChoice(input.organisationType ?? current.organisation_type, ENTERPRISE_ORGANISATION_TYPES, "Choose a valid organisation type.");
  const registrationNumber = optionalText(input.registrationNumber);
  await assertNoDuplicateRegistration(client, registrationNumber, organisationId);
  const registeredAddress = structuredAddress(input.registeredAddress ?? current.registered_address);
  const sameOperatingAddress = Boolean(input.sameOperatingAddress ?? current.same_operating_address);
  const patch = {
    legal_name: requiredText(input.legalName ?? current.legal_name, "Legal name is required."),
    trading_name: optionalText(input.tradingName ?? current.trading_name),
    organisation_type: organisationType,
    organisation_type_other: organisationType === "other" ? requiredText(input.organisationTypeOther ?? current.organisation_type_other, "Describe the organisation type.") : null,
    registration_number: registrationNumber,
    country: requiredText(input.country ?? current.country, "Country is required."),
    registered_address: registeredAddress,
    operating_address: sameOperatingAddress ? registeredAddress : structuredAddress(input.operatingAddress ?? current.operating_address),
    same_operating_address: sameOperatingAddress,
    primary_contact_name: optionalText(input.primaryContactName ?? current.primary_contact_name),
    primary_contact_email: requiredEmail(input.primaryContactEmail ?? current.primary_contact_email, "Primary contact email is required."),
    primary_contact_telephone: optionalText(input.primaryContactTelephone ?? current.primary_contact_telephone),
    website: optionalUrl(input.website ?? current.website),
    internal_account_owner: requiredText(input.internalAccountOwner ?? current.internal_account_owner, "Internal account owner is required."),
    contract_reference: optionalText(input.contractReference ?? current.contract_reference),
    customer_reference: optionalText(input.customerReference ?? current.customer_reference),
    onboarding_status: normalizeChoice(input.onboardingStatus ?? current.onboarding_status, ENTERPRISE_ONBOARDING_STATUSES, "Choose a valid onboarding status."),
    onboarding_notes: optionalText(input.onboardingNotes ?? current.onboarding_notes),
    nominated_admin_name: optionalText(input.nominatedAdminName ?? current.nominated_admin_name),
    nominated_admin_email: optionalEmail(input.nominatedAdminEmail ?? current.nominated_admin_email),
    nominated_admin_require_mfa: input.nominatedAdminRequireMfa !== false,
    nominated_admin_expiry_days: Math.max(Number(input.nominatedAdminExpiryDays ?? current.nominated_admin_expiry_days ?? 14), 1),
    risk_status: normalizeChoice(input.riskStatus ?? current.risk_status, ENTERPRISE_RISK_STATUSES, "Choose a valid risk classification."),
    updated_at: new Date().toISOString(),
  };
  const update = await client.from("enterprise_organisations").update(patch).eq("id", organisationId).select(ORGANISATION_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("organisation_update_failed", update.error?.message ?? "Could not update organisation.", 500);
  return { before: mapOrganisation(current), after: mapOrganisation(update.data as EnterpriseOrganisationRow), changedFields: changedFields(current, update.data as EnterpriseOrganisationRow) };
}

export async function transitionEnterpriseOrganisation(
  client: AnySupabaseClient,
  access: AdminAccessState,
  organisationId: string,
  nextStatus: string,
  reason: unknown,
) {
  const current = await getOrganisationRow(client, organisationId);
  const normalized = normalizeChoice(nextStatus, ENTERPRISE_ORGANISATION_STATUSES, "Choose a valid organisation status.");
  if (!isValidOrganisationTransition(current.status, normalized)) {
    throw new EnterpriseOperationError("invalid_organisation_transition", `Cannot move organisation from ${current.status} to ${normalized}.`, 409);
  }
  const patch: Record<string, unknown> = { status: normalized, updated_at: new Date().toISOString() };
  if (normalized === "archived") {
    patch.archived_at = new Date().toISOString();
    patch.archived_by_user_id = access.user.id;
    patch.onboarding_notes = appendReason(current.onboarding_notes, reason);
  }
  if (normalized === "suspended") patch.onboarding_notes = appendReason(current.onboarding_notes, reason);
  const update = await client.from("enterprise_organisations").update(patch).eq("id", organisationId).select(ORGANISATION_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("organisation_transition_failed", update.error?.message ?? "Could not update organisation status.", 500);
  return { before: mapOrganisation(current), after: mapOrganisation(update.data as EnterpriseOrganisationRow) };
}

export async function deleteOrArchiveEnterpriseOrganisation(
  client: AnySupabaseClient,
  access: AdminAccessState,
  organisationId: string,
  reason: unknown,
) {
  const current = await getOrganisationRow(client, organisationId);
  const dependencyCounts = await getOrganisationDependencyCounts(client, organisationId);
  const canHardDelete = current.status === "draft" && Object.values(dependencyCounts).every((count) => count === 0);
  if (canHardDelete) {
    const deleted = await client.from("enterprise_organisations").delete().eq("id", organisationId).select("id").single();
    if (deleted.error) throw new EnterpriseOperationError("organisation_delete_failed", deleted.error.message, 500);
    return { mode: "deleted" as const, before: mapOrganisation(current), dependencyCounts };
  }
  const archived = await transitionEnterpriseOrganisation(client, access, organisationId, "archived", reason);
  return { mode: "archived" as const, before: archived.before, after: archived.after, dependencyCounts };
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
    registrationNumber: row.registration_number,
    country: row.country,
    registeredAddress: row.registered_address ?? {},
    operatingAddress: row.operating_address ?? {},
    sameOperatingAddress: row.same_operating_address,
    status: row.status,
    risk: row.risk_status,
    primaryContactName: row.primary_contact_name,
    primaryContactEmail: row.primary_contact_email,
    primaryContactTelephone: row.primary_contact_telephone,
    website: row.website,
    accountOwner: row.internal_account_owner,
    contractReference: row.contract_reference,
    customerReference: row.customer_reference,
    onboardingStatus: row.onboarding_status,
    onboardingNotes: row.onboarding_notes,
    nominatedAdminName: row.nominated_admin_name,
    nominatedAdminEmail: row.nominated_admin_email,
    nominatedAdminRequireMfa: row.nominated_admin_require_mfa,
    nominatedAdminExpiryDays: row.nominated_admin_expiry_days,
    archivedAt: row.archived_at,
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

function requiredEmail(value: unknown, message: string) {
  const email = optionalEmail(value);
  if (!email) throw new EnterpriseOperationError("invalid_payload", message, 400);
  return email;
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

function optionalUrl(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
    return url.toString();
  } catch {
    throw new EnterpriseOperationError("invalid_url", "Enter a valid website URL.", 400);
  }
}

function normalizeChoice<T extends readonly string[]>(value: unknown, choices: T, message: string): T[number] {
  const text = String(value ?? "").trim().toLowerCase();
  if (choices.includes(text as T[number])) return text as T[number];
  throw new EnterpriseOperationError("invalid_payload", message, 400);
}

function structuredAddress(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}

async function getOrganisationRow(client: AnySupabaseClient, organisationId: string) {
  const res = await client.from("enterprise_organisations").select(ORGANISATION_SELECT).eq("id", organisationId).maybeSingle();
  if (res.error) throw new EnterpriseOperationError("organisation_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("organisation_not_found", "Organisation not found.", 404);
  return res.data as EnterpriseOrganisationRow;
}

async function assertNoDuplicateRegistration(client: AnySupabaseClient, registrationNumber: string | null, excludeId?: string) {
  if (!registrationNumber) return;
  let query = client.from("enterprise_organisations").select("id").ilike("registration_number", registrationNumber).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const res = await query;
  if (res.error) throw new EnterpriseOperationError("duplicate_check_failed", res.error.message, 500);
  if ((res.data ?? []).length > 0) throw new EnterpriseOperationError("duplicate_registration_number", "An organisation with this registration number already exists.", 409);
}

async function getOrganisationDependencyCounts(client: AnySupabaseClient, organisationId: string) {
  const [licences, seats, invitations] = await Promise.all([
    client.from("enterprise_licences").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
    client.from("enterprise_seats").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
    client.from("enterprise_invitations").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
  ]);
  for (const result of [licences, seats, invitations]) {
    if (result.error) throw new EnterpriseOperationError("dependency_check_failed", result.error.message, 500);
  }
  return {
    licences: licences.count ?? 0,
    seats: seats.count ?? 0,
    invitations: invitations.count ?? 0,
  };
}

function isValidOrganisationTransition(from: string, to: string) {
  if (from === to) return true;
  const allowed: Record<string, string[]> = {
    draft: ["pending_setup", "archived"],
    pending_setup: ["pending_administrator_acceptance", "active", "suspended", "archived"],
    pending_administrator_acceptance: ["active", "suspended", "archived"],
    active: ["suspended", "expiring", "archived"],
    suspended: ["active", "archived"],
    expiring: ["active", "cancelled", "archived"],
    cancelled: ["archived"],
    archived: [],
  };
  return (allowed[from] ?? []).includes(to);
}

function appendReason(notes: string | null, reason: unknown) {
  const text = optionalText(reason);
  if (!text) return notes;
  return [notes, `Lifecycle reason: ${text}`].filter(Boolean).join("\n");
}

function changedFields(before: EnterpriseOrganisationRow, after: EnterpriseOrganisationRow) {
  const fields: Array<keyof EnterpriseOrganisationRow> = [
    "legal_name",
    "trading_name",
    "organisation_type",
    "organisation_type_other",
    "registration_number",
    "country",
    "primary_contact_email",
    "internal_account_owner",
    "status",
    "risk_status",
    "onboarding_status",
    "nominated_admin_email",
  ];
  return fields.filter((field) => before[field] !== after[field]).map(String);
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
