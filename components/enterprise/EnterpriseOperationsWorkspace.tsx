"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import WorkspaceSwitcher from "@/components/navigation/WorkspaceSwitcher";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type EnterprisePortfolio = {
  summary: {
    organisations: number;
    activeLicences: number;
    renewalsDue: number;
    pendingInvitations: number;
    atRiskOrganisations: number;
    consentRestricted: number;
    seats: {
      purchased: number;
      allocated: number;
      active: number;
      invited: number;
      suspended: number;
      available?: number;
    };
  };
  organisations: EnterpriseOrganisation[];
  licences: EnterpriseLicence[];
  invitations: EnterpriseInvitation[];
  memberships: EnterpriseMembership[];
  enrolmentLinks: EnterpriseEnrolmentLink[];
  consent: Record<string, EnterpriseConsent>;
  adoptionBands: Array<{
    organisationId: string;
    organisationName: string;
    band: "high" | "medium" | "low";
    acceptanceRate: number;
    seatUtilisation: number;
    consentRestricted: boolean;
  }>;
  savedViews: Array<{ id: string; name: string; view_type: string; filters: Record<string, unknown>; created_at: string }>;
  privacyBoundary: {
    vaultContentExcluded: boolean;
    documentContentExcluded: boolean;
    financialValuesExcluded: boolean;
    reportingMinimumCohort: number;
  };
};

type EnterpriseOrganisation = {
  id: string;
  name: string;
  legalName: string;
  tradingName: string | null;
  type: string;
  typeOther: string | null;
  registrationNumber: string | null;
  country: string;
  registeredAddress: Record<string, unknown>;
  operatingAddress: Record<string, unknown>;
  sameOperatingAddress: boolean;
  status: string;
  risk: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactTelephone: string | null;
  website: string | null;
  accountOwner: string | null;
  contractReference: string | null;
  customerReference: string | null;
  onboardingStatus: string;
  onboardingNotes: string | null;
  nominatedAdminName: string | null;
  nominatedAdminEmail: string | null;
  nominatedAdminRequireMfa: boolean;
  nominatedAdminExpiryDays: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EnterpriseLicence = {
  id: string;
  organisationId: string;
  plan: string;
  customPlanName: string | null;
  contractReference: string | null;
  billingReference: string | null;
  startDate: string;
  renewalDate: string;
  endDate: string | null;
  renewalNoticeDays: number;
  autoRenew: boolean;
  renewalNotes: string | null;
  purchasedSeats: number;
  allocatedSeats: number;
  committedSeats: number;
  activeSeats: number;
  invitedSeats: number;
  suspendedSeats: number;
  availableSeats: number;
  unclaimedSeats: number;
  billingStatus: string;
  status: string;
  accountOwner: string | null;
  renewalRisk: string;
  createdAt: string;
  updatedAt: string;
};

type EnterpriseInvitation = {
  id: string;
  organisationId: string;
  licenceId: string | null;
  email: string;
  fullName: string | null;
  invitationType: string;
  roleTemplate: string;
  status: string;
  expiresAt: string;
  requireMfa: boolean;
  sentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  failureReason: string | null;
  seatId: string | null;
  resendCount: number;
  department: string | null;
  internalReference: string | null;
  stagingAcceptPath?: string;
  createdAt: string;
};

type EnterpriseMembership = {
  id: string;
  organisationId: string;
  licenceId: string | null;
  seatId: string | null;
  email: string;
  fullName: string | null;
  organisationRole: string;
  status: string;
  onboardingStatus: string;
  consentStatus: string;
  internalReference: string | null;
  department: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
};

type EnterpriseEnrolmentLink = {
  id: string;
  organisationId: string;
  licenceId: string;
  displayName: string;
  status: string;
  expiresAt: string;
  maxClaims: number;
  claimsUsed: number;
  allowedEmailDomain: string | null;
  defaultRole: string;
  stagingClaimPath?: string;
};

type EnterpriseConsent = {
  adviserInsightConsent: boolean;
  marketingConsent: boolean;
  reportingConsent: boolean;
  exportPermission: boolean;
  minimumReportingCohort: number;
  retentionRule: string;
};

type EnterpriseFilters = {
  organisation: string;
  status: string;
  type: string;
  licence: string;
  licencePlan: string;
  billingStatus: string;
  renewal: string;
  utilisation: string;
  invitation: string;
  adoption: string;
  consent: string;
  risk: string;
  country: string;
  accountOwner: string;
  onboarding: string;
};

type EnterpriseOrgForm = {
  legalName: string;
  tradingName: string;
  organisationType: string;
  organisationTypeOther: string;
  registrationNumber: string;
  country: string;
  website: string;
  primaryContactTelephone: string;
  registeredAddress: AddressForm;
  operatingAddress: AddressForm;
  sameOperatingAddress: boolean;
  primaryContactName: string;
  primaryContactEmail: string;
  internalAccountOwner: string;
  contractReference: string;
  customerReference: string;
  onboardingStatus: string;
  onboardingNotes: string;
  riskStatus: string;
  initialStatus: string;
  nominatedAdminName: string;
  nominatedAdminEmail: string;
  nominatedAdminRequireMfa: boolean;
  nominatedAdminExpiryDays: number;
  adviserInsightConsent: boolean;
  marketingConsent: boolean;
  reportingConsent: boolean;
  exportPermission: boolean;
  minimumReportingCohort: number;
};

type AddressForm = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
};

type EnterpriseLicenceForm = {
  organisationId: string;
  licencePlan: string;
  customPlanName: string;
  contractReference: string;
  billingReference: string;
  startDate: string;
  renewalDate: string;
  endDate: string;
  renewalNoticeDays: number;
  autoRenew: boolean;
  renewalNotes: string;
  purchasedSeats: number;
  allocatedSeats: number;
  billingStatus: string;
  licenceStatus: string;
  accountOwner: string;
};

type EnterpriseInviteForm = {
  organisationId: string;
  licenceId: string;
  email: string;
  fullName: string;
  invitationType: string;
  roleTemplate: string;
  internalReference: string;
  department: string;
  expiryDays: number;
  requireMfa: boolean;
};

const EMPTY_PORTFOLIO: EnterprisePortfolio = {
  summary: {
    organisations: 0,
    activeLicences: 0,
    renewalsDue: 0,
    pendingInvitations: 0,
    atRiskOrganisations: 0,
    consentRestricted: 0,
    seats: { purchased: 0, allocated: 0, active: 0, invited: 0, suspended: 0, available: 0 },
  },
  organisations: [],
  licences: [],
  invitations: [],
  memberships: [],
  enrolmentLinks: [],
  consent: {},
  adoptionBands: [],
  savedViews: [],
  privacyBoundary: {
    vaultContentExcluded: true,
    documentContentExcluded: true,
    financialValuesExcluded: true,
    reportingMinimumCohort: 5,
  },
};

