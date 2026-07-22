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
    };
  };
  organisations: EnterpriseOrganisation[];
  licences: EnterpriseLicence[];
  invitations: EnterpriseInvitation[];
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
  country: string;
  status: string;
  risk: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  accountOwner: string | null;
  createdAt: string;
  updatedAt: string;
};

type EnterpriseLicence = {
  id: string;
  organisationId: string;
  plan: string;
  contractReference: string | null;
  startDate: string;
  renewalDate: string;
  purchasedSeats: number;
  allocatedSeats: number;
  activeSeats: number;
  invitedSeats: number;
  suspendedSeats: number;
  billingStatus: string;
  status: string;
  accountOwner: string | null;
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
  createdAt: string;
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
  licence: string;
  invitation: string;
  adoption: string;
  consent: string;
  risk: string;
  country: string;
};

type EnterpriseOrgForm = {
  legalName: string;
  tradingName: string;
  organisationType: string;
  organisationTypeOther: string;
  country: string;
  primaryContactName: string;
  primaryContactEmail: string;
  internalAccountOwner: string;
  adviserInsightConsent: boolean;
  marketingConsent: boolean;
  reportingConsent: boolean;
  exportPermission: boolean;
  minimumReportingCohort: number;
};

type EnterpriseLicenceForm = {
  organisationId: string;
  licencePlan: string;
  contractReference: string;
  startDate: string;
  renewalDate: string;
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
    seats: { purchased: 0, allocated: 0, active: 0, invited: 0, suspended: 0 },
  },
  organisations: [],
  licences: [],
  invitations: [],
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
  const [activeTab, setActiveTab] = useState<"overview" | "organisations" | "licences" | "invitations" | "adoption" | "reports" | "consent">("overview");
  const [filters, setFilters] = useState({
    organisation: "",
    status: "",
    licence: "",
    invitation: "",
    adoption: "",
    consent: "",
    risk: "",
    country: "",
  });
  const [orgForm, setOrgForm] = useState({
    legalName: "",
    tradingName: "",
    organisationType: "employer",
    organisationTypeOther: "",
    country: "GB",
    primaryContactName: "",
    primaryContactEmail: "",
    internalAccountOwner: "",
    adviserInsightConsent: false,
    marketingConsent: false,
    reportingConsent: true,
    exportPermission: false,
    minimumReportingCohort: 10,
  });
  const [licenceForm, setLicenceForm] = useState({
    organisationId: "",
    licencePlan: "standard",
    contractReference: "",
    startDate: todayInput(),
    renewalDate: nextYearInput(),
    purchasedSeats: 25,
    allocatedSeats: 0,
    billingStatus: "pending",
    licenceStatus: "pending_approval",
    accountOwner: "",
  });
  const [inviteForm, setInviteForm] = useState({
    organisationId: "",
    licenceId: "",
    email: "",
    fullName: "",
    invitationType: "enterprise_user",
    expiryDays: 14,
    requireMfa: false,
  });
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
      if (filters.organisation && !`${org.name} ${org.legalName}`.toLowerCase().includes(filters.organisation.toLowerCase())) return false;
      if (filters.status && org.status !== filters.status) return false;
      if (filters.risk && org.risk !== filters.risk) return false;
      if (filters.country && org.country.toLowerCase() !== filters.country.toLowerCase()) return false;
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
  const filteredLicences = portfolio.licences.filter((licence) => visibleOrganisationIds.has(licence.organisationId) && (!filters.licence || licence.status === filters.licence));
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
          <span style={stageBadgeStyle}>STAGING</span>
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
          ["invitations", "Invitations"],
          ["adoption", "Adoption"],
          ["reports", "Reports"],
          ["consent", "Consent"],
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key as typeof activeTab)} style={activeTab === key ? activeTabStyle : tabStyle}>
            {label}
          </button>
        ))}
      </nav>

      {renderFilterBar(filters, setFilters, () => setFilters({ organisation: "", status: "", licence: "", invitation: "", adoption: "", consent: "", risk: "", country: "" }), () => runAction("save_view", { name: savedViewName || "Enterprise portfolio view", viewType: activeTab, filters }), savedViewName, setSavedViewName)}

      {activeTab === "overview" ? renderOverview(portfolio, filteredOrganisations, filteredLicences, filteredInvitations, setActiveTab) : null}
      {activeTab === "organisations" ? renderOrganisations(filteredOrganisations, portfolio, orgForm, setOrgForm, () => runAction("create_organisation", orgForm)) : null}
      {activeTab === "licences" ? renderLicences(filteredLicences, portfolio, licenceForm, setLicenceForm, () => runAction("create_licence", licenceForm)) : null}
      {activeTab === "invitations" ? renderInvitations(filteredInvitations, portfolio, inviteForm, setInviteForm, runAction) : null}
      {activeTab === "adoption" ? renderAdoption(portfolio, filteredOrganisations) : null}
      {activeTab === "reports" ? renderReports(portfolio, () => runAction("export_report", { reportType: "portfolio" })) : null}
      {activeTab === "consent" ? renderConsent(portfolio, filteredOrganisations) : null}
    </main>
  );
}

