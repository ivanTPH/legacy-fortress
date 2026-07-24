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

export const ENTERPRISE_LICENCE_STATUSES = ["draft", "pending_approval", "active", "expiring", "suspended", "cancelled", "expired"] as const;
export const ENTERPRISE_LICENCE_PLANS = ["starter", "professional", "enterprise", "custom"] as const;
export const ENTERPRISE_BILLING_STATUSES = ["not_configured", "trial", "active", "past_due", "suspended", "cancelled", "pending", "current", "overdue", "manual_review"] as const;
export const ENTERPRISE_INVITATION_STATUSES = ["draft", "scheduled", "sent", "delivered", "accepted", "expired", "revoked", "failed"] as const;
export const ENTERPRISE_MEMBERSHIP_STATUSES = ["invited", "active", "suspended", "removed"] as const;
export const ENTERPRISE_ORGANISATION_ROLES = ["organisation_admin", "organisation_licence_manager", "organisation_user_manager", "organisation_reporting_viewer", "organisation_auditor", "organisation_member", "licence_manager", "user_manager", "reporting_viewer", "read_only_auditor", "enterprise_user"] as const;
export const ENTERPRISE_ENROLMENT_LINK_STATUSES = ["active", "paused", "expired", "exhausted", "revoked"] as const;
export const ENTERPRISE_ORGANISATION_STATUSES = ["draft", "pending_setup", "pending_administrator_acceptance", "active", "suspended", "expiring", "cancelled", "archived"] as const;
export const ENTERPRISE_ONBOARDING_STATUSES = ["not_started", "pending", "in_progress", "blocked", "complete"] as const;
export const ENTERPRISE_RISK_STATUSES = ["normal", "watch", "at_risk", "critical", "restricted"] as const;
export const ENTERPRISE_REPORT_MINIMUM_COHORT = 5;
export const ENTERPRISE_REPORT_TYPES = [
  "portfolio",
  "licence_utilisation",
  "seat_availability",
  "invitation_status",
  "membership_status",
  "onboarding_completion",
  "adoption_bands",
  "renewal_pipeline",
  "organisation_risk",
  "consent_readiness",
  "consent_restrictions",
  "enrolment_link_usage",
  "audit_activity",
] as const;
export const ENTERPRISE_FILTER_KEYS = [
  "dateRange",
  "organisation",
  "status",
  "type",
  "country",
  "accountOwner",
  "licence",
  "licencePlan",
  "billingStatus",
  "renewal",
  "utilisation",
  "invitation",
  "membership",
  "role",
  "onboarding",
  "adoption",
  "consent",
  "risk",
  "synthetic",
] as const;
const ORGANISATION_SELECT = "id,legal_name,trading_name,organisation_type,organisation_type_other,registration_number,country,registered_address,operating_address,primary_contact_name,primary_contact_email,primary_contact_telephone,website,internal_account_owner,contract_reference,customer_reference,onboarding_status,onboarding_notes,nominated_admin_name,nominated_admin_email,nominated_admin_require_mfa,nominated_admin_expiry_days,status,risk_status,same_operating_address,archived_at,created_at,updated_at";
const LICENCE_SELECT = "id,organisation_id,licence_plan,custom_plan_name,contract_reference,billing_reference,start_date,renewal_date,end_date,renewal_notice_days,auto_renew,renewal_notes,purchased_seats,allocated_seats,active_seats,invited_seats,suspended_seats,billing_status,licence_status,account_owner,created_at,updated_at";
const INVITATION_SELECT = "id,organisation_id,licence_id,email_normalized,full_name,invitation_type,role_template,status,expires_at,require_mfa,sent_at,accepted_at,revoked_at,failure_reason,created_at,scope,access_expires_at,resend_count,last_resent_at,delivered_at,failed_at,seat_id,internal_reference,department,synthetic_run_marker";
const MEMBERSHIP_SELECT = "id,organisation_id,licence_id,seat_id,user_id,email_normalized,full_name,organisation_role,membership_status,onboarding_status,consent_status,internal_reference,department,invited_at,joined_at,suspended_at,removed_at,last_active_at,access_expires_at,synthetic_run_marker,created_at,updated_at";
const ENROLMENT_LINK_SELECT = "id,organisation_id,licence_id,display_name,status,expires_at,max_claims,claims_used,allowed_email_domain,approval_required,default_role,revoked_at,synthetic_run_marker,created_at,updated_at";

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
  custom_plan_name: string | null;
  contract_reference: string | null;
  billing_reference: string | null;
  start_date: string;
  renewal_date: string;
  end_date: string | null;
  renewal_notice_days: number;
  auto_renew: boolean;
  renewal_notes: string | null;
  purchased_seats: number;
  allocated_seats: number;
  active_seats: number;
  invited_seats: number;
  suspended_seats: number;
  billing_status: string;
  licence_status: string;
  account_owner: string | null;
  created_at: string;
  updated_at: string;
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
  scope?: string;
  access_expires_at?: string | null;
  resend_count?: number;
  last_resent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  seat_id?: string | null;
  internal_reference?: string | null;
  department?: string | null;
  synthetic_run_marker?: string | null;
};

type EnterpriseMembershipRow = {
  id: string;
  organisation_id: string;
  licence_id: string | null;
  seat_id: string | null;
  user_id: string;
  email_normalized: string;
  full_name: string | null;
  organisation_role: string;
  membership_status: string;
  onboarding_status: string;
  consent_status: string;
  internal_reference: string | null;
  department: string | null;
  invited_at: string | null;
  joined_at: string | null;
  suspended_at: string | null;
  removed_at: string | null;
  last_active_at: string | null;
  access_expires_at: string | null;
  synthetic_run_marker: string | null;
  created_at: string;
  updated_at: string;
};

type EnterpriseEnrolmentLinkRow = {
  id: string;
  organisation_id: string;
  licence_id: string;
  display_name: string;
  status: string;
  expires_at: string;
  max_claims: number;
  claims_used: number;
  allowed_email_domain: string | null;
  approval_required: boolean;
  default_role: string;
  revoked_at: string | null;
  synthetic_run_marker: string | null;
  created_at: string;
  updated_at: string;
};