export default function EnterpriseOperationsWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState<EnterprisePortfolio>(EMPTY_PORTFOLIO);
  const [activeTab, setActiveTab] = useState<"overview" | "organisations" | "licences" | "users" | "invitations" | "adoption" | "reports" | "consent" | "renewals" | "settings">("overview");
  const [filters, setFilters] = useState({
    organisation: "",
    status: "",
    type: "",
    licence: "",
    licencePlan: "",
    billingStatus: "",
    renewal: "",
    utilisation: "",
    invitation: "",
    adoption: "",
    consent: "",
    risk: "",
    country: "",
    accountOwner: "",
    onboarding: "",
  });
  const [orgForm, setOrgForm] = useState({
    legalName: "",
    tradingName: "",
    organisationType: "employer",
    organisationTypeOther: "",
    registrationNumber: "",
    country: "GB",
    website: "",
    primaryContactTelephone: "",
    registeredAddress: emptyAddress(),
    operatingAddress: emptyAddress(),
    sameOperatingAddress: true,
    primaryContactName: "",
    primaryContactEmail: "",
    internalAccountOwner: "",
    contractReference: "",
    customerReference: "",
    onboardingStatus: "not_started",
    onboardingNotes: "",
    riskStatus: "normal",
    initialStatus: "pending_setup",
    nominatedAdminName: "",
    nominatedAdminEmail: "",
    nominatedAdminRequireMfa: true,
    nominatedAdminExpiryDays: 14,
    adviserInsightConsent: false,
    marketingConsent: false,
    reportingConsent: true,
    exportPermission: false,
    minimumReportingCohort: 10,
  });
  const [licenceForm, setLicenceForm] = useState({
    organisationId: "",
    licencePlan: "starter",
    customPlanName: "",
    contractReference: "",
    billingReference: "",
    startDate: todayInput(),
    renewalDate: nextYearInput(),
    endDate: "",
    renewalNoticeDays: 90,
    autoRenew: false,
    renewalNotes: "",
    purchasedSeats: 25,
    allocatedSeats: 0,
    billingStatus: "not_configured",
    licenceStatus: "active",
    accountOwner: "",
  });
  const [inviteForm, setInviteForm] = useState({
    organisationId: "",
    licenceId: "",
    email: "",
    fullName: "",
    invitationType: "enterprise_user",
    roleTemplate: "organisation_member",
    internalReference: "",
    department: "",
    expiryDays: 14,
    requireMfa: false,
  });
  const [enrolmentForm, setEnrolmentForm] = useState({
    organisationId: "",
    licenceId: "",
    displayName: "",
    expiryDays: 14,
    maxClaims: 1,
    allowedEmailDomain: "",
    defaultRole: "organisation_member",
  });
  const [bulkRows, setBulkRows] = useState("first_name,last_name,email,department,internal_reference,organisation_role,licence_id,invitation_expiry\n");
  const [savedViewName, setSavedViewName] = useState("");

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const loadPortfolio = useCallback(async () => {
    setState("checking");
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) {
      router.replace("/sign-in?next=%2Fapplication%2Fenterprise");
      return;
    }
    const res = await authFetch("/api/internal/admin/enterprise");
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; portfolio?: EnterprisePortfolio; message?: string };
    if (!res.ok || !json.ok || !json.portfolio) {
      setMessage(json.message || "Enterprise Operations is available only to authorised administrators.");
      setState(res.status === 403 ? "denied" : "error");
      return;
    }
    setPortfolio(json.portfolio);
    setState("ready");
  }, [authFetch, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortfolio();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPortfolio]);

  async function runAction(action: string, payload: Record<string, unknown>) {
    setMessage("");
    const res = await authFetch("/api/internal/admin/enterprise", {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; portfolio?: EnterprisePortfolio; message?: string; decision?: { message?: string } };
    if (!res.ok || !json.ok) {
      setMessage(json.decision?.message || json.message || "The enterprise action was blocked.");
      if (json.portfolio) setPortfolio(json.portfolio);
      return;
    }
    if (json.portfolio) setPortfolio(json.portfolio);
    setMessage(action === "export_report" ? "Governed export job accepted." : "Enterprise action completed.");
  }

  const filteredOrganisations = useMemo(() => {
    return portfolio.organisations.filter((org) => {
      if (filters.organisation && !`${org.name} ${org.legalName} ${org.tradingName ?? ""} ${org.registrationNumber ?? ""} ${org.primaryContactEmail ?? ""} ${org.accountOwner ?? ""}`.toLowerCase().includes(filters.organisation.toLowerCase())) return false;
      if (filters.status && org.status !== filters.status) return false;
      if (filters.type && org.type !== filters.type) return false;
      if (filters.risk && org.risk !== filters.risk) return false;
      if (filters.country && org.country.toLowerCase() !== filters.country.toLowerCase()) return false;
      if (filters.accountOwner && (org.accountOwner ?? "").toLowerCase() !== filters.accountOwner.toLowerCase()) return false;
      if (filters.onboarding && org.onboardingStatus !== filters.onboarding) return false;
      if (filters.consent) {
        const consent = portfolio.consent[org.id];
        const restricted = !consent?.reportingConsent || !consent?.adviserInsightConsent;
        if (filters.consent === "restricted" && !restricted) return false;
        if (filters.consent === "reportable" && restricted) return false;
      }
      if (filters.adoption) {
        const band = portfolio.adoptionBands.find((item) => item.organisationId === org.id);
        if (band?.band !== filters.adoption) return false;
      }
      return true;
    });
  }, [filters, portfolio.adoptionBands, portfolio.consent, portfolio.organisations]);

  const visibleOrganisationIds = new Set(filteredOrganisations.map((org) => org.id));
  const filteredLicences = portfolio.licences.filter((licence) => {
    const org = portfolio.organisations.find((item) => item.id === licence.organisationId);
    if (!visibleOrganisationIds.has(licence.organisationId)) return false;
    if (filters.licence && licence.status !== filters.licence) return false;
    if (filters.licencePlan && licence.plan !== filters.licencePlan) return false;
    if (filters.billingStatus && licence.billingStatus !== filters.billingStatus) return false;
    if (filters.organisation && !`${org?.name ?? ""} ${org?.legalName ?? ""} ${licence.contractReference ?? ""} ${licence.billingReference ?? ""} ${licence.plan} ${licence.accountOwner ?? ""}`.toLowerCase().includes(filters.organisation.toLowerCase())) return false;
    if (filters.renewal && licence.renewalRisk !== filters.renewal) return false;
    if (filters.utilisation && utilisationBand(licence) !== filters.utilisation) return false;
    return true;
  });
  const filteredInvitations = portfolio.invitations.filter((invitation) => visibleOrganisationIds.has(invitation.organisationId) && (!filters.invitation || invitation.status === filters.invitation));

  if (state === "checking") {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Legacy Fortress Enterprise</p>
          <h1 style={h1Style}>Checking enterprise access</h1>
          <p style={mutedStyle}>Confirming your signed-in session and role permissions.</p>
        </section>
      </main>
    );
  }

  if (state === "denied" || state === "error") {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Enterprise Operations</p>
          <h1 style={h1Style}>{state === "denied" ? "Access denied" : "Enterprise workspace unavailable"}</h1>
          <p style={mutedStyle}>{message}</p>
          <div style={rowStyle}>
            <Link style={secondaryLinkStyle} href="/dashboard">Personal Vault</Link>
            <Link style={secondaryLinkStyle} href="/admin">Admin Operations</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Legacy Fortress Enterprise</p>
          <h1 style={h1Style}>Enterprise Operations</h1>
          <p style={mutedStyle}>Organisation licensing, seats, invitations, consent-aware reporting, and renewals. Private vault records and documents are excluded.</p>
        </div>
        <div style={headerActionsStyle}>
          <span style={stageBadgeStyle}>STAGING — synthetic test data may be present</span>
          <WorkspaceSwitcher currentPathname="/application/enterprise" alwaysShow compact />
          <Link style={secondaryLinkStyle} href="/dashboard">Personal Vault</Link>
          <Link style={secondaryLinkStyle} href="/admin">Admin Operations</Link>
        </div>
      </header>

      {message ? <section style={alertStyle}>{message}</section> : null}

      <nav aria-label="Enterprise navigation" style={tabListStyle}>
        {[
          ["overview", "Overview"],
          ["organisations", "Organisations"],
          ["licences", "Licences"],
          ["users", "Users and seats"],
          ["invitations", "Invitations"],
          ["adoption", "Adoption"],
          ["reports", "Reports"],
          ["consent", "Consent and compliance"],
          ["renewals", "Renewals"],
          ["settings", "Account settings"],
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key as typeof activeTab)} style={activeTab === key ? activeTabStyle : tabStyle}>
            {label}
          </button>
        ))}
      </nav>

      {renderFilterBar(
        filters,
        setFilters,
        () => setFilters({ organisation: "", status: "", type: "", licence: "", licencePlan: "", billingStatus: "", renewal: "", utilisation: "", invitation: "", adoption: "", consent: "", risk: "", country: "", accountOwner: "", onboarding: "" }),
        () => runAction("save_view", { name: savedViewName || "Enterprise portfolio view", viewType: activeTab, filters }),
        savedViewName,
        setSavedViewName,
        portfolio.organisations,
      )}

      {activeTab === "overview" ? renderOverview(portfolio, filteredOrganisations, filteredLicences, filteredInvitations, setActiveTab) : null}
      {activeTab === "organisations" ? renderOrganisations(filteredOrganisations, portfolio, orgForm, setOrgForm, runAction, () => runAction("create_organisation", orgForm)) : null}
      {activeTab === "licences" ? renderLicences(filteredLicences, portfolio, licenceForm, setLicenceForm, () => runAction("create_licence", licenceForm)) : null}
      {activeTab === "users" ? renderUsersAndSeats(portfolio, runAction) : null}
      {activeTab === "invitations" ? renderInvitations(filteredInvitations, portfolio, inviteForm, setInviteForm, enrolmentForm, setEnrolmentForm, bulkRows, setBulkRows, runAction) : null}
      {activeTab === "adoption" ? renderAdoption(portfolio, filteredOrganisations) : null}
      {activeTab === "reports" ? renderReports(portfolio, () => runAction("export_report", { reportType: "portfolio" })) : null}
      {activeTab === "consent" ? renderConsent(portfolio, filteredOrganisations) : null}
      {activeTab === "renewals" ? renderRenewals(filteredLicences, portfolio) : null}
      {activeTab === "settings" ? renderPhasePlaceholder("Account settings", "Enterprise account settings are staged for later phases. Organisation settings are available from each organisation detail workspace.") : null}
    </main>
  );
}