function renderOverview(
  portfolio: EnterprisePortfolio,
  organisations: EnterpriseOrganisation[],
  licences: EnterpriseLicence[],
  invitations: EnterpriseInvitation[],
  setActiveTab: (tab: "overview" | "organisations" | "licences" | "invitations" | "adoption" | "reports" | "consent") => void,
) {
  const cards = [
    { label: "Licensed organisations", value: portfolio.summary.organisations, tab: "organisations" as const },
    { label: "Active licences", value: portfolio.summary.activeLicences, tab: "licences" as const },
    { label: "Seats used", value: `${portfolio.summary.seats.active}/${portfolio.summary.seats.purchased}`, tab: "licences" as const },
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
  submit: () => void,
) {
  return (
    <div style={twoColumnStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Create organisation</h2>
        <FormInput label="Legal name" required value={String(form.legalName)} onChange={(value) => setForm({ ...form, legalName: value })} />
        <FormInput label="Trading name" value={String(form.tradingName)} onChange={(value) => setForm({ ...form, tradingName: value })} />
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
        <FormInput label="Primary contact email" value={String(form.primaryContactEmail)} onChange={(value) => setForm({ ...form, primaryContactEmail: value })} />
        <FormInput label="Internal account owner" value={String(form.internalAccountOwner)} onChange={(value) => setForm({ ...form, internalAccountOwner: value })} />
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.reportingConsent)} onChange={(event) => setForm({ ...form, reportingConsent: event.target.checked })} /> Reporting consent</label>
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.adviserInsightConsent)} onChange={(event) => setForm({ ...form, adviserInsightConsent: event.target.checked })} /> Adviser insight consent</label>
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.exportPermission)} onChange={(event) => setForm({ ...form, exportPermission: event.target.checked })} /> Export permission</label>
        <button type="button" style={primaryButtonStyle} onClick={submit}>Create organisation</button>
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Organisations</h2>
        {renderOrganisationTable(organisations, portfolio)}
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
  return (
    <div style={twoColumnStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Create licence</h2>
        <label style={labelStyle}>Organisation
          <select value={String(form.organisationId)} onChange={(event) => setForm({ ...form, organisationId: event.target.value })}>
            <option value="">Select organisation</option>
            {portfolio.organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
        <FormInput label="Licence plan" required value={String(form.licencePlan)} onChange={(value) => setForm({ ...form, licencePlan: value })} />
        <FormInput label="Contract reference" value={String(form.contractReference)} onChange={(value) => setForm({ ...form, contractReference: value })} />
        <FormInput label="Start date" type="date" required value={String(form.startDate)} onChange={(value) => setForm({ ...form, startDate: value })} />
        <FormInput label="Renewal date" type="date" required value={String(form.renewalDate)} onChange={(value) => setForm({ ...form, renewalDate: value })} />
        <FormInput label="Purchased seats" type="number" required value={String(form.purchasedSeats)} onChange={(value) => setForm({ ...form, purchasedSeats: Number(value) })} />
        <FormInput label="Allocated seats" type="number" value={String(form.allocatedSeats)} onChange={(value) => setForm({ ...form, allocatedSeats: Number(value) })} />
        <FormInput label="Account owner" value={String(form.accountOwner)} onChange={(value) => setForm({ ...form, accountOwner: value })} />
        <button type="button" style={primaryButtonStyle} onClick={submit}>Create licence</button>
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Licences</h2>
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
  runAction: (action: string, payload: Record<string, unknown>) => void,
) {
  const orgLicences = portfolio.licences.filter((licence) => licence.organisationId === form.organisationId);
  return (
    <div style={twoColumnStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Send invitation</h2>
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
        <FormInput label="Email" required value={String(form.email)} onChange={(value) => setForm({ ...form, email: value })} />
        <FormInput label="Full name" value={String(form.fullName)} onChange={(value) => setForm({ ...form, fullName: value })} />
        <FormInput label="Expiry days" type="number" value={String(form.expiryDays)} onChange={(value) => setForm({ ...form, expiryDays: Number(value) })} />
        <label style={checkboxStyle}><input type="checkbox" checked={Boolean(form.requireMfa)} onChange={(event) => setForm({ ...form, requireMfa: event.target.checked })} /> Require MFA</label>
        <button type="button" style={primaryButtonStyle} onClick={() => runAction(form.invitationType === "organisation_admin" ? "invite_organisation_admin" : "invite_enterprise_user", form)}>Send invitation</button>
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Invitations</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Recipient</th><th>Type</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              {invitations.map((item) => (
                <tr key={item.id}>
                  <td>{item.fullName || item.email}<small>{item.email}</small></td>
                  <td>{labelise(item.invitationType)}</td>
                  <td>{labelise(item.status)}</td>
                  <td>{formatDate(item.expiresAt)}</td>
                  <td style={actionsCellStyle}>
                    <button type="button" onClick={() => runAction("update_invitation", { invitationId: item.id, status: "sent" })}>Resend</button>
                    <button type="button" onClick={() => runAction("update_invitation", { invitationId: item.id, status: "revoked" })}>Revoke</button>
                  </td>
                </tr>
              ))}
              {invitations.length === 0 ? <tr><td colSpan={5}>No enterprise invitations match this view.</td></tr> : null}
            </tbody>
          </table>
        </div>
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

function renderFilterBar(
  filters: EnterpriseFilters,
  setFilters: (value: EnterpriseFilters) => void,
  clear: () => void,
  save: () => void,
  savedViewName: string,
  setSavedViewName: (value: string) => void,
) {
  return (
    <section style={filterBarStyle} aria-label="Enterprise filters">
      <FormInput label="Organisation" value={filters.organisation} onChange={(value) => setFilters({ ...filters, organisation: value })} />
      <label style={labelStyle}>Status
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">Any</option>
          <option value="pending_setup">Pending setup</option>
          <option value="pending_administrator_acceptance">Pending administrator acceptance</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expiring">Expiring</option>
          <option value="cancelled">Cancelled</option>
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
      <button type="button" style={secondaryButtonStyle} onClick={clear}>Clear</button>
      <FormInput label="Saved view name" value={savedViewName} onChange={setSavedViewName} />
      <button type="button" style={secondaryButtonStyle} onClick={save}>Save view</button>
    </section>
  );
}

function renderOrganisationTable(organisations: EnterpriseOrganisation[], portfolio: EnterprisePortfolio) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead><tr><th>Organisation</th><th>Type</th><th>Status</th><th>Licence seats</th><th>Consent</th><th>Risk</th></tr></thead>
        <tbody>
          {organisations.map((org) => {
            const orgLicences = portfolio.licences.filter((licence) => licence.organisationId === org.id);
            const seats = orgLicences.reduce((sum, licence) => sum + licence.purchasedSeats, 0);
            const active = orgLicences.reduce((sum, licence) => sum + licence.activeSeats, 0);
            const consent = portfolio.consent[org.id];
            return (
              <tr key={org.id}>
                <td>{org.name}<small>{org.primaryContactEmail ?? "No admin invitation yet"}</small></td>
                <td>{labelise(org.type)}</td>
                <td>{labelise(org.status)}</td>
                <td>{active}/{seats}</td>
                <td>{consent?.reportingConsent && consent?.adviserInsightConsent ? "Reportable" : "Restricted"}</td>
                <td>{labelise(org.risk)}</td>
              </tr>
            );
          })}
          {organisations.length === 0 ? <tr><td colSpan={6}>No organisations match this view. Create an organisation if your role permits it.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function renderLicenceTable(licences: EnterpriseLicence[], portfolio: EnterprisePortfolio) {
  const orgName = (id: string) => portfolio.organisations.find((org) => org.id === id)?.name ?? "Unknown organisation";
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead><tr><th>Organisation</th><th>Plan</th><th>Status</th><th>Seats</th><th>Renewal</th><th>Billing</th></tr></thead>
        <tbody>
          {licences.map((licence) => (
            <tr key={licence.id}>
              <td>{orgName(licence.organisationId)}</td>
              <td>{licence.plan}<small>{licence.contractReference ?? "No contract reference"}</small></td>
              <td>{labelise(licence.status)}</td>
              <td>{licence.allocatedSeats}/{licence.purchasedSeats}<small>{licence.activeSeats} active · {licence.invitedSeats} invited</small></td>
              <td>{formatDate(licence.renewalDate)}</td>
              <td>{labelise(licence.billingStatus)}</td>
            </tr>
          ))}
          {licences.length === 0 ? <tr><td colSpan={6}>No licences match this view.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
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

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc" };
const shellStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc", color: "#111827" };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 };
const headerActionsStyle: CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 18, boxShadow: "0 12px 30px rgba(15,23,42,.05)" };
const h1Style: CSSProperties = { margin: 0, fontSize: 28, lineHeight: 1.15 };
const h2Style: CSSProperties = { margin: "0 0 12px", fontSize: 18 };
const eyebrowStyle: CSSProperties = { margin: "0 0 8px", color: "#475569", fontSize: 12, textTransform: "uppercase", fontWeight: 800, letterSpacing: 0 };
const mutedStyle: CSSProperties = { color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 };
const privacyStyle: CSSProperties = { color: "#334155", background: "#f1f5f9", border: "1px solid #dbe3ef", borderRadius: 6, padding: 10, margin: "12px 0 0" };
const rowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const secondaryLinkStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", textDecoration: "none", background: "#fff", fontWeight: 700 };
const secondaryButtonStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", background: "#fff", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#111827", color: "#fff", fontWeight: 800 };
const stageBadgeStyle: CSSProperties = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 900 };
const alertStyle: CSSProperties = { background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16 };
const tabListStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const tabStyle: CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "9px 12px", fontWeight: 700 };
const activeTabStyle: CSSProperties = { ...tabStyle, background: "#111827", color: "#fff", borderColor: "#111827" };
const filterBarStyle: CSSProperties = { ...panelStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, alignItems: "end", marginBottom: 16 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const stackStyle: CSSProperties = { display: "grid", gap: 16 };
const twoColumnStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)", gap: 16, alignItems: "start" };
const metricButtonStyle: CSSProperties = { ...panelStyle, textAlign: "left", cursor: "pointer" };
const tileStyle: CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, padding: 12, background: "#f8fafc" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontWeight: 700, color: "#334155", fontSize: 13 };
const checkboxStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center", color: "#334155", fontWeight: 700 };
const tableWrapStyle: CSSProperties = { overflowX: "auto" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const actionsCellStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