type EnterpriseConsentAcceptanceRow = {
  id: string;
  organisation_id: string;
  membership_id: string | null;
  invitation_id: string | null;
  user_id: string;
  consent_version: string;
  organisation_terms_accepted: boolean;
  reporting_consent: boolean;
  adviser_insight_consent: boolean;
  marketing_consent: boolean;
  communication_preferences: Record<string, unknown>;
  source: string;
  synthetic_run_marker: string | null;
  accepted_at: string;
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

type EnterpriseSavedViewRow = {
  id: string;
  name: string;
  description?: string | null;
  view_type: string;
  filters: Record<string, unknown>;
  sort_config?: Record<string, unknown> | null;
  visible_columns?: unknown[] | null;
  organisation_id?: string | null;
  owner_user_id?: string | null;
  share_scope?: string | null;
  is_default?: boolean | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at?: string | null;
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
  const scopedOrganisationIds = access.enterpriseScope?.organisationScoped ? access.enterpriseScope.organisationIds : [];
  const organisationsQuery = client
    .from("enterprise_organisations")
    .select(ORGANISATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  const licencesQuery = client
    .from("enterprise_licences")
    .select(LICENCE_SELECT)
    .order("renewal_date", { ascending: true })
    .limit(300);
  const invitationsQuery = client
    .from("enterprise_invitations")
    .select(INVITATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(300);
  const membershipsQuery = client
    .from("enterprise_memberships")
    .select(MEMBERSHIP_SELECT)
    .order("created_at", { ascending: false })
    .limit(300);
  const enrolmentLinksQuery = client
    .from("enterprise_enrolment_links")
    .select(ENROLMENT_LINK_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  const consentQuery = client
    .from("enterprise_consent_settings")
    .select("organisation_id,adviser_insight_consent,marketing_consent,reporting_consent,export_permission,minimum_reporting_cohort,retention_rule");
  const [organisationsRes, licencesRes, invitationsRes, membershipsRes, enrolmentLinksRes, consentRes, savedViewsRes] = await Promise.all([
    scopedOrganisationIds.length ? organisationsQuery.in("id", scopedOrganisationIds) : organisationsQuery,
    scopedOrganisationIds.length ? licencesQuery.in("organisation_id", scopedOrganisationIds) : licencesQuery,
    scopedOrganisationIds.length ? invitationsQuery.in("organisation_id", scopedOrganisationIds) : invitationsQuery,
    scopedOrganisationIds.length ? membershipsQuery.in("organisation_id", scopedOrganisationIds) : membershipsQuery,
    scopedOrganisationIds.length ? enrolmentLinksQuery.in("organisation_id", scopedOrganisationIds) : enrolmentLinksQuery,
    scopedOrganisationIds.length ? consentQuery.in("organisation_id", scopedOrganisationIds) : consentQuery,
    client
      .from("enterprise_saved_views")
      .select("id,name,description,view_type,filters,sort_config,visible_columns,organisation_id,share_scope,is_default,last_used_at,owner_user_id,created_at,updated_at")
      .or(`owner_user_id.eq.${access.user.id},share_scope.neq.private`)
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  for (const result of [organisationsRes, licencesRes, invitationsRes, membershipsRes, enrolmentLinksRes, consentRes, savedViewsRes]) {
    if (result.error) throw new EnterpriseOperationError("enterprise_query_failed", result.error.message, 500);
  }

  const organisations = ((organisationsRes.data ?? []) as EnterpriseOrganisationRow[]).map((row) => mapOrganisation(row));
  const licences = ((licencesRes.data ?? []) as EnterpriseLicenceRow[]).map((row) => mapLicence(row));
  const invitations = ((invitationsRes.data ?? []) as EnterpriseInvitationRow[]).map((row) => mapInvitation(row));
  const memberships = ((membershipsRes.data ?? []) as EnterpriseMembershipRow[]).map((row) => mapMembership(row));
  const enrolmentLinks = ((enrolmentLinksRes.data ?? []) as EnterpriseEnrolmentLinkRow[]).map((row) => mapEnrolmentLink(row));
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
      acc.available += licence.availableSeats;
      return acc;
    },
    { purchased: 0, allocated: 0, active: 0, invited: 0, suspended: 0, available: 0 },
  );
  const consentRestricted = organisations.filter((org) => {
    const consent = consentByOrg.get(org.id);
    return !consent?.reporting_consent || !consent?.adviser_insight_consent;
  });
  const adoptionBands = buildAdoptionBands(organisations, licences, invitations, consentByOrg);
  const reports = buildEnterpriseReportCatalogue(access);
  const reportRows = buildEnterpriseReportSummaries(organisations, licences, invitations, memberships, enrolmentLinks, consentByOrg, adoptionBands);
  const risk = buildEnterpriseRiskSummaries(organisations, licences, invitations, memberships, consentByOrg, adoptionBands);

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
    memberships,
    enrolmentLinks,
    consent: Object.fromEntries([...consentByOrg.entries()].map(([id, row]) => [id, mapConsent(row)])),
    adoptionBands,
    savedViews: ((savedViewsRes.data ?? []) as EnterpriseSavedViewRow[]).filter((row) => canAccessSavedView(access, row, scopedOrganisationIds)).map(mapSavedView),
    reports,
    reportRows,
    risk,
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
  const [licencesRes, invitationsRes, membershipsRes, enrolmentLinksRes, consentRes, consentAcceptancesRes, auditRes] = await Promise.all([
    client.from("enterprise_licences").select(LICENCE_SELECT).eq("organisation_id", organisationId).order("renewal_date", { ascending: true }),
    client.from("enterprise_invitations").select(INVITATION_SELECT).eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    client.from("enterprise_memberships").select(MEMBERSHIP_SELECT).eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    client.from("enterprise_enrolment_links").select(ENROLMENT_LINK_SELECT).eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    client.from("enterprise_consent_settings").select("organisation_id,adviser_insight_consent,marketing_consent,reporting_consent,export_permission,minimum_reporting_cohort,retention_rule").eq("organisation_id", organisationId).maybeSingle(),
    client.from("enterprise_consent_acceptances").select("id,organisation_id,membership_id,invitation_id,user_id,consent_version,organisation_terms_accepted,reporting_consent,adviser_insight_consent,marketing_consent,communication_preferences,source,synthetic_run_marker,accepted_at").eq("organisation_id", organisationId).order("accepted_at", { ascending: false }).limit(100),
    client.from("audit_events").select("id,action,result,actor_email_normalized,actor_role,resource_type,resource_id,resource_label,policy_decision,metadata,created_at").eq("resource_type", "organisation").eq("resource_id", organisationId).order("created_at", { ascending: false }).limit(80),
  ]);
  for (const result of [licencesRes, invitationsRes, membershipsRes, enrolmentLinksRes, consentAcceptancesRes, auditRes]) {
    if (result.error) throw new EnterpriseOperationError("organisation_detail_failed", result.error.message, 500);
  }
  return {
    organisation: mapOrganisation(orgRes.data as EnterpriseOrganisationRow),
    licences: ((licencesRes.data ?? []) as EnterpriseLicenceRow[]).map(mapLicence),
    invitations: ((invitationsRes.data ?? []) as EnterpriseInvitationRow[]).map(mapInvitation),
    memberships: ((membershipsRes.data ?? []) as EnterpriseMembershipRow[]).map(mapMembership),
    enrolmentLinks: ((enrolmentLinksRes.data ?? []) as EnterpriseEnrolmentLinkRow[]).map(mapEnrolmentLink),
    consentAcceptances: ((consentAcceptancesRes.data ?? []) as EnterpriseConsentAcceptanceRow[]).map(mapConsentAcceptance),
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
  const organisation = await getOrganisationRow(client, organisationId);
  if (["archived", "cancelled"].includes(organisation.status)) {
    throw new EnterpriseOperationError("organisation_not_licensable", "Archived or cancelled organisations cannot receive a new licence.", 409);
  }
  await assertNoOpenLicenceForOrganisation(client, organisationId);
  const licencePlan = normalizeChoice(input.licencePlan, ENTERPRISE_LICENCE_PLANS, "Choose a valid licence plan.");
  const startDate = requiredDate(input.startDate, "Start date is required.");
  const renewalDate = requiredDate(input.renewalDate, "Renewal date is required.");
  if (new Date(renewalDate).getTime() < new Date(startDate).getTime()) {
    throw new EnterpriseOperationError("invalid_licence_dates", "Renewal date must be on or after the start date.", 400);
  }
  const purchasedSeats = requiredPositiveInteger(input.purchasedSeats, "Purchased seats must be at least 1.");
  const committedSeats = Math.max(Number(input.allocatedSeats ?? 0), 0);
  assertSeatEntitlement(purchasedSeats, committedSeats);
  const licenceStatus = normalizeChoice(input.licenceStatus ?? "pending_approval", ENTERPRISE_LICENCE_STATUSES, "Choose a valid licence status.");
  const billingStatus = normalizeChoice(input.billingStatus ?? "not_configured", ENTERPRISE_BILLING_STATUSES, "Choose a valid billing status.");
  const insert = await client
    .from("enterprise_licences")
    .insert({
      organisation_id: organisationId,
      licence_plan: licencePlan,
      custom_plan_name: licencePlan === "custom" ? requiredText(input.customPlanName, "Custom plan name is required.") : null,
      contract_reference: optionalText(input.contractReference),
      billing_reference: optionalText(input.billingReference),
      start_date: startDate,
      renewal_date: renewalDate,
      end_date: optionalDate(input.endDate),
      renewal_notice_days: boundedInteger(input.renewalNoticeDays ?? 90, 1, 365, "Renewal notice period must be between 1 and 365 days."),
      auto_renew: Boolean(input.autoRenew),
      renewal_notes: optionalText(input.renewalNotes),
      purchased_seats: purchasedSeats,
      allocated_seats: committedSeats,
      invited_seats: 0,
      active_seats: 0,
      suspended_seats: 0,
      billing_status: billingStatus,
      licence_status: licenceStatus,
      account_owner: optionalText(input.accountOwner),
      created_by_user_id: access.user.id,
    })
    .select(LICENCE_SELECT)
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("licence_create_failed", insert.error?.message ?? "Could not create licence.", 500);
  return mapLicence(insert.data as EnterpriseLicenceRow);
}

export async function getEnterpriseLicenceDetail(client: AnySupabaseClient, licenceId: string) {
  const licenceRes = await client.from("enterprise_licences").select(LICENCE_SELECT).eq("id", licenceId).maybeSingle();
  if (licenceRes.error) throw new EnterpriseOperationError("licence_query_failed", licenceRes.error.message, 500);
  if (!licenceRes.data) throw new EnterpriseOperationError("licence_not_found", "Licence not found.", 404);
  const licence = mapLicence(licenceRes.data as EnterpriseLicenceRow);
  const [orgRes, seatsRes, renewalsRes, auditRes] = await Promise.all([
    client.from("enterprise_organisations").select(ORGANISATION_SELECT).eq("id", licence.organisationId).maybeSingle(),
    client.from("enterprise_seats").select("id,organisation_id,licence_id,user_id,invitee_email_normalized,seat_status,assigned_at,activated_at,suspended_at,released_at").eq("licence_id", licenceId).order("assigned_at", { ascending: false }),
    client.from("enterprise_licence_renewals").select("id,organisation_id,licence_id,previous_renewal_date,new_renewal_date,previous_purchased_seats,new_purchased_seats,previous_plan,new_plan,contract_reference,billing_reference,notes,synthetic_run_marker,created_at").eq("licence_id", licenceId).order("created_at", { ascending: false }),
    client.from("audit_events").select("id,action,result,actor_email_normalized,actor_role,resource_type,resource_id,resource_label,policy_decision,metadata,created_at").eq("resource_type", "licence").eq("resource_id", licenceId).order("created_at", { ascending: false }).limit(50),
  ]);
  for (const result of [seatsRes, renewalsRes, auditRes]) {
    if (result.error) throw new EnterpriseOperationError("licence_detail_failed", result.error.message, 500);
  }
  if (orgRes.error) throw new EnterpriseOperationError("licence_detail_failed", orgRes.error.message, 500);
  return {
    licence,
    organisation: orgRes.data ? mapOrganisation(orgRes.data as EnterpriseOrganisationRow) : null,
    seats: seatsRes.data ?? [],
    renewals: renewalsRes.data ?? [],
    auditEvents: auditRes.data ?? [],
    privacyBoundary: {
      vaultContentExcluded: true,
      documentContentExcluded: true,
      financialValuesExcluded: true,
    },
  };
}

export async function updateEnterpriseLicence(client: AnySupabaseClient, licenceId: string, input: Record<string, unknown>) {
  const current = await getLicenceRow(client, licenceId);
  const licencePlan = normalizeChoice(input.licencePlan ?? current.licence_plan, ENTERPRISE_LICENCE_PLANS, "Choose a valid licence plan.");
  const startDate = requiredDate(input.startDate ?? current.start_date, "Start date is required.");
  const renewalDate = requiredDate(input.renewalDate ?? current.renewal_date, "Renewal date is required.");
  if (new Date(renewalDate).getTime() < new Date(startDate).getTime()) {
    throw new EnterpriseOperationError("invalid_licence_dates", "Renewal date must be on or after the start date.", 400);
  }
  const purchasedSeats = input.purchasedSeats === undefined ? Number(current.purchased_seats) : requiredPositiveInteger(input.purchasedSeats, "Purchased seats must be at least 1.");
  assertSeatEntitlement(purchasedSeats, committedSeatsForRow(current));
  const patch = {
    licence_plan: licencePlan,
    custom_plan_name: licencePlan === "custom" ? requiredText(input.customPlanName ?? current.custom_plan_name, "Custom plan name is required.") : null,
    contract_reference: optionalText(input.contractReference ?? current.contract_reference),
    billing_reference: optionalText(input.billingReference ?? current.billing_reference),
    start_date: startDate,
    renewal_date: renewalDate,
    end_date: optionalDate(input.endDate ?? current.end_date),
    renewal_notice_days: boundedInteger(input.renewalNoticeDays ?? current.renewal_notice_days ?? 90, 1, 365, "Renewal notice period must be between 1 and 365 days."),
    auto_renew: Boolean(input.autoRenew ?? current.auto_renew),
    renewal_notes: optionalText(input.renewalNotes ?? current.renewal_notes),
    purchased_seats: purchasedSeats,
    allocated_seats: committedSeatsForRow(current),
    billing_status: normalizeChoice(input.billingStatus ?? current.billing_status, ENTERPRISE_BILLING_STATUSES, "Choose a valid billing status."),
    licence_status: normalizeChoice(input.licenceStatus ?? current.licence_status, ENTERPRISE_LICENCE_STATUSES, "Choose a valid licence status."),
    account_owner: optionalText(input.accountOwner ?? current.account_owner),
    updated_at: new Date().toISOString(),
  };
  const update = await client.from("enterprise_licences").update(patch).eq("id", licenceId).select(LICENCE_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("licence_update_failed", update.error?.message ?? "Could not update licence.", 500);
  return { before: mapLicence(current), after: mapLicence(update.data as EnterpriseLicenceRow), changedFields: changedLicenceFields(current, update.data as EnterpriseLicenceRow) };
}

export async function changeEnterpriseLicenceSeats(client: AnySupabaseClient, licenceId: string, input: Record<string, unknown>) {
  const current = await getLicenceRow(client, licenceId);
  const newPurchasedSeats = requiredPositiveInteger(input.newPurchasedSeats ?? input.purchasedSeats, "Enter the new purchased-seat quantity.");
  const committed = committedSeatsForRow(current);
  assertSeatEntitlement(newPurchasedSeats, committed);
  const update = await client
    .from("enterprise_licences")
    .update({
      purchased_seats: newPurchasedSeats,
      allocated_seats: committed,
      account_owner: optionalText(input.accountOwner ?? current.account_owner),
      updated_at: new Date().toISOString(),
    })
    .eq("id", licenceId)
    .select(LICENCE_SELECT)
    .single();
  if (update.error || !update.data) throw new EnterpriseOperationError("licence_seat_update_failed", update.error?.message ?? "Could not update seat entitlement.", 500);
  return { before: mapLicence(current), after: mapLicence(update.data as EnterpriseLicenceRow), committedSeats: committed };
}

export async function transitionEnterpriseLicence(client: AnySupabaseClient, licenceId: string, nextStatus: string, reason: unknown) {
  const current = await getLicenceRow(client, licenceId);
  const normalized = normalizeChoice(nextStatus, ENTERPRISE_LICENCE_STATUSES, "Choose a valid licence status.");
  if (!isValidLicenceTransition(current.licence_status, normalized)) {
    throw new EnterpriseOperationError("invalid_licence_transition", `Cannot move licence from ${current.licence_status} to ${normalized}.`, 409);
  }
  const patch: Record<string, unknown> = { licence_status: normalized, updated_at: new Date().toISOString() };
  if (normalized === "suspended") {
    patch.billing_status = "suspended";
    patch.suspended_at = new Date().toISOString();
    patch.renewal_notes = appendReason(current.renewal_notes, reason);
  }
  if (normalized === "active" && current.licence_status === "suspended") {
    patch.billing_status = current.billing_status === "suspended" ? "active" : current.billing_status;
  }
  if (normalized === "cancelled") {
    patch.billing_status = "cancelled";
    patch.cancelled_at = new Date().toISOString();
    patch.renewal_notes = appendReason(current.renewal_notes, reason);
  }
  if (normalized === "expired") patch.expired_at = new Date().toISOString();
  const update = await client.from("enterprise_licences").update(patch).eq("id", licenceId).select(LICENCE_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("licence_transition_failed", update.error?.message ?? "Could not update licence status.", 500);
  return { before: mapLicence(current), after: mapLicence(update.data as EnterpriseLicenceRow) };
}

export async function renewEnterpriseLicence(client: AnySupabaseClient, access: AdminAccessState, licenceId: string, input: Record<string, unknown>) {
  const current = await getLicenceRow(client, licenceId);
  if (!["active", "expiring"].includes(current.licence_status)) {
    throw new EnterpriseOperationError("licence_not_renewable", "Only active or expiring licences can be renewed.", 409);
  }
  const newRenewalDate = requiredDate(input.newRenewalDate ?? input.renewalDate, "New renewal date is required.");
  if (new Date(newRenewalDate).getTime() <= new Date(current.renewal_date).getTime()) {
    throw new EnterpriseOperationError("invalid_renewal_date", "New renewal date must be after the current renewal date.", 409);
  }
  const newPurchasedSeats = input.renewedSeatQuantity === undefined ? Number(current.purchased_seats) : requiredPositiveInteger(input.renewedSeatQuantity, "Renewed seat quantity must be at least 1.");
  assertSeatEntitlement(newPurchasedSeats, committedSeatsForRow(current));
  const newPlan = normalizeChoice(input.licencePlan ?? current.licence_plan, ENTERPRISE_LICENCE_PLANS, "Choose a valid licence plan.");
  const renewal = await client.from("enterprise_licence_renewals").insert({
    organisation_id: current.organisation_id,
    licence_id: current.id,
    previous_renewal_date: current.renewal_date,
    new_renewal_date: newRenewalDate,
    previous_purchased_seats: current.purchased_seats,
    new_purchased_seats: newPurchasedSeats,
    previous_plan: current.licence_plan,
    new_plan: newPlan,
    contract_reference: optionalText(input.contractReference ?? current.contract_reference),
    billing_reference: optionalText(input.billingReference ?? current.billing_reference),
    notes: optionalText(input.renewalNotes),
    synthetic_run_marker: optionalText(input.syntheticRunMarker),
    created_by_user_id: access.user.id,
  }).select("id").single();
  if (renewal.error) throw new EnterpriseOperationError("licence_renewal_failed", renewal.error.message, 500);
  const update = await client.from("enterprise_licences").update({
    licence_plan: newPlan,
    custom_plan_name: newPlan === "custom" ? requiredText(input.customPlanName ?? current.custom_plan_name, "Custom plan name is required.") : null,
    purchased_seats: newPurchasedSeats,
    allocated_seats: committedSeatsForRow(current),
    renewal_date: newRenewalDate,
    contract_reference: optionalText(input.contractReference ?? current.contract_reference),
    billing_reference: optionalText(input.billingReference ?? current.billing_reference),
    renewal_notes: optionalText(input.renewalNotes ?? current.renewal_notes),
    licence_status: "active",
    billing_status: normalizeChoice(input.billingStatus ?? current.billing_status ?? "active", ENTERPRISE_BILLING_STATUSES, "Choose a valid billing status."),
    updated_at: new Date().toISOString(),
  }).eq("id", licenceId).select(LICENCE_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("licence_renewal_update_failed", update.error?.message ?? "Could not update renewed licence.", 500);
  return { before: mapLicence(current), after: mapLicence(update.data as EnterpriseLicenceRow), renewalId: renewal.data?.id };
}

export async function createEnterpriseSeatReservation(client: AnySupabaseClient, licenceId: string, input: Record<string, unknown>) {
  const current = await getLicenceRow(client, licenceId);
  if (!["active", "expiring", "pending_approval"].includes(current.licence_status)) {
    throw new EnterpriseOperationError("licence_allocation_blocked", "Cancelled, expired or suspended licences cannot allocate new seats.", 409);
  }
  const email = optionalEmail(input.email);
  const committed = committedSeatsForRow(current);
  assertSeatEntitlement(Number(current.purchased_seats), committed + 1);
  const seat = await client.from("enterprise_seats").insert({
    organisation_id: current.organisation_id,
    licence_id: current.id,
    invitee_email_normalized: email,
    seat_status: "invited",
    synthetic_run_marker: optionalText(input.syntheticRunMarker),
  }).select("id").single();
  if (seat.error) throw new EnterpriseOperationError("seat_reservation_failed", seat.error.message, 500);
  const update = await client.from("enterprise_licences").update({
    invited_seats: Number(current.invited_seats ?? 0) + 1,
    allocated_seats: committed + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", licenceId).select(LICENCE_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("seat_counter_update_failed", update.error?.message ?? "Could not update seat counters.", 500);
  return { seatId: seat.data?.id, licence: mapLicence(update.data as EnterpriseLicenceRow) };
}

export async function createEnterpriseInvitation(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: Record<string, unknown>,
) {
  const organisationId = requiredText(input.organisationId, "Organisation is required.");
  const organisation = await getOrganisationRow(client, organisationId);
  if (!["active", "pending_setup", "pending_administrator_acceptance"].includes(organisation.status)) {
    throw new EnterpriseOperationError("organisation_invitation_blocked", "Suspended, archived or cancelled organisations cannot issue invitations.", 409);
  }
  const email = normalizeEnterpriseEmail(input.email as string);
  assertEnterpriseEmail(email);
  const invitationType = String(input.invitationType ?? "enterprise_user") === "organisation_admin" ? "organisation_admin" : "enterprise_user";
  const roleTemplate = normalizeEnterpriseRole(input.roleTemplate ?? (invitationType === "organisation_admin" ? "organisation_admin" : "organisation_member"));
  if (invitationType === "organisation_admin" && !roleTemplate.startsWith("organisation_")) {
    throw new EnterpriseOperationError("invalid_invitation_role", "Choose an organisation-scoped administrator role.", 400);
  }
  const duplicate = await client
    .from("enterprise_invitations")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("email_normalized", email)
    .in("status", ["draft", "scheduled", "sent", "delivered"])
    .limit(1);
  if (duplicate.error) throw new EnterpriseOperationError("invitation_duplicate_check_failed", duplicate.error.message, 500);
  if ((duplicate.data ?? []).length > 0) throw new EnterpriseOperationError("duplicate_pending_invitation", "This organisation already has a pending invitation for that email.", 409);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + Math.max(Number(input.expiryDays ?? 14), 1) * 24 * 60 * 60 * 1000).toISOString();
  let seatId: string | null = null;
  if (invitationType === "enterprise_user") {
    const reservation = await createEnterpriseSeatReservation(client, requiredText(input.licenceId, "Licence is required for organisation user invitations."), {
      email,
      syntheticRunMarker: input.syntheticRunMarker,
    });
    seatId = String(reservation.seatId ?? "");
  }
  const insert = await client
    .from("enterprise_invitations")
    .insert({
      organisation_id: organisationId,
      licence_id: optionalText(input.licenceId),
      email_normalized: email,
      full_name: optionalText(input.fullName),
      invitation_type: invitationType,
      role_template: roleTemplate,
      status: "sent",
      token_hash: tokenHash,
      expires_at: expiresAt,
      access_expires_at: optionalDateTime(input.accessExpiresAt),
      require_mfa: Boolean(input.requireMfa),
      seat_id: seatId,
      internal_reference: optionalText(input.internalReference),
      department: optionalText(input.department),
      synthetic_run_marker: optionalText(input.syntheticRunMarker),
      sent_at: new Date().toISOString(),
      created_by_user_id: access.user.id,
    })
    .select(INVITATION_SELECT)
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("invitation_create_failed", insert.error?.message ?? "Could not create invitation.", 500);
  if (seatId) {
    await client.from("enterprise_seats").update({ invitation_id: insert.data.id }).eq("id", seatId);
  }
  return { ...mapInvitation(insert.data as EnterpriseInvitationRow), stagingAcceptPath: buildEnterpriseInvitationAcceptPath(token) };
}

export async function updateEnterpriseInvitationStatus(client: AnySupabaseClient, id: string, status: string) {
  const normalized = normalizeChoice(status, ENTERPRISE_INVITATION_STATUSES, "Choose a valid invitation status.");
  const current = await getInvitationRow(client, id);
  const patch: Record<string, unknown> = { status: normalized, updated_at: new Date().toISOString() };
  if (normalized === "revoked") patch.revoked_at = new Date().toISOString();
  if (normalized === "sent") {
    patch.sent_at = new Date().toISOString();
    patch.last_resent_at = new Date().toISOString();
    patch.resend_count = Number(current.resend_count ?? 0) + 1;
  }
  if (normalized === "expired") patch.failure_reason = appendReason(current.failure_reason, "Expired by administrator");
  const update = await client
    .from("enterprise_invitations")
    .update(patch)
    .eq("id", id)
    .select(INVITATION_SELECT)
    .single();
  if (update.error || !update.data) throw new EnterpriseOperationError("invitation_update_failed", update.error?.message ?? "Could not update invitation.", 500);
  if (["revoked", "expired", "failed"].includes(normalized) && current.seat_id) {
    await releaseEnterpriseSeat(client, current.seat_id, "invitation_release");
  }
  return mapInvitation(update.data as EnterpriseInvitationRow);
}

export async function getEnterpriseInvitationPreview(client: AnySupabaseClient, token: string) {
  const invitation = await getInvitationByToken(client, token);
  assertInvitationCanBeAccepted(invitation);
  const organisation = await getOrganisationRow(client, invitation.organisation_id);
  return {
    invitation: mapInvitation(invitation),
    organisation: mapOrganisation(organisation),
    privacyBoundary: {
      vaultContentExcluded: true,
      documentContentExcluded: true,
      financialValuesExcluded: true,
    },
  };
}

export async function acceptEnterpriseInvitation(
  client: AnySupabaseClient,
  access: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null } },
  input: Record<string, unknown>,
) {
  const invitation = await getInvitationByToken(client, requiredText(input.token, "Invitation token is required."));
  assertInvitationCanBeAccepted(invitation);
  const userEmail = normalizeEnterpriseEmail(access.user.email);
  if (!userEmail || userEmail !== invitation.email_normalized) {
    throw new EnterpriseOperationError("invitation_identity_mismatch", "Sign in with the invited email address before accepting this invitation.", 403);
  }
  const organisation = await getOrganisationRow(client, invitation.organisation_id);
  if (!["active", "pending_setup", "pending_administrator_acceptance"].includes(organisation.status)) {
    throw new EnterpriseOperationError("organisation_not_accepting_members", "This organisation is not accepting membership changes.", 409);
  }
  const consent = normaliseConsentInput(input);
  if (!consent.organisationTermsAccepted) {
    throw new EnterpriseOperationError("organisation_terms_required", "Accept the organisation terms to continue.", 400);
  }
  const now = new Date().toISOString();
  let seatId = invitation.seat_id ?? null;
  if (invitation.invitation_type === "enterprise_user" && !seatId) {
    const reservation = await createEnterpriseSeatReservation(client, requiredText(invitation.licence_id, "Invitation is missing a licence."), {
      email: invitation.email_normalized,
      syntheticRunMarker: invitation.synthetic_run_marker,
    });
    seatId = String(reservation.seatId ?? "");
  }
  await assertNoActiveMembershipForUser(client, invitation.organisation_id, access.user.id);
  const membership = await client.from("enterprise_memberships").insert({
    organisation_id: invitation.organisation_id,
    licence_id: invitation.licence_id,
    seat_id: seatId,
    user_id: access.user.id,
    email_normalized: invitation.email_normalized,
    full_name: invitation.full_name ?? optionalText(access.user.user_metadata?.full_name) ?? invitation.email_normalized,
    organisation_role: normalizeMembershipRole(invitation.role_template),
    membership_status: "active",
    onboarding_status: "pending",
    consent_status: consent.marketingConsent === false ? "partially_accepted" : "accepted",
    internal_reference: invitation.internal_reference ?? null,
    department: invitation.department ?? null,
    invited_at: invitation.sent_at,
    joined_at: now,
    access_expires_at: invitation.access_expires_at,
    synthetic_run_marker: invitation.synthetic_run_marker,
    updated_by_user_id: access.user.id,
    updated_at: now,
  }).select(MEMBERSHIP_SELECT).single();
  if (membership.error || !membership.data) throw new EnterpriseOperationError("membership_activation_failed", membership.error?.message ?? "Could not activate organisation membership.", 500);
  if (seatId) await activateEnterpriseSeat(client, seatId, access.user.id, membership.data.id);
  const accepted = await client.from("enterprise_invitations").update({
    status: "accepted",
    accepted_by_user_id: access.user.id,
    accepted_at: now,
    seat_id: seatId,
    updated_at: now,
  }).eq("id", invitation.id).eq("status", invitation.status).select(INVITATION_SELECT).single();
  if (accepted.error || !accepted.data) throw new EnterpriseOperationError("invitation_accept_failed", accepted.error?.message ?? "Could not accept invitation.", 409);
  const consentInsert = await client.from("enterprise_consent_acceptances").insert({
    organisation_id: invitation.organisation_id,
    membership_id: membership.data.id,
    invitation_id: invitation.id,
    user_id: access.user.id,
    organisation_terms_accepted: consent.organisationTermsAccepted,
    reporting_consent: consent.reportingConsent,
    adviser_insight_consent: consent.adviserInsightConsent,
    marketing_consent: consent.marketingConsent,
    communication_preferences: consent.communicationPreferences,
    source: "invitation_acceptance",
    synthetic_run_marker: invitation.synthetic_run_marker,
  }).select("id").single();
  if (consentInsert.error) throw new EnterpriseOperationError("consent_acceptance_failed", consentInsert.error.message, 500);
  if (invitation.invitation_type === "organisation_admin" && organisation.status === "pending_administrator_acceptance") {
    await client.from("enterprise_organisations").update({ status: "active", updated_at: now }).eq("id", organisation.id);
  }
  return {
    invitation: mapInvitation(accepted.data as EnterpriseInvitationRow),
    membership: mapMembership(membership.data as EnterpriseMembershipRow),
    consentAcceptanceId: consentInsert.data?.id,
  };
}

export async function transitionEnterpriseMembership(client: AnySupabaseClient, membershipId: string, nextStatus: string, reason: unknown) {
  const current = await getMembershipRow(client, membershipId);
  const normalized = normalizeChoice(nextStatus, ENTERPRISE_MEMBERSHIP_STATUSES, "Choose a valid membership status.");
  if (!isValidMembershipTransition(current.membership_status, normalized)) {
    throw new EnterpriseOperationError("invalid_membership_transition", `Cannot move membership from ${current.membership_status} to ${normalized}.`, 409);
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { membership_status: normalized, updated_at: now };
  if (normalized === "suspended") patch.suspended_at = now;
  if (normalized === "active") patch.last_active_at = now;
  if (normalized === "removed") patch.removed_at = now;
  const update = await client.from("enterprise_memberships").update(patch).eq("id", membershipId).select(MEMBERSHIP_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("membership_update_failed", update.error?.message ?? "Could not update membership.", 500);
  if (current.seat_id) {
    if (normalized === "suspended") await setEnterpriseSeatStatus(client, current.seat_id, "suspended", current.user_id);
    if (normalized === "active" && current.membership_status === "suspended") await setEnterpriseSeatStatus(client, current.seat_id, "active", current.user_id);
    if (normalized === "removed") await releaseEnterpriseSeat(client, current.seat_id, optionalText(reason) ?? "membership_removed");
  }
  return { before: mapMembership(current), after: mapMembership(update.data as EnterpriseMembershipRow) };
}

export async function createEnterpriseEnrolmentLink(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const organisationId = requiredText(input.organisationId, "Organisation is required.");
  const licenceId = requiredText(input.licenceId, "Licence is required.");
  const organisation = await getOrganisationRow(client, organisationId);
  if (organisation.status !== "active") throw new EnterpriseOperationError("organisation_link_blocked", "Only active organisations can create enrolment links.", 409);
  const licence = await getLicenceRow(client, licenceId);
  if (licence.organisation_id !== organisationId) throw new EnterpriseOperationError("licence_scope_mismatch", "Choose a licence for this organisation.", 403);
  if (!["active", "expiring"].includes(licence.licence_status)) throw new EnterpriseOperationError("licence_allocation_blocked", "Only active licences can accept enrolment claims.", 409);
  const token = randomBytes(32).toString("base64url");
  const insert = await client.from("enterprise_enrolment_links").insert({
    organisation_id: organisationId,
    licence_id: licenceId,
    display_name: requiredText(input.displayName, "Display name is required."),
    token_hash: hashInvitationToken(token),
    expires_at: optionalDateTime(input.expiresAt) ?? new Date(Date.now() + Math.max(Number(input.expiryDays ?? 14), 1) * 24 * 60 * 60 * 1000).toISOString(),
    max_claims: boundedInteger(input.maxClaims ?? 1, 1, 10000, "Claim limit must be between 1 and 10000."),
    allowed_email_domain: normalizeDomain(input.allowedEmailDomain),
    approval_required: Boolean(input.approvalRequired),
    default_role: normalizeMembershipRole(input.defaultRole ?? "organisation_member"),
    created_by_user_id: access.user.id,
    synthetic_run_marker: optionalText(input.syntheticRunMarker),
  }).select(ENROLMENT_LINK_SELECT).single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("enrolment_link_create_failed", insert.error?.message ?? "Could not create enrolment link.", 500);
  return { ...mapEnrolmentLink(insert.data as EnterpriseEnrolmentLinkRow), stagingClaimPath: buildEnterpriseEnrolmentClaimPath(token) };
}

export async function claimEnterpriseEnrolmentLink(
  client: AnySupabaseClient,
  access: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null } },
  input: Record<string, unknown>,
) {
  const link = await getEnrolmentLinkByToken(client, requiredText(input.token, "Enrolment token is required."));
  assertEnrolmentLinkClaimable(link);
  const email = normalizeEnterpriseEmail(access.user.email);
  if (!email) throw new EnterpriseOperationError("claim_identity_required", "Sign in before claiming this enrolment link.", 401);
  const domain = email.split("@")[1] ?? "";
  if (link.allowed_email_domain && domain !== link.allowed_email_domain) {
    throw new EnterpriseOperationError("claim_domain_rejected", "This enrolment link is restricted to a different email domain.", 403);
  }
  const organisation = await getOrganisationRow(client, link.organisation_id);
  if (organisation.status !== "active") throw new EnterpriseOperationError("organisation_link_blocked", "This organisation is not accepting enrolment claims.", 409);
  const consent = normaliseConsentInput(input);
  if (!consent.organisationTermsAccepted) throw new EnterpriseOperationError("organisation_terms_required", "Accept the organisation terms to continue.", 400);
  const reservation = await createEnterpriseSeatReservation(client, link.licence_id, { email, syntheticRunMarker: link.synthetic_run_marker });
  const now = new Date().toISOString();
  await assertNoActiveMembershipForUser(client, link.organisation_id, access.user.id);
  const membership = await client.from("enterprise_memberships").insert({
    organisation_id: link.organisation_id,
    licence_id: link.licence_id,
    seat_id: reservation.seatId,
    user_id: access.user.id,
    email_normalized: email,
    full_name: optionalText(access.user.user_metadata?.full_name) ?? email,
    organisation_role: normalizeMembershipRole(link.default_role),
    membership_status: "active",
    onboarding_status: "pending",
    consent_status: consent.marketingConsent === false ? "partially_accepted" : "accepted",
    joined_at: now,
    synthetic_run_marker: link.synthetic_run_marker,
    updated_by_user_id: access.user.id,
  }).select(MEMBERSHIP_SELECT).single();
  if (membership.error || !membership.data) throw new EnterpriseOperationError("enrolment_membership_failed", membership.error?.message ?? "Could not activate enrolment membership.", 500);
  await activateEnterpriseSeat(client, String(reservation.seatId), access.user.id, membership.data.id);
  const claim = await client.from("enterprise_enrolment_claims").insert({
    enrolment_link_id: link.id,
    organisation_id: link.organisation_id,
    licence_id: link.licence_id,
    membership_id: membership.data.id,
    seat_id: reservation.seatId,
    claimed_by_user_id: access.user.id,
    email_normalized: email,
    claim_status: "accepted",
    synthetic_run_marker: link.synthetic_run_marker,
  }).select("id").single();
  if (claim.error) throw new EnterpriseOperationError("enrolment_claim_failed", claim.error.message, 409);
  const used = Number(link.claims_used ?? 0) + 1;
  await client.from("enterprise_enrolment_links").update({
    claims_used: used,
    status: used >= Number(link.max_claims) ? "exhausted" : link.status,
    updated_at: now,
  }).eq("id", link.id);
  const consentInsert = await client.from("enterprise_consent_acceptances").insert({
    organisation_id: link.organisation_id,
    membership_id: membership.data.id,
    user_id: access.user.id,
    organisation_terms_accepted: consent.organisationTermsAccepted,
    reporting_consent: consent.reportingConsent,
    adviser_insight_consent: consent.adviserInsightConsent,
    marketing_consent: consent.marketingConsent,
    communication_preferences: consent.communicationPreferences,
    source: "enrolment_link_claim",
    synthetic_run_marker: link.synthetic_run_marker,
  }).select("id").single();
  if (consentInsert.error) throw new EnterpriseOperationError("consent_acceptance_failed", consentInsert.error.message, 500);
  return { membership: mapMembership(membership.data as EnterpriseMembershipRow), claimId: claim.data?.id, consentAcceptanceId: consentInsert.data?.id };
}

export async function updateEnterpriseEnrolmentLinkStatus(client: AnySupabaseClient, linkId: string, status: string) {
  const normalized = normalizeChoice(status, ENTERPRISE_ENROLMENT_LINK_STATUSES, "Choose a valid enrolment-link status.");
  const patch: Record<string, unknown> = { status: normalized, updated_at: new Date().toISOString() };
  if (normalized === "revoked") patch.revoked_at = new Date().toISOString();
  const update = await client.from("enterprise_enrolment_links").update(patch).eq("id", linkId).select(ENROLMENT_LINK_SELECT).single();
  if (update.error || !update.data) throw new EnterpriseOperationError("enrolment_link_update_failed", update.error?.message ?? "Could not update enrolment link.", 500);
  return mapEnrolmentLink(update.data as EnterpriseEnrolmentLinkRow);
}

export async function saveEnterpriseView(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const shareScope = normalizeChoice(input.shareScope ?? "private", ["private", "organisation", "platform"] as const, "Choose a valid saved-view sharing option.");
  const filters = sanitizeEnterpriseFilters(input.filters);
  const organisationId = optionalText(input.organisationId);
  const scopedIds = access.enterpriseScope?.organisationIds ?? [];
  if (shareScope === "platform" && access.enterpriseScope?.organisationScoped) {
    throw new EnterpriseOperationError("saved_view_scope_denied", "Organisation-scoped users cannot create platform-wide saved views.", 403);
  }
  if (shareScope === "organisation" && (!organisationId || (access.enterpriseScope?.organisationScoped && !scopedIds.includes(organisationId)))) {
    throw new EnterpriseOperationError("saved_view_scope_required", "Organisation-shared views require an organisation scope.", 400);
  }
  const insert = await client
    .from("enterprise_saved_views")
    .insert({
      owner_user_id: access.user.id,
      name: requiredText(input.name, "Saved view name is required."),
      description: optionalText(input.description),
      view_type: normalizeChoice(input.viewType ?? "portfolio", ["portfolio", "overview", "organisations", "licences", "users", "invitations", "adoption", "reports", "consent", "renewals", "settings"] as const, "Choose a valid saved-view workspace."),
      filters,
      sort_config: sanitizeJsonObject(input.sortConfig),
      visible_columns: Array.isArray(input.visibleColumns) ? input.visibleColumns.map(String).slice(0, 30) : [],
      organisation_id: organisationId,
      share_scope: shareScope,
      is_default: Boolean(input.isDefault),
      synthetic_run_marker: optionalText(input.syntheticRunMarker),
    })
    .select("id,name,description,view_type,filters,sort_config,visible_columns,organisation_id,share_scope,is_default,last_used_at,created_at,updated_at")
    .single();
  if (insert.error || !insert.data) throw new EnterpriseOperationError("saved_view_failed", insert.error?.message ?? "Could not save view.", 500);
  return mapSavedView(insert.data as EnterpriseSavedViewRow);
}

export async function updateEnterpriseView(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const viewId = requiredText(input.viewId, "Saved view is required.");
  const current = await getEnterpriseSavedViewRow(client, viewId);
  assertSavedViewOwner(access, current);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) patch.name = requiredText(input.name, "Saved view name is required.");
  if (input.description !== undefined) patch.description = optionalText(input.description);
  if (input.filters !== undefined) patch.filters = sanitizeEnterpriseFilters(input.filters);
  if (input.sortConfig !== undefined) patch.sort_config = sanitizeJsonObject(input.sortConfig);
  if (input.visibleColumns !== undefined) patch.visible_columns = Array.isArray(input.visibleColumns) ? input.visibleColumns.map(String).slice(0, 30) : [];
  if (input.isDefault !== undefined) patch.is_default = Boolean(input.isDefault);
  if (input.touch === true) patch.last_used_at = new Date().toISOString();
  const update = await client
    .from("enterprise_saved_views")
    .update(patch)
    .eq("id", viewId)
    .select("id,name,description,view_type,filters,sort_config,visible_columns,organisation_id,share_scope,is_default,last_used_at,created_at,updated_at")
    .single();
  if (update.error || !update.data) throw new EnterpriseOperationError("saved_view_update_failed", update.error?.message ?? "Could not update saved view.", 500);
  return mapSavedView(update.data as EnterpriseSavedViewRow);
}

export async function deleteEnterpriseView(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const viewId = requiredText(input.viewId, "Saved view is required.");
  const current = await getEnterpriseSavedViewRow(client, viewId);
  assertSavedViewOwner(access, current);
  const deleted = await client.from("enterprise_saved_views").delete().eq("id", viewId).select("id").single();
  if (deleted.error) throw new EnterpriseOperationError("saved_view_delete_failed", deleted.error.message, 500);
  return { id: viewId };
}

export async function buildEnterpriseReportExportDecision(client: AnySupabaseClient, access: AdminAccessState, input: Record<string, unknown>) {
  const portfolio = await loadEnterprisePortfolio(client, access);
  const reportType = normalizeChoice(input.reportType ?? "portfolio", ENTERPRISE_REPORT_TYPES, "Choose a governed report type.");
  const filters = sanitizeEnterpriseFilters(input.filters);
  const scopedOrganisations = applyEnterpriseReportFilters(portfolio.organisations, filters);
  const cohort = scopedOrganisations.length;
  const minimumCohort = Math.max(...scopedOrganisations.map((org) => portfolio.consent[org.id]?.minimumReportingCohort ?? ENTERPRISE_REPORT_MINIMUM_COHORT), ENTERPRISE_REPORT_MINIMUM_COHORT);
  const consentAllowed = scopedOrganisations.length > 0 && scopedOrganisations.every((org) => {
    const consent = portfolio.consent[org.id];
    return Boolean(consent?.reportingConsent && consent?.exportPermission);
  });
  const thresholdAllowed = cohort >= minimumCohort;
  const exportAllowed = consentAllowed && thresholdAllowed;
  const reportRun = await client.from("enterprise_report_runs").insert({
    report_type: reportType,
    organisation_id: scopedOrganisations.length === 1 ? scopedOrganisations[0]?.id : null,
    actor_user_id: access.user.id,
    actor_scope: access.enterpriseScope?.organisationScoped ? "organisation" : "platform",
    filters,
    cohort_count: cohort,
    minimum_cohort: minimumCohort,
    consent_result: consentAllowed ? "passed" : "blocked",
    threshold_result: thresholdAllowed ? "passed" : "blocked",
    policy_result: exportAllowed ? "allowed" : "blocked",
    suppression_applied: !thresholdAllowed,
    synthetic_run_marker: optionalText(input.syntheticRunMarker),
  }).select("id").single();
  if (reportRun.error) throw new EnterpriseOperationError("report_run_failed", reportRun.error.message, 500);
  let exportEvent = null;
  let csvPreview = null;
  if (exportAllowed) {
    const safeFilename = safeExportFilename(reportType);
    const event = await client.from("enterprise_export_events").insert({
      report_run_id: reportRun.data?.id,
      report_type: reportType,
      organisation_id: scopedOrganisations.length === 1 ? scopedOrganisations[0]?.id : null,
      actor_user_id: access.user.id,
      export_format: "csv",
      safe_filename: safeFilename,
      filters,
      aggregate_count: scopedOrganisations.length,
      policy_result: "allowed",
      consent_result: "passed",
      threshold_result: "passed",
      synthetic_run_marker: optionalText(input.syntheticRunMarker),
    }).select("id,safe_filename,created_at").single();
    if (event.error) throw new EnterpriseOperationError("export_event_failed", event.error.message, 500);
    exportEvent = event.data;
    csvPreview = buildGovernedCsv(reportType, scopedOrganisations, portfolio);
  }
  return {
    ok: exportAllowed,
    code: exportAllowed ? "export_ready" : "export_blocked",
    message: exportAllowed
      ? "Aggregated CSV export is ready. Private vault values and document contents are excluded."
      : !thresholdAllowed
        ? "Results are suppressed because this cohort is below the minimum reporting threshold."
        : "Export blocked: organisation reporting/export consent is not met.",
    reportType,
    cohort,
    minimumCohort,
    consentResult: consentAllowed ? "passed" : "blocked",
    thresholdResult: thresholdAllowed ? "passed" : "blocked",
    reportRunId: reportRun.data?.id,
    exportEvent,
    csvPreview,
    privateVaultFieldsExcluded: true,
  };
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

function buildEnterpriseReportCatalogue(access: AdminAccessState) {
  const canExport = access.capabilities.includes("enterprise.export.request");
  return ENTERPRISE_REPORT_TYPES.map((type) => ({
    type,
    label: labeliseReportType(type),
    exportAllowed: canExport && type !== "audit_activity",
    minimumCohort: ENTERPRISE_REPORT_MINIMUM_COHORT,
    aggregation: type === "audit_activity" ? "event_summary" : "organisation_aggregate",
    privateVaultFieldsExcluded: true,
  }));
}

function buildEnterpriseReportSummaries(
  organisations: ReturnType<typeof mapOrganisation>[],
  licences: ReturnType<typeof mapLicence>[],
  invitations: ReturnType<typeof mapInvitation>[],
  memberships: ReturnType<typeof mapMembership>[],
  enrolmentLinks: ReturnType<typeof mapEnrolmentLink>[],
  consentByOrg: Map<string, EnterpriseConsentRow>,
  adoptionBands: ReturnType<typeof buildAdoptionBands>,
) {
  return {
    portfolio: organisations.length,
    licenceUtilisation: licences.map((licence) => ({
      organisationId: licence.organisationId,
      licenceId: licence.id,
      plan: licence.plan,
      purchasedSeats: licence.purchasedSeats,
      activeSeats: licence.activeSeats,
      invitedSeats: licence.invitedSeats,
      suspendedSeats: licence.suspendedSeats,
      availableSeats: licence.availableSeats,
      utilisationBand: utilisationBandFromNumbers(licence.activeSeats + licence.invitedSeats + licence.suspendedSeats, licence.purchasedSeats),
    })),
    invitationStatus: countBy(invitations, (item) => item.status),
    membershipStatus: countBy(memberships, (item) => item.status),
    enrolmentLinkStatus: countBy(enrolmentLinks, (item) => item.status),
    adoptionBands,
    consentReadiness: organisations.map((org) => {
      const consent = consentByOrg.get(org.id);
      return {
        organisationId: org.id,
        organisationName: org.name,
        reportingEligible: Boolean(consent?.reporting_consent && consent?.adviser_insight_consent),
        exportEligible: Boolean(consent?.reporting_consent && consent?.export_permission),
        minimumCohort: consent?.minimum_reporting_cohort ?? ENTERPRISE_REPORT_MINIMUM_COHORT,
      };
    }),
  };
}

function buildEnterpriseRiskSummaries(
  organisations: ReturnType<typeof mapOrganisation>[],
  licences: ReturnType<typeof mapLicence>[],
  invitations: ReturnType<typeof mapInvitation>[],
  memberships: ReturnType<typeof mapMembership>[],
  consentByOrg: Map<string, EnterpriseConsentRow>,
  adoptionBands: ReturnType<typeof buildAdoptionBands>,
) {
  return organisations.map((org) => {
    const orgLicences = licences.filter((licence) => licence.organisationId === org.id);
    const orgInvitations = invitations.filter((invitation) => invitation.organisationId === org.id);
    const orgMemberships = memberships.filter((membership) => membership.organisationId === org.id);
    const adoption = adoptionBands.find((band) => band.organisationId === org.id);
    const reasons: string[] = [];
    if (org.risk !== "normal") reasons.push(`Manual organisation risk is ${org.risk}.`);
    if (orgLicences.some((licence) => ["due_30", "overdue"].includes(licence.renewalRisk))) reasons.push("Licence renewal is due soon or overdue.");
    if (orgLicences.some((licence) => ["past_due", "suspended"].includes(licence.billingStatus))) reasons.push("Billing status requires attention.");
    if (orgInvitations.filter((invite) => ["scheduled", "sent", "delivered"].includes(invite.status)).length >= 5) reasons.push("Pending invitation backlog.");
    if (adoption?.band === "low") reasons.push("Low adoption band.");
    if (!consentByOrg.get(org.id)?.reporting_consent) reasons.push("Reporting consent is restricted.");
    if (orgMemberships.some((member) => member.status === "suspended")) reasons.push("Suspended membership present.");
    const band = reasons.some((reason) => /overdue|restricted|past_due|suspended/i.test(reason))
      ? "critical"
      : reasons.length >= 2
        ? "at_risk"
        : reasons.length === 1
          ? "watch"
          : "normal";
    return {
      organisationId: org.id,
      organisationName: org.name,
      band,
      reasons,
    };
  });
}

function sanitizeEnterpriseFilters(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const allowed = new Set<string>(ENTERPRISE_FILTER_KEYS);
  return Object.fromEntries(Object.entries(input)
    .filter(([key]) => allowed.has(key))
    .map(([key, entry]) => [key, typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" ? entry : ""])
    .filter(([, entry]) => entry !== ""));
}

function sanitizeJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => /^[a-zA-Z0-9_.-]{1,60}$/.test(key))
    .map(([key, entry]) => [key, typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" ? entry : ""]));
}

function applyEnterpriseReportFilters(organisations: ReturnType<typeof mapOrganisation>[], filters: Record<string, unknown>) {
  return organisations.filter((org) => {
    if (filters.organisation && !`${org.name} ${org.legalName} ${org.tradingName ?? ""}`.toLowerCase().includes(String(filters.organisation).toLowerCase())) return false;
    if (filters.status && org.status !== filters.status) return false;
    if (filters.type && org.type !== filters.type) return false;
    if (filters.country && org.country !== filters.country) return false;
    if (filters.accountOwner && org.accountOwner !== filters.accountOwner) return false;
    if (filters.risk && org.risk !== filters.risk) return false;
    return true;
  });
}

function buildGovernedCsv(reportType: string, organisations: ReturnType<typeof mapOrganisation>[], portfolio: Awaited<ReturnType<typeof loadEnterprisePortfolio>>) {
  const rows = organisations.map((org) => {
    const consent = portfolio.consent[org.id];
    const orgLicences = portfolio.licences.filter((licence) => licence.organisationId === org.id);
    const purchasedSeats = orgLicences.reduce((sum, licence) => sum + licence.purchasedSeats, 0);
    const activeSeats = orgLicences.reduce((sum, licence) => sum + licence.activeSeats, 0);
    return [
      reportType,
      org.name,
      org.type,
      org.status,
      org.risk,
      String(purchasedSeats),
      String(activeSeats),
      consent?.reportingConsent ? "reporting-consented" : "reporting-restricted",
    ];
  });
  const header = ["report_type", "organisation", "type", "status", "risk", "purchased_seats", "active_seats", "consent_status"];
  return [header, ...rows].map((row) => row.map(csvSafeCell).join(",")).join("\n");
}

function csvSafeCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, "\"\"");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe}"`;
}

function safeExportFilename(reportType: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `legacy-fortress-${reportType.replace(/[^a-z0-9_-]/gi, "-")}-${stamp}.csv`;
}

function mapSavedView(row: EnterpriseSavedViewRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    view_type: row.view_type,
    filters: row.filters ?? {},
    sortConfig: row.sort_config ?? {},
    visibleColumns: row.visible_columns ?? [],
    organisationId: row.organisation_id ?? null,
    shareScope: row.share_scope ?? "private",
    isDefault: Boolean(row.is_default),
    lastUsedAt: row.last_used_at ?? null,
    created_at: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

async function getEnterpriseSavedViewRow(client: AnySupabaseClient, viewId: string) {
  const res = await client
    .from("enterprise_saved_views")
    .select("id,name,description,view_type,filters,sort_config,visible_columns,organisation_id,share_scope,is_default,last_used_at,owner_user_id,created_at,updated_at")
    .eq("id", viewId)
    .maybeSingle();
  if (res.error) throw new EnterpriseOperationError("saved_view_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("saved_view_not_found", "Saved view not found.", 404);
  return res.data as EnterpriseSavedViewRow & { owner_user_id?: string | null };
}

function assertSavedViewOwner(access: AdminAccessState, view: { owner_user_id?: string | null; share_scope?: string | null }) {
  if (view.owner_user_id === access.user.id) return;
  if (view.share_scope === "platform" && access.capabilities.includes("enterprise.export.request")) return;
  throw new EnterpriseOperationError("saved_view_denied", "You cannot modify this saved view.", 403);
}

function canAccessSavedView(access: AdminAccessState, view: EnterpriseSavedViewRow & { owner_user_id?: string | null }, scopedOrganisationIds: string[]) {
  if (view.owner_user_id === access.user.id) return true;
  if (view.share_scope === "platform") return !access.enterpriseScope?.organisationScoped;
  if (view.share_scope === "organisation") {
    return Boolean(view.organisation_id && (!access.enterpriseScope?.organisationScoped || scopedOrganisationIds.includes(view.organisation_id)));
  }
  return false;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = key(row);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function utilisationBandFromNumbers(committed: number, purchased: number) {
  if (purchased <= 0 && committed > 0) return "over_capacity";
  if (purchased <= 0) return "0_25";
  const percentage = Math.round((committed / purchased) * 100);
  if (percentage > 100) return "over_capacity";
  if (percentage <= 25) return "0_25";
  if (percentage <= 50) return "26_50";
  if (percentage <= 75) return "51_75";
  if (percentage <= 90) return "76_90";
  return "91_100";
}

function labeliseReportType(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
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
  const committedSeats = committedSeatsForRow(row);
  const availableSeats = Math.max(Number(row.purchased_seats ?? 0) - committedSeats, 0);
  return {
    id: row.id,
    organisationId: row.organisation_id,
    plan: row.licence_plan,
    customPlanName: row.custom_plan_name,
    contractReference: row.contract_reference,
    billingReference: row.billing_reference,
    startDate: row.start_date,
    renewalDate: row.renewal_date,
    endDate: row.end_date,
    renewalNoticeDays: Number(row.renewal_notice_days ?? 90),
    autoRenew: Boolean(row.auto_renew),
    renewalNotes: row.renewal_notes,
    purchasedSeats: Number(row.purchased_seats ?? 0),
    allocatedSeats: committedSeats,
    committedSeats,
    activeSeats: Number(row.active_seats ?? 0),
    invitedSeats: Number(row.invited_seats ?? 0),
    suspendedSeats: Number(row.suspended_seats ?? 0),
    availableSeats,
    unclaimedSeats: availableSeats,
    billingStatus: row.billing_status,
    status: row.licence_status,
    accountOwner: row.account_owner,
    renewalRisk: renewalRisk(row.renewal_date, row.licence_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    scope: row.scope ?? "organisation",
    accessExpiresAt: row.access_expires_at ?? null,
    resendCount: Number(row.resend_count ?? 0),
    lastResentAt: row.last_resent_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    failedAt: row.failed_at ?? null,
    seatId: row.seat_id ?? null,
    internalReference: row.internal_reference ?? null,
    department: row.department ?? null,
    syntheticRunMarker: row.synthetic_run_marker ?? null,
    createdAt: row.created_at,
  };
}

function mapMembership(row: EnterpriseMembershipRow) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    licenceId: row.licence_id,
    seatId: row.seat_id,
    userId: row.user_id,
    email: row.email_normalized,
    fullName: row.full_name,
    organisationRole: row.organisation_role,
    status: row.membership_status,
    onboardingStatus: row.onboarding_status,
    consentStatus: row.consent_status,
    internalReference: row.internal_reference,
    department: row.department,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
    suspendedAt: row.suspended_at,
    removedAt: row.removed_at,
    lastActiveAt: row.last_active_at,
    accessExpiresAt: row.access_expires_at,
    syntheticRunMarker: row.synthetic_run_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrolmentLink(row: EnterpriseEnrolmentLinkRow) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    licenceId: row.licence_id,
    displayName: row.display_name,
    status: row.status,
    expiresAt: row.expires_at,
    maxClaims: Number(row.max_claims ?? 0),
    claimsUsed: Number(row.claims_used ?? 0),
    allowedEmailDomain: row.allowed_email_domain,
    approvalRequired: row.approval_required,
    defaultRole: row.default_role,
    revokedAt: row.revoked_at,
    syntheticRunMarker: row.synthetic_run_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConsentAcceptance(row: EnterpriseConsentAcceptanceRow) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    membershipId: row.membership_id,
    invitationId: row.invitation_id,
    userId: row.user_id,
    consentVersion: row.consent_version,
    organisationTermsAccepted: row.organisation_terms_accepted,
    reportingConsent: row.reporting_consent,
    adviserInsightConsent: row.adviser_insight_consent,
    marketingConsent: row.marketing_consent,
    communicationPreferences: row.communication_preferences ?? {},
    source: row.source,
    syntheticRunMarker: row.synthetic_run_marker,
    acceptedAt: row.accepted_at,
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

function requiredDate(value: unknown, message: string) {
  const text = requiredText(value, message);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new EnterpriseOperationError("invalid_date", message, 400);
  return text.slice(0, 10);
}

function optionalDate(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new EnterpriseOperationError("invalid_date", "Enter a valid date.", 400);
  return text.slice(0, 10);
}

function requiredPositiveInteger(value: unknown, message: string) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 1) throw new EnterpriseOperationError("invalid_seat_quantity", message, 400);
  return number;
}

function boundedInteger(value: unknown, min: number, max: number, message: string) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < min || number > max) throw new EnterpriseOperationError("invalid_number", message, 400);
  return number;
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

function normalizeEnterpriseRole(value: unknown) {
  return normalizeChoice(value, ENTERPRISE_ORGANISATION_ROLES, "Choose a valid organisation role.");
}

function normalizeMembershipRole(value: unknown) {
  const role = normalizeEnterpriseRole(value);
  if (role === "enterprise_user") return "organisation_member";
  if (role === "licence_manager") return "organisation_licence_manager";
  if (role === "user_manager") return "organisation_user_manager";
  if (role === "reporting_viewer") return "organisation_reporting_viewer";
  if (role === "read_only_auditor") return "organisation_auditor";
  return role;
}

function optionalDateTime(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new EnterpriseOperationError("invalid_date", "Enter a valid date and time.", 400);
  return date.toISOString();
}

function normalizeDomain(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) throw new EnterpriseOperationError("invalid_domain", "Enter a valid email domain.", 400);
  return normalized;
}

function assertInvitationCanBeAccepted(invitation: EnterpriseInvitationRow) {
  if (!["sent", "delivered"].includes(invitation.status)) {
    throw new EnterpriseOperationError("invitation_not_active", "This invitation is no longer active.", invitation.status === "accepted" ? 409 : 410);
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    throw new EnterpriseOperationError("invitation_expired", "This invitation has expired.", 410);
  }
}

function assertEnrolmentLinkClaimable(link: EnterpriseEnrolmentLinkRow) {
  if (link.status !== "active") {
    throw new EnterpriseOperationError("enrolment_link_not_active", "This enrolment link is not active.", 410);
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    throw new EnterpriseOperationError("enrolment_link_expired", "This enrolment link has expired.", 410);
  }
  if (Number(link.claims_used ?? 0) >= Number(link.max_claims ?? 0)) {
    throw new EnterpriseOperationError("enrolment_link_exhausted", "This enrolment link has already reached its claim limit.", 409);
  }
}

function normaliseConsentInput(input: Record<string, unknown>) {
  return {
    organisationTermsAccepted: Boolean(input.organisationTermsAccepted ?? input.termsAccepted),
    reportingConsent: Boolean(input.reportingConsent),
    adviserInsightConsent: Boolean(input.adviserInsightConsent),
    marketingConsent: Boolean(input.marketingConsent),
    communicationPreferences: typeof input.communicationPreferences === "object" && input.communicationPreferences !== null
      ? input.communicationPreferences as Record<string, unknown>
      : {},
  };
}

function isValidMembershipTransition(from: string, to: string) {
  if (from === to) return true;
  const allowed: Record<string, string[]> = {
    invited: ["active", "removed"],
    active: ["suspended", "removed"],
    suspended: ["active", "removed"],
    removed: [],
  };
  return (allowed[from] ?? []).includes(to);
}

function buildEnterpriseInvitationAcceptPath(token: string) {
  return `/accept-invitation?type=enterprise&token=${encodeURIComponent(token)}`;
}

function buildEnterpriseEnrolmentClaimPath(token: string) {
  return `/accept-invitation?type=enrolment&token=${encodeURIComponent(token)}`;
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

async function getLicenceRow(client: AnySupabaseClient, licenceId: string) {
  const res = await client.from("enterprise_licences").select(LICENCE_SELECT).eq("id", licenceId).maybeSingle();
  if (res.error) throw new EnterpriseOperationError("licence_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("licence_not_found", "Licence not found.", 404);
  return res.data as EnterpriseLicenceRow;
}

async function getInvitationRow(client: AnySupabaseClient, invitationId: string) {
  const res = await client.from("enterprise_invitations").select(INVITATION_SELECT).eq("id", invitationId).maybeSingle();
  if (res.error) throw new EnterpriseOperationError("invitation_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("invitation_not_found", "Invitation not found.", 404);
  return res.data as EnterpriseInvitationRow;
}

async function getMembershipRow(client: AnySupabaseClient, membershipId: string) {
  const res = await client.from("enterprise_memberships").select(MEMBERSHIP_SELECT).eq("id", membershipId).maybeSingle();
  if (res.error) throw new EnterpriseOperationError("membership_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("membership_not_found", "Membership not found.", 404);
  return res.data as EnterpriseMembershipRow;
}

async function assertNoActiveMembershipForUser(client: AnySupabaseClient, organisationId: string, userId: string) {
  const res = await client
    .from("enterprise_memberships")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .in("membership_status", ["invited", "active", "suspended"])
    .limit(1);
  if (res.error) throw new EnterpriseOperationError("membership_duplicate_check_failed", res.error.message, 500);
  if ((res.data ?? []).length > 0) {
    throw new EnterpriseOperationError("duplicate_membership", "This user already has active organisation access.", 409);
  }
}

async function getInvitationByToken(client: AnySupabaseClient, token: string) {
  const res = await client.from("enterprise_invitations").select(INVITATION_SELECT).eq("token_hash", hashInvitationToken(token)).maybeSingle();
  if (res.error) throw new EnterpriseOperationError("invitation_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("invitation_not_found", "Invitation not found.", 404);
  return res.data as EnterpriseInvitationRow;
}

async function getEnrolmentLinkByToken(client: AnySupabaseClient, token: string) {
  const res = await client.from("enterprise_enrolment_links").select(ENROLMENT_LINK_SELECT).eq("token_hash", hashInvitationToken(token)).maybeSingle();
  if (res.error) throw new EnterpriseOperationError("enrolment_link_query_failed", res.error.message, 500);
  if (!res.data) throw new EnterpriseOperationError("enrolment_link_not_found", "Enrolment link not found.", 404);
  return res.data as EnterpriseEnrolmentLinkRow;
}

async function assertNoOpenLicenceForOrganisation(client: AnySupabaseClient, organisationId: string, excludeId?: string) {
  let query = client
    .from("enterprise_licences")
    .select("id")
    .eq("organisation_id", organisationId)
    .in("licence_status", ["draft", "pending_approval", "active", "expiring", "suspended"])
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const res = await query;
  if (res.error) throw new EnterpriseOperationError("licence_duplicate_check_failed", res.error.message, 500);
  if ((res.data ?? []).length > 0) throw new EnterpriseOperationError("duplicate_open_licence", "This organisation already has an open licence.", 409);
}

function committedSeatsForRow(row: Pick<EnterpriseLicenceRow, "active_seats" | "invited_seats" | "suspended_seats" | "allocated_seats">) {
  const derived = Number(row.active_seats ?? 0) + Number(row.invited_seats ?? 0) + Number(row.suspended_seats ?? 0);
  return Math.max(derived, Number(row.allocated_seats ?? 0));
}

async function activateEnterpriseSeat(client: AnySupabaseClient, seatId: string, userId: string, membershipId: string) {
  const seatRes = await client.from("enterprise_seats").select("id,licence_id,seat_status").eq("id", seatId).maybeSingle();
  if (seatRes.error) throw new EnterpriseOperationError("seat_query_failed", seatRes.error.message, 500);
  if (!seatRes.data) throw new EnterpriseOperationError("seat_not_found", "Seat reservation not found.", 404);
  if (seatRes.data.seat_status !== "invited") throw new EnterpriseOperationError("seat_not_activatable", "Only invited seats can be activated.", 409);
  const licence = await getLicenceRow(client, String(seatRes.data.licence_id));
  const updateSeat = await client.from("enterprise_seats").update({
    user_id: userId,
    membership_id: membershipId,
    seat_status: "active",
    activated_at: new Date().toISOString(),
  }).eq("id", seatId);
  if (updateSeat.error) throw new EnterpriseOperationError("seat_activation_failed", updateSeat.error.message, 500);
  const invited = Math.max(Number(licence.invited_seats ?? 0) - 1, 0);
  const active = Number(licence.active_seats ?? 0) + 1;
  await client.from("enterprise_licences").update({
    invited_seats: invited,
    active_seats: active,
    allocated_seats: active + invited + Number(licence.suspended_seats ?? 0),
    updated_at: new Date().toISOString(),
  }).eq("id", licence.id);
}

async function setEnterpriseSeatStatus(client: AnySupabaseClient, seatId: string, status: "active" | "suspended", userId: string) {
  const seatRes = await client.from("enterprise_seats").select("id,licence_id,seat_status").eq("id", seatId).maybeSingle();
  if (seatRes.error || !seatRes.data) throw new EnterpriseOperationError("seat_query_failed", seatRes.error?.message ?? "Seat not found.", seatRes.error ? 500 : 404);
  const licence = await getLicenceRow(client, String(seatRes.data.licence_id));
  const from = String(seatRes.data.seat_status);
  if (from === status) return;
  const patch: Record<string, unknown> = { seat_status: status, user_id: userId };
  if (status === "suspended") patch.suspended_at = new Date().toISOString();
  if (status === "active") patch.activated_at = new Date().toISOString();
  const updateSeat = await client.from("enterprise_seats").update(patch).eq("id", seatId);
  if (updateSeat.error) throw new EnterpriseOperationError("seat_status_failed", updateSeat.error.message, 500);
  const active = Number(licence.active_seats ?? 0) + (status === "active" ? 1 : -1);
  const suspended = Number(licence.suspended_seats ?? 0) + (status === "suspended" ? 1 : -1);
  const invited = Number(licence.invited_seats ?? 0);
  await client.from("enterprise_licences").update({
    active_seats: Math.max(active, 0),
    suspended_seats: Math.max(suspended, 0),
    allocated_seats: Math.max(active, 0) + invited + Math.max(suspended, 0),
    updated_at: new Date().toISOString(),
  }).eq("id", licence.id);
}

async function releaseEnterpriseSeat(client: AnySupabaseClient, seatId: string, reason: string) {
  const seatRes = await client.from("enterprise_seats").select("id,licence_id,seat_status").eq("id", seatId).maybeSingle();
  if (seatRes.error) throw new EnterpriseOperationError("seat_query_failed", seatRes.error.message, 500);
  if (!seatRes.data || seatRes.data.seat_status === "removed") return;
  const licence = await getLicenceRow(client, String(seatRes.data.licence_id));
  const status = String(seatRes.data.seat_status);
  const updateSeat = await client.from("enterprise_seats").update({
    seat_status: "removed",
    released_at: new Date().toISOString(),
  }).eq("id", seatId);
  if (updateSeat.error) throw new EnterpriseOperationError("seat_release_failed", updateSeat.error.message, 500);
  const invited = Number(licence.invited_seats ?? 0) - (status === "invited" ? 1 : 0);
  const active = Number(licence.active_seats ?? 0) - (status === "active" ? 1 : 0);
  const suspended = Number(licence.suspended_seats ?? 0) - (status === "suspended" ? 1 : 0);
  await client.from("enterprise_licences").update({
    invited_seats: Math.max(invited, 0),
    active_seats: Math.max(active, 0),
    suspended_seats: Math.max(suspended, 0),
    allocated_seats: Math.max(invited, 0) + Math.max(active, 0) + Math.max(suspended, 0),
    renewal_notes: appendReason(licence.renewal_notes, reason),
    updated_at: new Date().toISOString(),
  }).eq("id", licence.id);
}

function assertSeatEntitlement(purchasedSeats: number, committedSeats: number) {
  if (committedSeats > purchasedSeats) {
    throw new EnterpriseOperationError("seat_entitlement_exceeded", `Purchased seats cannot be below committed usage (${committedSeats}).`, 409);
  }
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

function isValidLicenceTransition(from: string, to: string) {
  if (from === to) return true;
  const allowed: Record<string, string[]> = {
    draft: ["pending_approval", "cancelled"],
    pending_approval: ["active", "cancelled"],
    active: ["expiring", "suspended", "cancelled", "expired"],
    expiring: ["active", "cancelled", "expired"],
    suspended: ["active", "cancelled"],
    cancelled: [],
    expired: [],
  };
  return (allowed[from] ?? []).includes(to);
}

function renewalRisk(renewalDate: string, status: string) {
  if (status === "cancelled" || status === "expired") return status;
  const days = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "overdue";
  if (days <= 30) return "due_30";
  if (days <= 60) return "due_60";
  if (days <= 90) return "due_90";
  return "normal";
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

function changedLicenceFields(before: EnterpriseLicenceRow, after: EnterpriseLicenceRow) {
  const fields: Array<keyof EnterpriseLicenceRow> = [
    "licence_plan",
    "custom_plan_name",
    "contract_reference",
    "billing_reference",
    "start_date",
    "renewal_date",
    "end_date",
    "renewal_notice_days",
    "auto_renew",
    "purchased_seats",
    "billing_status",
    "licence_status",
    "account_owner",
  ];
  return fields.filter((field) => before[field] !== after[field]).map(String);
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