function renderOverview(
  portfolio: EnterprisePortfolio,
  organisations: EnterpriseOrganisation[],
  licences: EnterpriseLicence[],
  invitations: EnterpriseInvitation[],
  setActiveTab: (tab: "overview" | "organisations" | "licences" | "users" | "invitations" | "adoption" | "reports" | "consent" | "renewals" | "settings") => void,
) {
  const cards = [
    { label: "Licensed organisations", value: portfolio.summary.organisations, tab: "organisations" as const },
    { label: "Active licences", value: portfolio.summary.activeLicences, tab: "licences" as const },
    { label: "Seats used", value: `${portfolio.summary.seats.active}/${portfolio.summary.seats.purchased}`, tab: "licences" as const },
    { label: "Seats available", value: String(portfolio.summary.seats.available ?? Math.max(portfolio.summary.seats.purchased - portfolio.summary.seats.allocated, 0)), tab: "licences" as const },
    { label: "Renewals due", value: portfolio.summary.renewalsDue, tab: "licences" as const },
    { label: "Pending invitations", value: portfolio.summary.pendingInvitations, tab: "invitations" as const },
    { label: "Consent restricted", value: portfolio.summary.consentRestricted, tab: "consent" as const },
  ];
  return (
    <div style={stackStyle}>
      <section style={gridStyle}>
        {cards.map((card) => (
          <button key={card.label} type="button" style={metricButtonStyle} onClick={() => setActiveTab(card.tab)}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>Open filtered view</small>
          </button>
        ))}
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Portfolio snapshot</h2>
        <p style={mutedStyle}>{organisations.length} organisations, {licences.length} licences, and {invitations.length} invitations match the current filters.</p>
        <p style={privacyStyle}>Private vault records, uploaded documents, legal contents, individual financial values, notes, wishes, passwords, and account numbers are not queried or displayed.</p>
      </section>
    </div>
  );
}

function renderOrganisations(
  organisations: EnterpriseOrganisation[],
  portfolio: EnterprisePortfolio,
  form: EnterpriseOrgForm,
  setForm: (value: EnterpriseOrgForm) => void,
  runAction: (action: string, payload: Record<string, unknown>) => void,
  submit: () => void,
) {
  return (
    <div style={twoColumnStyle}>
      <section style={panelStyle}>
        <h2 id="add-organisation-form" style={h2Style}>Add organisation</h2>
        <p style={mutedStyle}>Create a real staging organisation record. No customer vault data is requested or shown.</p>
        <h3 style={h3Style}>1. Organisation identity</h3>
        <FormInput label="Legal name" required value={String(form.legalName)} onChange={(value) => setForm({ ...form, legalName: value })} />
        <FormInput label="Trading name" value={String(form.tradingName)} onChange={(value) => setForm({ ...form, tradingName: value })} />
        <FormInput label="Registration number" value={String(form.registrationNumber)} onChange={(value) => setForm({ ...form, registrationNumber: value })} />
        <FormInput label="Website" type="url" value={String(form.website)} onChange={(value) => setForm({ ...form, website: value })} />
        <label style={labelStyle}>Organisation type
          <select value={String(form.organisationType)} onChange={(event) => setForm({ ...form, organisationType: event.target.value })}>
            <option value="employer">Employer</option>
            <option value="law_firm">Law firm</option>
            <option value="wealth_manager">Wealth manager</option>
            <option value="insurer">Insurer</option>
            <option value="funeral_provider">Funeral provider</option>
            <option value="employee_benefit_provider">Employee-benefit provider</option>
            <option value="enterprise_reseller">Enterprise reseller</option>
            <option value="other">Other</option>
          </select>
        </label>
        {form.organisationType === "other" ? <FormInput label="Other organisation type" required value={String(form.organisationTypeOther)} onChange={(value) => setForm({ ...form, organisationTypeOther: value })} /> : null}
        <FormInput label="Country" required value={String(form.country)} onChange={(value) => setForm({ ...form, country: value })} />
        <FormInput label="Primary contact" value={String(form.primaryContactName)} onChange={(value) => setForm({ ...form, primaryContactName: value })} />
        <FormInput label="Primary contact email" required value={String(form.primaryContactEmail)} onChange={(value) => setForm({ ...form, primaryContactEmail: value })} />
        <FormInput label="Primary contact telephone" value={String(form.primaryContactTelephone)} onChange={(value) => setForm({ ...form, primaryContactTelephone: value })} />
        <h3 style={h3Style}>2. Address</h3>
        {renderAddressFields("Registered address", form.registeredAddress, (address) => setForm({ ...form, registeredAddress: address }))}
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.sameOperatingAddress)} onChange={(event) => setForm({ ...form, sameOperatingAddress: event.target.checked })} /> Operating address is the same as registered address</label>
        {!form.sameOperatingAddress ? renderAddressFields("Operating address", form.operatingAddress, (address) => setForm({ ...form, operatingAddress: address })) : null}
        <h3 style={h3Style}>3. Operational details</h3>
        <FormInput label="Internal account owner" required value={String(form.internalAccountOwner)} onChange={(value) => setForm({ ...form, internalAccountOwner: value })} />
        <FormInput label="Contract reference" value={String(form.contractReference)} onChange={(value) => setForm({ ...form, contractReference: value })} />
        <FormInput label="Customer reference" value={String(form.customerReference)} onChange={(value) => setForm({ ...form, customerReference: value })} />
        <label style={labelStyle}>Initial status
          <select value={String(form.initialStatus)} onChange={(event) => setForm({ ...form, initialStatus: event.target.value })}>
            <option value="draft">Draft</option>
            <option value="pending_setup">Pending setup</option>
            <option value="pending_administrator_acceptance">Pending administrator acceptance</option>
          </select>
        </label>
        <label style={labelStyle}>Onboarding status
          <select value={String(form.onboardingStatus)} onChange={(event) => setForm({ ...form, onboardingStatus: event.target.value })}>
            <option value="not_started">Not started</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="complete">Complete</option>
          </select>
        </label>
        <label style={labelStyle}>Risk
          <select value={String(form.riskStatus)} onChange={(event) => setForm({ ...form, riskStatus: event.target.value })}>
            <option value="normal">Normal</option>
            <option value="watch">Watch</option>
            <option value="at_risk">At risk</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label style={labelStyle}>Onboarding notes
          <textarea value={String(form.onboardingNotes)} onChange={(event) => setForm({ ...form, onboardingNotes: event.target.value })} />
        </label>
        <h3 style={h3Style}>4. Administrator preparation</h3>
        <FormInput label="Nominated administrator name" value={String(form.nominatedAdminName)} onChange={(value) => setForm({ ...form, nominatedAdminName: value })} />
        <FormInput label="Nominated administrator email" value={String(form.nominatedAdminEmail)} onChange={(value) => setForm({ ...form, nominatedAdminEmail: value })} />
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.nominatedAdminRequireMfa)} onChange={(event) => setForm({ ...form, nominatedAdminRequireMfa: event.target.checked })} /> Require MFA</label>
        <FormInput label="Invitation expiry days" type="number" value={String(form.nominatedAdminExpiryDays)} onChange={(value) => setForm({ ...form, nominatedAdminExpiryDays: Number(value) })} />
        <h3 style={h3Style}>5. Review and create</h3>
        <p style={privacyStyle}>{form.legalName || "New organisation"} will be created with status {labelise(form.initialStatus)} and risk {labelise(form.riskStatus)}. Administrator access is prepared only; nobody is activated automatically.</p>
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.reportingConsent)} onChange={(event) => setForm({ ...form, reportingConsent: event.target.checked })} /> Reporting consent</label>
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.adviserInsightConsent)} onChange={(event) => setForm({ ...form, adviserInsightConsent: event.target.checked })} /> Adviser insight consent</label>
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.exportPermission)} onChange={(event) => setForm({ ...form, exportPermission: event.target.checked })} /> Export permission</label>
        <button type="button" style={primaryButtonStyle} onClick={submit}>Create organisation</button>
      </section>
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={h2Style}>Organisations</h2>
          <button type="button" style={primaryButtonStyle} onClick={() => document.getElementById("add-organisation-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Add organisation
          </button>
        </div>
        {renderOrganisationTable(organisations, portfolio, runAction)}
      </section>
    </div>
  );
}

function renderLicences(
  licences: EnterpriseLicence[],
  portfolio: EnterprisePortfolio,
  form: EnterpriseLicenceForm,
  setForm: (value: EnterpriseLicenceForm) => void,
  submit: () => void,
) {
  const committedSeats = Math.max(Number(form.allocatedSeats ?? 0), 0);
  const availableSeats = Math.max(Number(form.purchasedSeats ?? 0) - committedSeats, 0);
  return (
    <div style={twoColumnStyle}>
      <section style={panelStyle}>
        <h2 id="create-licence-form" style={h2Style}>Create licence</h2>
        <p style={mutedStyle}>Configure a real licence entitlement. Committed seats are active + invited + suspended reservations; available seats are purchased minus committed usage.</p>
        <h3 style={h3Style}>1. Plan</h3>
        <label style={labelStyle}>Organisation
          <select value={String(form.organisationId)} onChange={(event) => setForm({ ...form, organisationId: event.target.value })}>
            <option value="">Select organisation</option>
            {portfolio.organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Licence plan
          <select value={String(form.licencePlan)} onChange={(event) => setForm({ ...form, licencePlan: event.target.value })}>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {form.licencePlan === "custom" ? <FormInput label="Custom plan name" required value={String(form.customPlanName)} onChange={(value) => setForm({ ...form, customPlanName: value })} /> : null}
        <FormInput label="Contract reference" value={String(form.contractReference)} onChange={(value) => setForm({ ...form, contractReference: value })} />
        <FormInput label="Billing reference" value={String(form.billingReference)} onChange={(value) => setForm({ ...form, billingReference: value })} />
        <FormInput label="Account owner" value={String(form.accountOwner)} onChange={(value) => setForm({ ...form, accountOwner: value })} />
        <h3 style={h3Style}>2. Entitlement</h3>
        <FormInput label="Purchased seats" type="number" required value={String(form.purchasedSeats)} onChange={(value) => setForm({ ...form, purchasedSeats: Number(value) })} />
        <FormInput label="Committed seats" type="number" value={String(form.allocatedSeats)} onChange={(value) => setForm({ ...form, allocatedSeats: Number(value) })} />
        <p style={privacyStyle}>Available seats: {availableSeats}. Minimum safe seat count: {committedSeats}. Pending invitations reserve seats in Phase 3.</p>
        <h3 style={h3Style}>3. Renewal and status</h3>
        <FormInput label="Start date" type="date" required value={String(form.startDate)} onChange={(value) => setForm({ ...form, startDate: value })} />
        <FormInput label="Renewal date" type="date" required value={String(form.renewalDate)} onChange={(value) => setForm({ ...form, renewalDate: value })} />
        <FormInput label="End date" type="date" value={String(form.endDate)} onChange={(value) => setForm({ ...form, endDate: value })} />
        <FormInput label="Renewal notice days" type="number" value={String(form.renewalNoticeDays)} onChange={(value) => setForm({ ...form, renewalNoticeDays: Number(value) })} />
        <label style={labelStyle}>Initial status
          <select value={String(form.licenceStatus)} onChange={(event) => setForm({ ...form, licenceStatus: event.target.value })}>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending approval</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label style={labelStyle}>Billing status
          <select value={String(form.billingStatus)} onChange={(event) => setForm({ ...form, billingStatus: event.target.value })}>
            <option value="not_configured">Not configured</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
          </select>
        </label>
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.autoRenew)} onChange={(event) => setForm({ ...form, autoRenew: event.target.checked })} /> Auto-renew</label>
        <label style={labelStyle}>Renewal notes
          <textarea value={String(form.renewalNotes)} onChange={(event) => setForm({ ...form, renewalNotes: event.target.value })} />
        </label>
        <h3 style={h3Style}>4. Review</h3>
        <p style={privacyStyle}>{labelise(form.licencePlan)} licence for {form.purchasedSeats} purchased seats, renewing on {form.renewalDate}. Seat limits are enforced server-side.</p>
        <button type="button" style={primaryButtonStyle} onClick={submit}>Create licence</button>
      </section>
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={h2Style}>Licences</h2>
          <button type="button" style={primaryButtonStyle} onClick={() => document.getElementById("create-licence-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Create licence
          </button>
        </div>
        {renderLicenceTable(licences, portfolio)}
      </section>
    </div>
  );
}

function renderInvitations(
  invitations: EnterpriseInvitation[],
  portfolio: EnterprisePortfolio,
  form: EnterpriseInviteForm,
  setForm: (value: EnterpriseInviteForm) => void,
  enrolmentForm: { organisationId: string; licenceId: string; displayName: string; expiryDays: number; maxClaims: number; allowedEmailDomain: string; defaultRole: string },
  setEnrolmentForm: (value: { organisationId: string; licenceId: string; displayName: string; expiryDays: number; maxClaims: number; allowedEmailDomain: string; defaultRole: string }) => void,
  bulkRows: string,
  setBulkRows: (value: string) => void,
  runAction: (action: string, payload: Record<string, unknown>) => void,
) {
  const orgLicences = portfolio.licences.filter((licence) => licence.organisationId === form.organisationId);
  const linkLicences = portfolio.licences.filter((licence) => licence.organisationId === enrolmentForm.organisationId);
  return (
    <div style={twoColumnStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Invite organisation user</h2>
        <label style={labelStyle}>Organisation
          <select value={String(form.organisationId)} onChange={(event) => setForm({ ...form, organisationId: event.target.value, licenceId: "" })}>
            <option value="">Select organisation</option>
            {portfolio.organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Licence
          <select value={String(form.licenceId)} onChange={(event) => setForm({ ...form, licenceId: event.target.value })}>
            <option value="">No seat allocation</option>
            {orgLicences.map((licence) => <option key={licence.id} value={licence.id}>{licence.plan} · {licence.allocatedSeats}/{licence.purchasedSeats}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Invitation type
          <select value={String(form.invitationType)} onChange={(event) => setForm({ ...form, invitationType: event.target.value })}>
            <option value="enterprise_user">Enterprise user</option>
            <option value="organisation_admin">Organisation administrator</option>
          </select>
        </label>
        <label style={labelStyle}>Organisation role
          <select value={String(form.roleTemplate)} onChange={(event) => setForm({ ...form, roleTemplate: event.target.value })}>
            <option value="organisation_member">Organisation member</option>
            <option value="organisation_admin">Organisation administrator</option>
            <option value="organisation_licence_manager">Organisation licence manager</option>
            <option value="organisation_user_manager">Organisation user manager</option>
            <option value="organisation_reporting_viewer">Organisation reporting viewer</option>
            <option value="organisation_auditor">Organisation auditor/read-only</option>
          </select>
        </label>
        <FormInput label="Email" required value={String(form.email)} onChange={(value) => setForm({ ...form, email: value })} />
        <FormInput label="Full name" value={String(form.fullName)} onChange={(value) => setForm({ ...form, fullName: value })} />
        <FormInput label="Internal reference" value={String(form.internalReference)} onChange={(value) => setForm({ ...form, internalReference: value })} />
        <FormInput label="Department" value={String(form.department)} onChange={(value) => setForm({ ...form, department: value })} />
        <FormInput label="Expiry days" type="number" value={String(form.expiryDays)} onChange={(value) => setForm({ ...form, expiryDays: Number(value) })} />
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.requireMfa)} onChange={(event) => setForm({ ...form, requireMfa: event.target.checked })} /> Require MFA</label>
        <p style={privacyStyle}>Pending user invitations reserve one seat. Administrator invitations activate only after the recipient accepts the role.</p>
        <button type="button" style={primaryButtonStyle} onClick={() => runAction(form.invitationType === "organisation_admin" ? "invite_organisation_admin" : "invite_enterprise_user", form)}>Send invitation</button>
        <h2 style={h2Style}>Create enrolment link</h2>
        <label style={labelStyle}>Organisation
          <select value={enrolmentForm.organisationId} onChange={(event) => setEnrolmentForm({ ...enrolmentForm, organisationId: event.target.value, licenceId: "" })}>
            <option value="">Select organisation</option>
            {portfolio.organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Licence
          <select value={enrolmentForm.licenceId} onChange={(event) => setEnrolmentForm({ ...enrolmentForm, licenceId: event.target.value })}>
            <option value="">Select licence</option>
            {linkLicences.map((licence) => <option key={licence.id} value={licence.id}>{licence.plan} · {licence.availableSeats} available</option>)}
          </select>
        </label>
        <FormInput label="Display name" required value={enrolmentForm.displayName} onChange={(displayName) => setEnrolmentForm({ ...enrolmentForm, displayName })} />
        <FormInput label="Claim limit" type="number" value={String(enrolmentForm.maxClaims)} onChange={(value) => setEnrolmentForm({ ...enrolmentForm, maxClaims: Number(value) })} />
        <FormInput label="Expiry days" type="number" value={String(enrolmentForm.expiryDays)} onChange={(value) => setEnrolmentForm({ ...enrolmentForm, expiryDays: Number(value) })} />
        <FormInput label="Allowed email domain" value={enrolmentForm.allowedEmailDomain} onChange={(allowedEmailDomain) => setEnrolmentForm({ ...enrolmentForm, allowedEmailDomain })} />
        <button type="button" style={primaryButtonStyle} onClick={() => runAction("create_enrolment_link", enrolmentForm)}>Create enrolment link</button>
        <h2 style={h2Style}>Bulk CSV validation</h2>
        <textarea aria-label="Bulk invitation CSV" style={{ minHeight: 120 }} value={bulkRows} onChange={(event) => setBulkRows(event.target.value)} />
        <button type="button" style={secondaryButtonStyle} onClick={() => runAction("validate_bulk_invitations", { rows: parseBulkRows(bulkRows) })}>Validate CSV</button>
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Invitations</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Recipient</th><th>Role</th><th>Status</th><th>Seat</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              {invitations.map((item) => (
                <tr key={item.id}>
                  <td>{item.fullName || item.email}<small>{item.email}</small></td>
                  <td>{labelise(item.roleTemplate)}</td>
                  <td>{labelise(item.status)}</td>
                  <td>{item.seatId ? "Reserved" : "Not reserved"}</td>
                  <td>{formatDate(item.expiresAt)}</td>
                  <td style={actionsCellStyle}>
                    <button type="button" onClick={() => runAction("update_invitation", { invitationId: item.id, status: "sent" })}>Resend</button>
                    <button type="button" onClick={() => runAction("update_invitation", { invitationId: item.id, status: "revoked" })}>Revoke</button>
                    <button type="button" onClick={() => runAction("update_invitation", { invitationId: item.id, status: "expired" })}>Expire</button>
                  </td>
                </tr>
              ))}
              {invitations.length === 0 ? <tr><td colSpan={6}>No enterprise invitations match this view.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <h2 style={h2Style}>Enrolment links</h2>
        <table style={tableStyle}>
          <thead><tr><th>Name</th><th>Status</th><th>Claims</th><th>Domain</th><th>Actions</th></tr></thead>
          <tbody>
            {portfolio.enrolmentLinks.map((link) => (
              <tr key={link.id}><td>{link.displayName}</td><td>{labelise(link.status)}</td><td>{link.claimsUsed}/{link.maxClaims}</td><td>{link.allowedEmailDomain || "Any"}</td><td><button type="button" onClick={() => runAction("update_enrolment_link", { enrolmentLinkId: link.id, status: "revoked" })}>Revoke</button></td></tr>
            ))}
            {portfolio.enrolmentLinks.length === 0 ? <tr><td colSpan={5}>No enrolment links have been created.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function renderUsersAndSeats(portfolio: EnterprisePortfolio, runAction: (action: string, payload: Record<string, unknown>) => void) {
  const seats = portfolio.summary.seats;
  return (
    <div style={stackStyle}>
      <section style={gridStyle}>
        <InfoTile label="Purchased seats" value={String(seats.purchased)} />
        <InfoTile label="Active seats" value={String(seats.active)} />
        <InfoTile label="Invited/reserved seats" value={String(seats.invited)} />
        <InfoTile label="Suspended seats" value={String(seats.suspended)} />
        <InfoTile label="Available seats" value={String(seats.available ?? 0)} />
        <InfoTile label="Expired invitations" value={String(portfolio.invitations.filter((item) => item.status === "expired").length)} />
        <InfoTile label="Revoked invitations" value={String(portfolio.invitations.filter((item) => item.status === "revoked").length)} />
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Users and seats</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Membership</th><th>Seat</th><th>Onboarding</th><th>Consent</th><th>Actions</th></tr></thead>
            <tbody>
              {portfolio.memberships.map((member) => (
                <tr key={member.id}>
                  <td>{member.fullName || "Not set"}<small>{member.department || member.internalReference || "No reference"}</small></td>
                  <td>{member.email}</td>
                  <td>{labelise(member.organisationRole)}</td>
                  <td>{labelise(member.status)}</td>
                  <td>{member.seatId ? labelise(member.status === "removed" ? "released" : member.status === "suspended" ? "suspended" : "active") : "No seat"}</td>
                  <td>{labelise(member.onboardingStatus)}</td>
                  <td>{labelise(member.consentStatus)}</td>
                  <td style={actionsCellStyle}>
                    <button type="button" onClick={() => runAction("transition_membership", { membershipId: member.id, status: member.status === "suspended" ? "active" : "suspended", reason: "Operator lifecycle change" })}>{member.status === "suspended" ? "Reactivate" : "Suspend"}</button>
                    <button type="button" onClick={() => runAction("transition_membership", { membershipId: member.id, status: "removed", reason: "Operator removal" })}>Remove</button>
                  </td>
                </tr>
              ))}
              {portfolio.memberships.length === 0 ? <tr><td colSpan={8}>No organisation users have accepted access yet. Invite users from the Invitations workspace.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p style={privacyStyle}>Removing organisation access releases the seat but does not delete the person’s personal Legacy Fortress account or vault.</p>
      </section>
    </div>
  );
}

function renderAdoption(portfolio: EnterprisePortfolio, organisations: EnterpriseOrganisation[]) {
  const visible = new Set(organisations.map((org) => org.id));
  const rows = portfolio.adoptionBands.filter((item) => visible.has(item.organisationId));
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>Adoption and completeness bands</h2>
      <p style={mutedStyle}>Bands use invitation acceptance and seat-utilisation ratios only. They do not inspect vault contents or individual financial values.</p>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead><tr><th>Organisation</th><th>Band</th><th>Acceptance</th><th>Seat utilisation</th><th>Consent</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.organisationId}>
                <td>{row.organisationName}</td>
                <td>{row.band}</td>
                <td>{row.acceptanceRate}%</td>
                <td>{row.seatUtilisation}%</td>
                <td>{row.consentRestricted ? "Restricted" : "Reportable"}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5}>No adoption rows match this view.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderReports(portfolio: EnterprisePortfolio, requestExport: () => void) {
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>Consent-aware reports</h2>
      <div style={gridStyle}>
        <InfoTile label="Licence utilisation" value={`${portfolio.summary.seats.allocated}/${portfolio.summary.seats.purchased}`} />
        <InfoTile label="Invitation acceptance" value={`${portfolio.invitations.filter((item) => item.status === "accepted").length}/${portfolio.invitations.length}`} />
        <InfoTile label="Renewal pipeline" value={String(portfolio.summary.renewalsDue)} />
        <InfoTile label="Consent restricted" value={String(portfolio.summary.consentRestricted)} />
      </div>
      <p style={privacyStyle}>Exports require explicit permission, minimum cohort size, audit logging, and consent. Export payloads exclude private vault values and document contents.</p>
      <button type="button" style={primaryButtonStyle} onClick={requestExport}>Request governed export</button>
    </section>
  );
}

function renderConsent(portfolio: EnterprisePortfolio, organisations: EnterpriseOrganisation[]) {
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>Consent and compliance</h2>
      {renderOrganisationTable(organisations, portfolio)}
    </section>
  );
}

function renderRenewals(licences: EnterpriseLicence[], portfolio: EnterprisePortfolio) {
  const orgName = (id: string) => portfolio.organisations.find((org) => org.id === id)?.name ?? "Unknown organisation";
  const renewalRows = licences.filter((licence) => ["due_90", "due_60", "due_30", "overdue"].includes(licence.renewalRisk));
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>Renewals</h2>
      <p style={mutedStyle}>Upcoming and overdue renewals are calculated from real persisted licence renewal dates.</p>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead><tr><th>Organisation</th><th>Plan</th><th>Seats</th><th>Renewal date</th><th>Risk</th><th>Account owner</th><th>Action</th></tr></thead>
          <tbody>
            {renewalRows.map((licence) => (
              <tr key={licence.id}>
                <td>{orgName(licence.organisationId)}</td>
                <td>{licence.plan === "custom" ? licence.customPlanName || "Custom" : labelise(licence.plan)}</td>
                <td>{licence.purchasedSeats}</td>
                <td>{formatDate(licence.renewalDate)}</td>
                <td>{labelise(licence.renewalRisk)}</td>
                <td>{licence.accountOwner ?? "Unassigned"}</td>
                <td><Link href={`/application/enterprise/licences/${licence.id}#renewals`}>Start renewal</Link></td>
              </tr>
            ))}
            {renewalRows.length === 0 ? <tr><td colSpan={7}>No licences are currently due for renewal.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderFilterBar(
  filters: EnterpriseFilters,
  setFilters: (value: EnterpriseFilters) => void,
  clear: () => void,
  save: () => void,
  savedViewName: string,
  setSavedViewName: (value: string) => void,
  organisations: EnterpriseOrganisation[],
) {
  const accountOwners = Array.from(new Set(organisations.map((org) => org.accountOwner).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  const activeFilters = [
    ["organisation", filters.organisation],
    ["status", filters.status],
    ["type", filters.type],
    ["licence", filters.licence],
    ["licencePlan", filters.licencePlan],
    ["billingStatus", filters.billingStatus],
    ["renewal", filters.renewal],
    ["utilisation", filters.utilisation],
    ["invitation", filters.invitation],
    ["adoption", filters.adoption],
    ["consent", filters.consent],
    ["risk", filters.risk],
    ["country", filters.country],
    ["accountOwner", filters.accountOwner],
    ["onboarding", filters.onboarding],
  ].filter(([, value]) => value);
  return (
    <section style={filterBarStyle} aria-label="Enterprise filters">
      <FormInput label="Organisation" value={filters.organisation} onChange={(value) => setFilters({ ...filters, organisation: value })} />
      <label style={labelStyle}>Status
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">Any</option>
          <option value="draft">Draft</option>
          <option value="pending_setup">Pending setup</option>
          <option value="pending_administrator_acceptance">Pending administrator acceptance</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expiring">Expiring</option>
          <option value="cancelled">Cancelled</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label style={labelStyle}>Organisation type
        <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
          <option value="">Any</option>
          <option value="employer">Employer</option>
          <option value="law_firm">Law firm</option>
          <option value="wealth_manager">Wealth manager</option>
          <option value="insurer">Insurer</option>
          <option value="funeral_provider">Funeral provider</option>
          <option value="employee_benefit_provider">Employee-benefit provider</option>
          <option value="enterprise_reseller">Enterprise reseller</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label style={labelStyle}>Licence
        <select value={filters.licence} onChange={(event) => setFilters({ ...filters, licence: event.target.value })}>
          <option value="">Any</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending approval</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </label>
      <label style={labelStyle}>Plan
        <select value={filters.licencePlan} onChange={(event) => setFilters({ ...filters, licencePlan: event.target.value })}>
          <option value="">Any</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label style={labelStyle}>Billing status
        <select value={filters.billingStatus} onChange={(event) => setFilters({ ...filters, billingStatus: event.target.value })}>
          <option value="">Any</option>
          <option value="not_configured">Not configured</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label style={labelStyle}>Renewal period
        <select value={filters.renewal} onChange={(event) => setFilters({ ...filters, renewal: event.target.value })}>
          <option value="">Any</option>
          <option value="due_90">Due within 90 days</option>
          <option value="due_60">Due within 60 days</option>
          <option value="due_30">Due within 30 days</option>
          <option value="overdue">Overdue</option>
          <option value="normal">Not due</option>
        </select>
      </label>
      <label style={labelStyle}>Seat utilisation
        <select value={filters.utilisation} onChange={(event) => setFilters({ ...filters, utilisation: event.target.value })}>
          <option value="">Any</option>
          <option value="0_25">0-25%</option>
          <option value="26_50">26-50%</option>
          <option value="51_75">51-75%</option>
          <option value="76_90">76-90%</option>
          <option value="91_100">91-100%</option>
          <option value="over_capacity">Over capacity</option>
        </select>
      </label>
      <label style={labelStyle}>Invitation
        <select value={filters.invitation} onChange={(event) => setFilters({ ...filters, invitation: event.target.value })}>
          <option value="">Any</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="revoked">Revoked</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      <label style={labelStyle}>Adoption
        <select value={filters.adoption} onChange={(event) => setFilters({ ...filters, adoption: event.target.value })}>
          <option value="">Any</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label style={labelStyle}>Consent
        <select value={filters.consent} onChange={(event) => setFilters({ ...filters, consent: event.target.value })}>
          <option value="">Any</option>
          <option value="reportable">Reportable</option>
          <option value="restricted">Restricted</option>
        </select>
      </label>
      <label style={labelStyle}>Risk
        <select value={filters.risk} onChange={(event) => setFilters({ ...filters, risk: event.target.value })}>
          <option value="">Any</option>
          <option value="normal">Normal</option>
          <option value="watch">Watch</option>
          <option value="at_risk">At risk</option>
          <option value="critical">Critical</option>
          <option value="restricted">Restricted</option>
        </select>
      </label>
      <FormInput label="Country" value={filters.country} onChange={(value) => setFilters({ ...filters, country: value })} />
      <label style={labelStyle}>Account owner
        <select value={filters.accountOwner} onChange={(event) => setFilters({ ...filters, accountOwner: event.target.value })}>
          <option value="">Any</option>
          {accountOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Onboarding
        <select value={filters.onboarding} onChange={(event) => setFilters({ ...filters, onboarding: event.target.value })}>
          <option value="">Any</option>
          <option value="not_started">Not started</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="complete">Complete</option>
        </select>
      </label>
      <button type="button" style={secondaryButtonStyle} onClick={clear}>Clear</button>
      <FormInput label="Saved view name" value={savedViewName} onChange={setSavedViewName} />
      <button type="button" style={secondaryButtonStyle} onClick={save}>Save view</button>
      {activeFilters.length ? (
        <div style={filterChipsStyle}>
          {activeFilters.map(([key, value]) => (
            <button key={key} type="button" style={chipStyle} onClick={() => setFilters({ ...filters, [key]: "" })}>
              {labelise(key)}: {labelise(String(value))} x
            </button>
          ))}
          <button type="button" style={secondaryButtonStyle} onClick={clear}>Clear all</button>
        </div>
      ) : null}
    </section>
  );
}

function renderOrganisationTable(organisations: EnterpriseOrganisation[], portfolio: EnterprisePortfolio, runAction?: (action: string, payload: Record<string, unknown>) => void) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead><tr><th>Organisation</th><th>Type</th><th>Status</th><th>Licence summary</th><th>Primary administrator</th><th>Account owner</th><th>Onboarding</th><th>Risk</th><th>Actions</th></tr></thead>
        <tbody>
          {organisations.map((org) => {
            const orgLicences = portfolio.licences.filter((licence) => licence.organisationId === org.id);
            const seats = orgLicences.reduce((sum, licence) => sum + licence.purchasedSeats, 0);
            const active = orgLicences.reduce((sum, licence) => sum + licence.activeSeats, 0);
            return (
              <tr key={org.id}>
                <td>{org.name}<small>{org.registrationNumber ?? org.legalName}</small></td>
                <td>{labelise(org.type)}</td>
                <td>{labelise(org.status)}</td>
                <td>
                  {orgLicences.length ? `${active}/${seats} seats` : "No licence configured"}
                  {orgLicences[0] ? <small>{labelise(orgLicences[0].plan)} · {labelise(orgLicences[0].status)} · {orgLicences[0].availableSeats} available · renews {formatDate(orgLicences[0].renewalDate)}</small> : null}
                </td>
                <td>{org.nominatedAdminEmail ?? org.primaryContactEmail ?? "No organisation administrator has accepted access."}<small>Prepare administrator invitation</small></td>
                <td>{org.accountOwner ?? "Unassigned"}</td>
                <td>{labelise(org.onboardingStatus ?? "not_started")}</td>
                <td>{labelise(org.risk)}</td>
                <td style={actionsCellStyle}>
                  <Link href={`/application/enterprise/organisations/${org.id}`}>View</Link>
                  <Link href={`/application/enterprise/organisations/${org.id}#settings`}>Edit</Link>
                  {orgLicences[0] ? <Link href={`/application/enterprise/licences/${orgLicences[0].id}`}>Manage licence</Link> : <button type="button" disabled={!runAction} onClick={() => document.getElementById("create-licence-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Configure licence</button>}
                  <button type="button" disabled>Manage users - Phase 3</button>
                  <Link href={`/application/enterprise/organisations/${org.id}#invitations`}>Invite administrator</Link>
                  <button type="button" disabled={!runAction} onClick={() => runAction?.("transition_organisation", { organisationId: org.id, status: org.status === "suspended" ? "active" : "suspended", reason: "Updated from organisation list" })}>{org.status === "suspended" ? "Reactivate" : "Suspend"}</button>
                  <button type="button" disabled={!runAction} onClick={() => runAction?.("delete_or_archive_organisation", { organisationId: org.id, reason: "Archived from organisation list" })}>Archive/delete</button>
                  <Link href={`/application/enterprise/organisations/${org.id}#audit`}>View audit history</Link>
                </td>
              </tr>
            );
          })}
          {organisations.length === 0 ? <tr><td colSpan={9}>No organisations have been created yet. Add organisation if your role permits it.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function renderPhasePlaceholder(title: string, message: string) {
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{title}</h2>
      <p style={mutedStyle}>{message}</p>
      <p style={privacyStyle}>This staged section does not display fabricated operational data.</p>
    </section>
  );
}

function renderAddressFields(title: string, address: AddressForm, onChange: (address: AddressForm) => void) {
  return (
    <fieldset style={fieldsetStyle}>
      <legend>{title}</legend>
      <FormInput label="Address line 1" value={address.line1} onChange={(line1) => onChange({ ...address, line1 })} />
      <FormInput label="Address line 2" value={address.line2} onChange={(line2) => onChange({ ...address, line2 })} />
      <FormInput label="Town or city" value={address.city} onChange={(city) => onChange({ ...address, city })} />
      <FormInput label="Region" value={address.region} onChange={(region) => onChange({ ...address, region })} />
      <FormInput label="Postcode" value={address.postcode} onChange={(postcode) => onChange({ ...address, postcode })} />
      <label style={labelStyle}>Country
        <select value={address.country} onChange={(event) => onChange({ ...address, country: event.target.value })}>
          <option value="GB">United Kingdom</option>
          <option value="IE">Ireland</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
        </select>
      </label>
    </fieldset>
  );
}

function emptyAddress(): AddressForm {
  return { line1: "", line2: "", city: "", region: "", postcode: "", country: "GB" };
}

function renderLicenceTable(licences: EnterpriseLicence[], portfolio: EnterprisePortfolio) {
  const orgName = (id: string) => portfolio.organisations.find((org) => org.id === id)?.name ?? "Unknown organisation";
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead><tr><th>Organisation</th><th>Plan</th><th>Licence status</th><th>Billing status</th><th>Purchased</th><th>Active</th><th>Invited</th><th>Available</th><th>Renewal</th><th>Account owner</th><th>Actions</th></tr></thead>
        <tbody>
          {licences.map((licence) => (
            <tr key={licence.id}>
              <td>{orgName(licence.organisationId)}</td>
              <td>{licence.plan === "custom" ? licence.customPlanName || "Custom" : labelise(licence.plan)}<small>{licence.contractReference ?? "No contract reference"}</small></td>
              <td>{labelise(licence.status)}</td>
              <td>{labelise(licence.billingStatus)}</td>
              <td>{licence.purchasedSeats}</td>
              <td>{licence.activeSeats}</td>
              <td>{licence.invitedSeats}</td>
              <td>{licence.availableSeats}</td>
              <td>{formatDate(licence.renewalDate)}<small>{labelise(licence.renewalRisk)}</small></td>
              <td>{licence.accountOwner ?? "Unassigned"}</td>
              <td style={actionsCellStyle}>
                <Link href={`/application/enterprise/licences/${licence.id}`}>View</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#settings`}>Edit</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#seats`}>Increase seats</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#seats`}>Reduce seats</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#renewals`}>Renew</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#settings`}>{licence.status === "suspended" ? "Reactivate" : "Suspend"}</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#settings`}>Cancel</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#seats`}>View users and seats</Link>
                <Link href={`/application/enterprise/licences/${licence.id}#audit`}>View audit history</Link>
              </td>
            </tr>
          ))}
          {licences.length === 0 ? <tr><td colSpan={11}>No licences match this view.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function utilisationBand(licence: EnterpriseLicence) {
  if (!licence.purchasedSeats && licence.committedSeats > 0) return "over_capacity";
  const percent = licence.purchasedSeats ? Math.round((licence.committedSeats / licence.purchasedSeats) * 100) : 0;
  if (percent > 100) return "over_capacity";
  if (percent <= 25) return "0_25";
  if (percent <= 50) return "26_50";
  if (percent <= 75) return "51_75";
  if (percent <= 90) return "76_90";
  return "91_100";
}

function FormInput({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return (
    <label style={labelStyle}>{label}{required ? " *" : ""}
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={tileStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function nextYearInput() {
  const next = new Date();
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function labelise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function parseBulkRows(value: string) {
  const [headerLine = "", ...lines] = value.split(/\r?\n/).filter((line) => line.trim());
  const headers = headerLine.split(",").map((item) => item.trim());
  return lines.map((line) => {
    const cells = line.split(",").map((item) => item.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc" };
const shellStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc", color: "#111827" };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 };
const headerActionsStyle: CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 18, boxShadow: "0 12px 30px rgba(15,23,42,.05)" };
const h1Style: CSSProperties = { margin: 0, fontSize: 28, lineHeight: 1.15 };
const h2Style: CSSProperties = { margin: "0 0 12px", fontSize: 18 };
const h3Style: CSSProperties = { margin: "18px 0 8px", fontSize: 15 };
const eyebrowStyle: CSSProperties = { margin: "0 0 8px", color: "#475569", fontSize: 12, textTransform: "uppercase", fontWeight: 800, letterSpacing: 0 };
const mutedStyle: CSSProperties = { color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 };
const privacyStyle: CSSProperties = { color: "#334155", background: "#f1f5f9", border: "1px solid #dbe3ef", borderRadius: 6, padding: 10, margin: "12px 0 0" };
const rowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 };
const secondaryLinkStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", textDecoration: "none", background: "#fff", fontWeight: 700 };
const secondaryButtonStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", background: "#fff", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#111827", color: "#fff", fontWeight: 800 };
const stageBadgeStyle: CSSProperties = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 900 };
const alertStyle: CSSProperties = { background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16 };
const tabListStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const tabStyle: CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "9px 12px", fontWeight: 700 };
const activeTabStyle: CSSProperties = { ...tabStyle, background: "#111827", color: "#fff", borderColor: "#111827" };
const filterBarStyle: CSSProperties = { ...panelStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, alignItems: "end", marginBottom: 16 };
const filterChipsStyle: CSSProperties = { gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" };
const chipStyle: CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 999, padding: "7px 10px", color: "#1e3a8a", fontWeight: 800 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const stackStyle: CSSProperties = { display: "grid", gap: 16 };
const twoColumnStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)", gap: 16, alignItems: "start" };
const metricButtonStyle: CSSProperties = { ...panelStyle, textAlign: "left", cursor: "pointer" };
const tileStyle: CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, padding: 12, background: "#f8fafc" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontWeight: 700, color: "#334155", fontSize: 13 };
const checkboxStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center", color: "#334155", fontWeight: 700 };
const fieldsetStyle: CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, padding: 12, display: "grid", gap: 10 };
const tableWrapStyle: CSSProperties = { overflowX: "auto" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const actionsCellStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
