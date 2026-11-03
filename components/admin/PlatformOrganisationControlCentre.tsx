"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { waitForActiveUser } from "@/lib/auth/session";
import { AdminFilterChips, AdminNote, AdminStatStrip, AdminStatusBadge as StatusChip } from "@/components/admin/AdminPrimitives";
import Icon from "@/components/ui/Icon";
import AdminWorkspaceShell from "@/components/admin/AdminWorkspaceShell";
import { PLATFORM_ADMIN_NAVIGATION, filterAdminNavigation } from "@/components/admin/adminNavigation";
import type { CSSProperties, FormEvent, ReactNode } from "react";

type Organisation = {
  id: string;
  name: string;
  legalName: string;
  tradingName: string | null;
  type: string;
  registrationNumber: string | null;
  country: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  accountOwner: string | null;
  customerReference: string | null;
  nominatedAdminName: string | null;
  nominatedAdminEmail: string | null;
  onboardingStatus: string;
  status: string;
  risk: string;
  createdAt: string;
  updatedAt: string;
};

type Licence = {
  id: string;
  organisationId: string;
  plan: string;
  status: string;
  billingStatus: string;
  purchasedSeats: number;
  allocatedSeats: number;
  activeSeats: number;
  invitedSeats: number;
  suspendedSeats: number;
  availableSeats: number;
  renewalDate: string;
};

type Invitation = {
  id: string;
  organisationId: string;
  email: string;
  fullName: string | null;
  type: string;
  roleTemplate: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  failureReason: string | null;
  createdAt: string;
};
type EnrolmentLink = { id: string; displayName: string; status: string; expiresAt: string; maxClaims: number; claimsUsed: number; licenceId: string; };

type Membership = { id: string; organisationId: string; email: string; fullName: string | null; organisationRole: string; status: string };
type AuditEvent = { id: string; action: string; result: string; actor_email_normalized: string | null; created_at: string; resource_label: string | null };
type Portfolio = { organisations: Organisation[]; licences: Licence[]; invitations: Invitation[]; memberships: Membership[] };
type Detail = { organisation: Organisation; licences: Licence[]; invitations: Invitation[]; memberships: Membership[]; enrolmentLinks: EnrolmentLink[]; auditEvents: AuditEvent[]; privacyBoundary: { vaultContentExcluded: boolean; documentContentExcluded: boolean; financialValuesExcluded: boolean } };
type Session = { role: string; capabilities: string[]; displayName: string; email: string };

const EMPTY_FORM = { legalName: "", tradingName: "", organisationType: "employer", country: "GB", primaryContactName: "", primaryContactEmail: "", internalAccountOwner: "", registrationNumber: "", customerReference: "", initialStatus: "pending_setup", riskStatus: "normal" };
const TODAY = new Date().toISOString().slice(0, 10);
const ENTERPRISE_ORGANISATION_TYPES = ["employer", "law_firm", "wealth_manager", "insurer", "funeral_provider", "employee_benefit_provider", "enterprise_reseller", "other"];
const ENTERPRISE_ORGANISATION_STATUSES = ["draft", "pending_setup", "pending_administrator_acceptance", "active", "suspended", "expiring", "cancelled", "archived"];
const ENTERPRISE_RISK_STATUSES = ["normal", "watch", "at_risk", "critical", "restricted"];

export default function PlatformOrganisationControlCentre({ organisationId }: { organisationId?: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [licenceFilter, setLicenceFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [licenceOpen, setLicenceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<"suspend" | "reactivate" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [licenceForm, setLicenceForm] = useState({ licencePlan: "starter", startDate: TODAY, renewalDate: nextYearDate(), purchasedSeats: "10", licenceStatus: "pending_approval", billingStatus: "not_configured" });
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", expiryDays: "14", requireMfa: true });
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const headers = new Headers(init?.headers ?? {});
    if (sessionRes.data.session?.access_token) headers.set("authorization", `Bearer ${sessionRes.data.session.access_token}`);
    if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const load = useCallback(async () => {
    setState("checking");
    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
      if (!user) { setState("denied"); return; }
      const sessionRes = await authFetch("/api/internal/admin/session");
      const sessionJson = await sessionRes.json().catch(() => ({})) as { ok?: boolean; admin?: Session };
      if (!sessionRes.ok || !sessionJson.ok || !sessionJson.admin) { setState(sessionRes.status === 403 ? "denied" : "error"); return; }
      setSession(sessionJson.admin);
      const endpoint = organisationId ? `/api/internal/admin/enterprise?organisationId=${encodeURIComponent(organisationId)}` : "/api/internal/admin/enterprise";
      const dataRes = await authFetch(endpoint);
      const dataJson = await dataRes.json().catch(() => ({})) as { portfolio?: Portfolio; detail?: Detail; message?: string };
      if (!dataRes.ok) { setMessage(dataJson.message || "The organisation data could not be loaded."); setState(dataRes.status === 403 ? "denied" : "error"); return; }
      if (organisationId) setDetail(dataJson.detail ?? null); else setPortfolio(dataJson.portfolio ?? null);
      setState("ready");
    } catch {
      setMessage("The commercial service could not be reached. Try again.");
      setState("error");
    }
  }, [authFetch, organisationId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!formOpen && !editOpen && !licenceOpen && !inviteOpen && !confirmState) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") closeDialogs(); }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); };
  }, [confirmState, editOpen, formOpen, inviteOpen, licenceOpen]);

  function closeDialogs() { setFormOpen(false); setEditOpen(false); setLicenceOpen(false); setInviteOpen(false); setConfirmState(null); }

  async function runAction(action: string, payload: Record<string, unknown>, doneMessage = "Saved. The change is in the audit log."): Promise<Record<string, unknown> | false> {
    setSaving(true); setMessage("");
    try {
      const response = await authFetch("/api/internal/admin/enterprise", { method: "POST", body: JSON.stringify({ action, ...payload }) });
      const json = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok || json.ok !== true) { setMessage(String(json.message || "The commercial action was blocked.")); return false; }
      closeDialogs(); await load(); setMessage(doneMessage); return json;
    } catch {
      setMessage("The commercial action could not be reached. No change was confirmed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitOrganisation(event: FormEvent) {
    event.preventDefault();
    if (!form.legalName.trim() || !form.primaryContactEmail.trim() || !form.internalAccountOwner.trim()) { setMessage("Legal name, primary contact email and internal account owner are required."); return; }
    const result = await runAction("create_organisation", form);
    const created = result !== false ? (result.organisation as { id?: string } | undefined) : undefined;
    if (created?.id) router.replace(`/admin/organisations/${created.id}`);
  }

  async function submitEdit(event: FormEvent) { event.preventDefault(); if (!detail) return; await runAction("update_organisation", { organisationId: detail.organisation.id, ...form, expectedUpdatedAt: detail.organisation.updatedAt }); }

  async function submitLicence(event: FormEvent) { event.preventDefault(); if (!detail) return; await runAction("create_licence", { organisationId: detail.organisation.id, ...licenceForm, purchasedSeats: Number(licenceForm.purchasedSeats) }); }

  async function submitInvite(event: FormEvent) { event.preventDefault(); if (!detail) return; await runAction("invite_organisation_admin", { organisationId: detail.organisation.id, ...inviteForm, expiryDays: Number(inviteForm.expiryDays), roleTemplate: "organisation_admin" }); }

  const capabilities = session?.capabilities ?? [];
  const canManage = capabilities.includes("organisation:manage");
  const canCreateLicence = capabilities.includes("licence:create");
  const canInvite = capabilities.includes("enterprise.invitation.manage");
  const canEnterpriseHandoff = session?.role === "super_admin" || session?.role === "enterprise_admin";
  const navigation = filterAdminNavigation(PLATFORM_ADMIN_NAVIGATION, capabilities);
  const currentLabel = organisationId ? "Organisation detail" : "Organisations";
  const identity = session ? { label: session.displayName, detail: session.email } : undefined;

  if (state === "checking") return <main style={pageStyle}><section style={panelStyle}><p style={eyebrowStyle}>Platform Administration</p><h1>Loading commercial register</h1></section></main>;
  if (state === "denied") return <main style={pageStyle}><section style={panelStyle}><p style={eyebrowStyle}>Platform Administration</p><h1>Access denied</h1><p>You do not have permission to operate the platform commercial register.</p></section></main>;
  if (state === "error" || !session) return <main style={pageStyle}><section style={panelStyle}><p style={eyebrowStyle}>Platform Administration</p><h1>Commercial register unavailable</h1><p>{message || "Try again later."}</p></section></main>;

  return (
    <AdminWorkspaceShell workspaceLabel="Platform Administration" eyebrow="Commercial" title={organisationId ? (detail?.organisation.name ?? currentLabel) : currentLabel} description={organisationId ? "Licence, seats, administrators and activity for this organisation. Members’ Vaults are never shown." : "Partner organisations, their licences and administrators. Members’ Vaults are never shown."} breadcrumbs={organisationId ? [{ label: "Commercial" }, { label: "Organisations", href: "/admin/organisations" }, { label: detail?.organisation.name ?? "Organisation" }] : [{ label: "Commercial" }, { label: "Organisations" }]} primaryAction={!organisationId && canManage ? <button type="button" style={primaryButtonStyle} onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }}><Icon name="domain_add" size={18} /> Add organisation</button> : undefined} currentPathname={organisationId ? `/admin/organisations/${organisationId}` : "/admin/organisations"} navigation={navigation} onSignOut={() => { void supabase.auth.signOut(); window.location.assign("/sign-in"); }} identityLabel={identity?.label} identityDetail={identity?.detail} adminRole={session?.role}>
      {message ? <div role="status" style={alertStyle}>{message}</div> : null}
      {organisationId && detail ? renderDetail() : renderRegister()}
      {formOpen ? <Modal title="New organisation" onClose={closeDialogs}><OrganisationForm value={form} onChange={setForm} onSubmit={submitOrganisation} onCancel={closeDialogs} saving={saving} /></Modal> : null}
      {editOpen ? <Modal title="Edit organisation" onClose={closeDialogs}><OrganisationForm value={form} onChange={setForm} onSubmit={submitEdit} onCancel={closeDialogs} saving={saving} submitLabel="Save organisation" /></Modal> : null}
      {licenceOpen ? <Modal title="Allocate licence" onClose={closeDialogs}><LicenceForm value={licenceForm} onChange={setLicenceForm} onSubmit={submitLicence} onCancel={closeDialogs} saving={saving} /></Modal> : null}
      {inviteOpen ? <Modal title="Invite organisation administrator" onClose={closeDialogs}><InviteForm value={inviteForm} onChange={setInviteForm} onSubmit={submitInvite} onCancel={closeDialogs} saving={saving} /></Modal> : null}
      {confirmState && detail ? <Modal title={confirmState === "suspend" ? `Suspend ${detail.organisation.name}?` : `Reactivate ${detail.organisation.name}?`} onClose={closeDialogs}><p style={mutedStyle}>{confirmState === "suspend" ? "Members keep their own Vaults but lose organisation access until it’s restored." : "Members get organisation access back. Their own Vaults aren’t affected."}</p><label style={labelStyle}>Reason (Required)<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Saved to the audit log" /></label><div style={actionRowStyle}><button type="button" onClick={closeDialogs} style={secondaryButtonStyle}>Cancel</button><button type="button" disabled={saving || !reason.trim()} onClick={() => void runAction("transition_organisation", { organisationId: detail.organisation.id, status: confirmState === "suspend" ? "suspended" : "active", reason: reason.trim() }, confirmState === "suspend" ? `${detail.organisation.name} suspended.` : `${detail.organisation.name} reactivated.`)} style={confirmState === "suspend" ? dangerButtonStyle : primaryButtonStyle}>{saving ? "Saving…" : confirmState === "suspend" ? "Suspend organisation" : "Reactivate organisation"}</button></div></Modal> : null}
    </AdminWorkspaceShell>
  );

  function renderRegister() {
    const organisations = portfolio?.organisations ?? [];
    const licences = portfolio?.licences ?? [];
    const invitations = portfolio?.invitations ?? [];
    const rows = organisations.filter((org) => {
      const licence = licences.find((item) => item.organisationId === org.id);
      const text = `${org.name} ${org.legalName} ${org.tradingName ?? ""} ${org.registrationNumber ?? ""} ${org.primaryContactEmail ?? ""} ${org.nominatedAdminEmail ?? ""} ${org.id}`.toLowerCase();
      return (!search || text.includes(search.toLowerCase())) && (!statusFilter || org.status === statusFilter) && (!typeFilter || org.type === typeFilter) && (!licenceFilter || (licenceFilter === "none" ? !licence : licence?.status === licenceFilter));
    }).sort((a, b) => sort === "renewal" ? (renewalFor(a, licences) || "9999").localeCompare(renewalFor(b, licences) || "9999") : sort === "capacity" ? availableFor(b, licences) - availableFor(a, licences) : a.name.localeCompare(b.name));
    const totalPurchased = licences.reduce((sum, licence) => sum + licence.purchasedSeats, 0);
    const totalActive = licences.reduce((sum, licence) => sum + licence.activeSeats, 0);
    const atRisk = organisations.filter((org) => ["at_risk", "critical", "restricted"].includes(org.risk)).length;
    const typesPresent = ENTERPRISE_ORGANISATION_TYPES.filter((type) => organisations.some((org) => org.type === type));
    const typeChip = licenceFilter === "none" ? "none" : typeFilter || "all";
    return <div style={stackStyle}>
      <AdminStatStrip label="Organisation totals" items={[
        { label: "Organisations", value: organisations.length },
        { label: "Seats bought", value: totalPurchased },
        { label: "Seats in use", value: totalActive },
        { label: "At risk", value: atRisk },
      ]} />
      <section className="lf-admin-toolbar" aria-label="Organisation search and filters">
        <label className="lf-admin-search"><Icon name="search" size={18} /><span className="lf-visually-hidden">Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or reference" /></label>
        <AdminFilterChips label="Filter by type" value={typeChip} onChange={(key) => { if (key === "none") { setTypeFilter(""); setLicenceFilter("none"); } else { setLicenceFilter(""); setTypeFilter(key === "all" ? "" : key); } }} options={[
          { key: "all", label: "All", count: organisations.length },
          ...typesPresent.map((type) => ({ key: type, label: pluralType(type), count: organisations.filter((org) => org.type === type).length })),
          { key: "none", label: "No licence", count: organisations.filter((org) => !licences.some((licence) => licence.organisationId === org.id)).length },
        ]} />
        <details className="lf-admin-more-filters">
          <summary>More filters</summary>
          <div style={filterStyle}>
            <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{ENTERPRISE_ORGANISATION_STATUSES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label>
            <label>Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{ENTERPRISE_ORGANISATION_TYPES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label>
            <label>Licence<select value={licenceFilter} onChange={(event) => setLicenceFilter(event.target.value)}><option value="">All licence states</option><option value="active">Active</option><option value="pending_approval">Pending approval</option><option value="suspended">Suspended</option><option value="expired">Expired</option><option value="none">No licence</option></select></label>
            <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Organisation name</option><option value="renewal">Renewal date</option><option value="capacity">Available capacity</option></select></label>
          </div>
        </details>
      </section>
      <section className="lf-admin-table-card" style={{ overflowX: "auto" }}><table className="lf-admin-data-table"><caption>Platform organisation register</caption><thead><tr><th>Organisation</th><th>Type</th><th>Licence</th><th>Administrator</th><th>Status</th><th><span className="lf-visually-hidden">Open</span></th></tr></thead><tbody>{rows.map((org) => { const licence = licences.find((item) => item.organisationId === org.id); const pending = invitations.filter((item) => item.organisationId === org.id && ["draft", "scheduled", "sent", "delivered"].includes(item.status)).length; return <tr key={org.id}><td><Link href={`/admin/organisations/${org.id}`} className="lf-admin-cell-title">{org.name}</Link><small>{org.registrationNumber || org.legalName}</small></td><td>{sentence(org.type)}</td><td>{licence ? <>{licence.activeSeats} of {licence.purchasedSeats} seats<small>{sentence(licence.plan)}{licence.renewalDate ? ` · renews ${formatDate(licence.renewalDate)}` : ""}</small></> : "No licence"}</td><td>{org.nominatedAdminName || org.nominatedAdminEmail ? <>{org.nominatedAdminName || org.nominatedAdminEmail}<small>{pending ? `${pending} invitation${pending === 1 ? "" : "s"} waiting` : org.nominatedAdminEmail || ""}</small></> : <StatusChip status={pending ? "pending" : "not_invited"} label={pending ? "Invitation sent" : "Not invited"} />}</td><td><StatusChip status={org.status} /></td><td><Link href={`/admin/organisations/${org.id}`} className="lf-admin-row-chevron" aria-label={`Open ${org.name}`}><Icon name="chevron_right" size={20} /></Link></td></tr>; })}{rows.length === 0 ? <tr><td colSpan={6}><div style={emptyStyle}><strong>No organisations match</strong><span>Change the search or filters, or add a new organisation.</span></div></td></tr> : null}</tbody></table><div className="lf-platform-organisation-cards" aria-label="Platform organisation register mobile cards">{rows.map((org) => { const licence = licences.find((item) => item.organisationId === org.id); return <Link key={org.id} href={`/admin/organisations/${org.id}`} className="lf-platform-organisation-card"><div><strong>{org.name}</strong><small>{licence ? `${sentence(licence.plan)} · ${licence.activeSeats} of ${licence.purchasedSeats} seats` : "No licence"}</small></div><StatusChip status={org.status} /><Icon name="chevron_right" size={20} /></Link>; })}</div></section>
    </div>;
  }

  function renderDetail() {
    if (!detail) return null;
    // ADMIN_PARTNER page template + side-panel content (Admin Console › Organisations): key details,
    // seats, administrators, members and activity. Counts and organisation details only.
    const org = detail.organisation;
    const licence = detail.licences[0];
    const administratorInvitations = detail.invitations.filter((item) => item.roleTemplate === "organisation_admin");
    const activeRegistrationLinks = detail.enrolmentLinks.filter((item) => item.status === "active");
    const pendingInvitations = detail.invitations.filter((item) => ["draft", "scheduled", "sent", "delivered"].includes(item.status)).length;
    const canSuspend = canManage && ["active", "pending_setup", "pending_administrator_acceptance", "expiring"].includes(org.status);
    const canReactivate = canManage && org.status === "suspended";
    const closed = ["suspended", "cancelled", "archived"].includes(org.status);
    return <div className="lf-admin-detail">
      <header className="lf-admin-detail-head">
        <div>
          <h2>{org.name}</h2>
          <p>{sentence(org.type)}{org.customerReference ? ` · ${org.customerReference}` : ""} · updated {formatDate(org.updatedAt)}</p>
        </div>
        <div className="lf-admin-decision-actions"><StatusChip status={org.status} />{org.risk !== "normal" ? <StatusChip status={org.risk} label={`Risk: ${sentence(org.risk).toLowerCase()}`} /> : null}</div>
      </header>
      <AdminStatStrip label="Seats" items={[
        { label: "Seats bought", value: licence ? licence.purchasedSeats : 0 },
        { label: "In use", value: licence ? licence.activeSeats : 0 },
        { label: "Reserved by invitations", value: licence ? licence.invitedSeats : 0 },
        { label: "Suspended", value: licence ? licence.suspendedSeats : 0 },
        { label: "Available", value: licence ? licence.availableSeats : 0 },
      ]} />
      <div className="lf-admin-detail-grid">
        <div className="lf-admin-detail-main">
          <section className="lf-admin-table-card" aria-labelledby="org-details-title">
            <h2 id="org-details-title">Details</h2>
            <dl className="lf-admin-keyvalues">
              <div><dt>Legal name</dt><dd>{org.legalName}{org.tradingName ? <small>Trading as {org.tradingName}</small> : null}</dd></div>
              <div><dt>Type</dt><dd>{sentence(org.type)}</dd></div>
              <div><dt>Reference</dt><dd><code>{org.customerReference || org.registrationNumber || org.id}</code></dd></div>
              <div><dt>Licence</dt><dd>{licence ? <>{sentence(licence.plan)} · {licence.activeSeats} of {licence.purchasedSeats} seats<small>{sentence(licence.status)} · renews {formatDate(licence.renewalDate)}</small></> : "No licence"}</dd></div>
              <div><dt>Billing</dt><dd>{licence ? sentence(licence.billingStatus) : "Not set up"}</dd></div>
              <div><dt>Administrator</dt><dd>{org.nominatedAdminName || org.nominatedAdminEmail || "Not invited"}{org.nominatedAdminName && org.nominatedAdminEmail ? <small>{org.nominatedAdminEmail}</small> : null}</dd></div>
              <div><dt>Primary contact</dt><dd>{org.primaryContactName || org.primaryContactEmail || "Not added"}{org.primaryContactName && org.primaryContactEmail ? <small>{org.primaryContactEmail}</small> : null}</dd></div>
              <div><dt>Account owner</dt><dd>{org.accountOwner || "Unassigned"}</dd></div>
              <div><dt>Onboarding</dt><dd>{sentence(org.onboardingStatus)}</dd></div>
              <div><dt>Risk</dt><dd>{sentence(org.risk)}</dd></div>
            </dl>
          </section>
          <section className="lf-admin-table-card" aria-labelledby="org-admins-title">
            <h2 id="org-admins-title">Administrators</h2>
            {administratorInvitations.length ? <ul className="lf-admin-plain-list lf-admin-card-list">{administratorInvitations.slice(0, 5).map((item) => <li key={item.id}><strong>{item.fullName || item.email}</strong><small>{item.email} · {sentence(item.status)}{item.status === "accepted" ? "" : ` · expires ${formatDate(item.expiresAt)}`}</small></li>)}</ul>
              : <div style={emptyStyle}><strong>No administrator yet</strong><span>Invite the organisation’s first administrator. They manage their own team and seats.</span></div>}
            <p className="lf-admin-card-foot"><Link href={`/admin/organisations/${org.id}/invitations`}>Manage administrators</Link></p>
          </section>
          {/* Registration lifecycle. Status-based operational counts only. It does not measure user engagement or Personal Vault adoption. */}
          <section className="lf-admin-table-card" aria-labelledby="org-members-title">
            <h2 id="org-members-title">Members and invitations</h2>
            <dl className="lf-admin-keyvalues">
              <div><dt>Pending invitations</dt><dd>{pendingInvitations}</dd></div>
              <div><dt>Accepted</dt><dd>{detail.invitations.filter((item) => item.status === "accepted").length}</dd></div>
              <div><dt>Active memberships</dt><dd>{detail.memberships.filter((item) => item.status === "active").length}</dd></div>
              <div><dt>Suspended memberships</dt><dd>{detail.memberships.filter((item) => item.status === "suspended").length}</dd></div>
              <div><dt>Registration links</dt><dd>{activeRegistrationLinks.length} active<small>Claims used {detail.enrolmentLinks.reduce((sum, item) => sum + item.claimsUsed, 0)}</small></dd></div>
            </dl>
            <p className="lf-admin-card-foot">{detail.memberships.length ? <Link href={`/admin/organisations/${org.id}/users`}>Members</Link> : null}{canEnterpriseHandoff ? <Link href="/enterprise?tab=registration-links">Registration links</Link> : null}</p>
          </section>
          <details className="lf-admin-table-card lf-admin-history">
            <summary><h2>Recent activity</h2><span>{detail.auditEvents.length} event{detail.auditEvents.length === 1 ? "" : "s"}</span></summary>
            {detail.auditEvents.length ? <ol>{detail.auditEvents.slice(0, 10).map((event) => <li key={event.id}><strong>{sentence(event.action.replace(/[._]/g, " "))}</strong><span>{sentence(event.result)} · {event.actor_email_normalized || "System"}</span><small>{formatDateTime(event.created_at)}</small></li>)}</ol>
              : <p className="lf-admin-muted" style={{ padding: "0 18px 16px" }}>Changes to this organisation will appear here.</p>}
            <p className="lf-admin-card-foot"><Link href={`/admin/audit?resource=organisation:${org.id}`}>Open audit log</Link></p>
          </details>
        </div>
        <aside className="lf-admin-detail-rail">
          <section className="lf-admin-table-card lf-admin-form-card" aria-label="Actions">
            <h2>Actions</h2>
            {!canManage && !canInvite && !canCreateLicence ? <p className="lf-admin-muted">You can look at this organisation but your role can’t change it.</p> : <>
              <div className="lf-admin-decision-actions">
                {canManage ? <button type="button" className="lf-admin-row-button" onClick={() => { setForm(toForm(org)); setEditOpen(true); }}>Edit details</button> : null}
                {canInvite ? <button type="button" className="lf-admin-row-button" disabled={closed} onClick={() => setInviteOpen(true)}>Invite administrator</button> : null}
              </div>
              <div className="lf-admin-decision-footer">
                {canSuspend || canReactivate ? <button type="button" className={canReactivate ? "lf-admin-row-button" : "lf-admin-danger-button"} onClick={() => { setReason(""); setConfirmState(canReactivate ? "reactivate" : "suspend"); }}>{canReactivate ? "Reactivate" : "Suspend"}</button> : <span />}
                {licence ? <Link href={`/admin/licences/${licence.id}`} className="lf-admin-primary-button">Manage licence</Link> : canCreateLicence ? <button type="button" className="lf-admin-primary-button" disabled={closed} onClick={() => setLicenceOpen(true)}>Set up licence</button> : null}
              </div>
            </>}
          </section>
          <AdminNote icon="lock">Only organisation, licence and membership details are shown. Members’ Vaults stay private: no record names, values, notes or documents.</AdminNote>
        </aside>
      </div>
    </div>;
  }
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  return <div style={modalBackdropStyle} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="platform-dialog-title" tabIndex={-1} style={modalStyle}><h2 id="platform-dialog-title" style={h2Style}>{title}</h2>{children}</div></div>;
}

function OrganisationForm({ value, onChange, onSubmit, onCancel, saving, submitLabel = "Create organisation" }: { value: typeof EMPTY_FORM; onChange: (value: typeof EMPTY_FORM) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void; saving: boolean; submitLabel?: string }) {
  const set = (key: keyof typeof EMPTY_FORM, next: string) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} style={formGridStyle}><Field label="Legal name" required value={value.legalName} onChange={(next) => set("legalName", next)} /><Field label="Trading name" value={value.tradingName} onChange={(next) => set("tradingName", next)} /><label style={labelStyle}>Organisation type<select value={value.organisationType} onChange={(event) => set("organisationType", event.target.value)}>{ENTERPRISE_ORGANISATION_TYPES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label><Field label="Country" required value={value.country} onChange={(next) => set("country", next)} /><Field label="Primary contact name" value={value.primaryContactName} onChange={(next) => set("primaryContactName", next)} /><Field label="Primary contact email" required type="email" value={value.primaryContactEmail} onChange={(next) => set("primaryContactEmail", next)} /><Field label="Internal account owner" required value={value.internalAccountOwner} onChange={(next) => set("internalAccountOwner", next)} /><Field label="Registration number" value={value.registrationNumber} onChange={(next) => set("registrationNumber", next)} /><Field label="Customer reference" value={value.customerReference} onChange={(next) => set("customerReference", next)} /><label style={labelStyle}>Account status<select value={value.initialStatus} onChange={(event) => set("initialStatus", event.target.value)}>{ENTERPRISE_ORGANISATION_STATUSES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label><label style={labelStyle}>Risk<select value={value.riskStatus} onChange={(event) => set("riskStatus", event.target.value)}>{ENTERPRISE_RISK_STATUSES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label><div style={actionRowStyle}><button type="button" style={secondaryButtonStyle} onClick={onCancel}>Cancel</button><button type="submit" style={primaryButtonStyle} disabled={saving}>{saving ? "Saving..." : submitLabel}</button></div></form>;
}

type LicenceFormValue = { licencePlan: string; startDate: string; renewalDate: string; purchasedSeats: string; licenceStatus: string; billingStatus: string };
type InviteFormValue = { email: string; fullName: string; expiryDays: string; requireMfa: boolean };

function LicenceForm({ value, onChange, onSubmit, onCancel, saving }: { value: LicenceFormValue; onChange: (value: LicenceFormValue) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void; saving: boolean }) {
  const set = (key: keyof typeof value, next: string) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} style={formGridStyle}><label style={labelStyle}>Plan<select value={value.licencePlan} onChange={(event) => set("licencePlan", event.target.value)}><option>starter</option><option>professional</option><option>enterprise</option><option>custom</option></select></label><Field label="Start date" required type="date" value={value.startDate} onChange={(next) => set("startDate", next)} /><Field label="Renewal date" required type="date" value={value.renewalDate} onChange={(next) => set("renewalDate", next)} /><Field label="Purchased licences" required type="number" value={value.purchasedSeats} onChange={(next) => set("purchasedSeats", next)} /><label style={labelStyle}>Initial licence status<select value={value.licenceStatus} onChange={(event) => set("licenceStatus", event.target.value)}><option>pending_approval</option><option>active</option><option>draft</option></select></label><label style={labelStyle}>Billing status<select value={value.billingStatus} onChange={(event) => set("billingStatus", event.target.value)}><option>not_configured</option><option>trial</option><option>active</option><option>manual_review</option></select></label><p style={mutedStyle}>The API enforces positive quantities, valid dates and committed-seat limits.</p><div style={actionRowStyle}><button type="button" style={secondaryButtonStyle} onClick={onCancel}>Cancel</button><button type="submit" style={primaryButtonStyle} disabled={saving}>{saving ? "Saving..." : "Create allocation"}</button></div></form>;
}

function InviteForm({ value, onChange, onSubmit, onCancel, saving }: { value: InviteFormValue; onChange: (value: InviteFormValue) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void; saving: boolean }) {
  return <form onSubmit={onSubmit} style={formGridStyle}><p style={mutedStyle}>Target role: Organisation Administrator. Target organisation: the organisation currently open.</p><Field label="Full name" value={value.fullName} onChange={(next) => onChange({ ...value, fullName: next })} /><Field label="Email" required type="email" value={value.email} onChange={(next) => onChange({ ...value, email: next })} /><Field label="Invitation expiry days" required type="number" value={value.expiryDays} onChange={(next) => onChange({ ...value, expiryDays: next })} /><label style={checkboxStyle}><input type="checkbox" checked={value.requireMfa} onChange={(event) => onChange({ ...value, requireMfa: event.target.checked })} /> Require MFA</label><div style={actionRowStyle}><button type="button" style={secondaryButtonStyle} onClick={onCancel}>Cancel</button><button type="submit" style={primaryButtonStyle} disabled={saving}>{saving ? "Sending..." : "Send invitation"}</button></div></form>;
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) { return <label style={labelStyle}>{label}{required ? " *" : ""}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function toForm(org: Organisation) { return { ...EMPTY_FORM, legalName: org.legalName, tradingName: org.tradingName || "", organisationType: org.type, country: org.country, primaryContactName: org.primaryContactName || "", primaryContactEmail: org.primaryContactEmail || "", internalAccountOwner: org.accountOwner || "", registrationNumber: org.registrationNumber || "", customerReference: org.customerReference || "", initialStatus: org.status, riskStatus: org.risk }; }
function renewalFor(org: Organisation, licences: Licence[]) { return licences.find((licence) => licence.organisationId === org.id)?.renewalDate || ""; }
function availableFor(org: Organisation, licences: Licence[]) { return licences.find((licence) => licence.organisationId === org.id)?.availableSeats || 0; }
function sentence(value: string) { const text = String(value || "").replace(/_/g, " ").toLowerCase(); return text.charAt(0).toUpperCase() + text.slice(1); }
function pluralType(type: string) { const map: Record<string, string> = { employer: "Employers", law_firm: "Law firms", wealth_manager: "Advisers", insurer: "Insurers", funeral_provider: "Funeral providers", employee_benefit_provider: "Benefit providers", enterprise_reseller: "Resellers", other: "Other" }; return map[type] ?? sentence(type); }
function labelise(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { if (!value) return "Not available"; return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatDate(value: string) { if (!value) return "Not available"; return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function nextYearDate() { const next = new Date(); next.setFullYear(next.getFullYear() + 1); return next.toISOString().slice(0, 10); }

const pageStyle: CSSProperties = { minHeight: "100vh", background: "var(--lf-surface-page)", padding: 24 };
const panelStyle: CSSProperties = { border: "1px solid var(--lf-border)", borderRadius: 12, padding: 20, background: "var(--lf-surface-card)", display: "grid", gap: 12 };
const stackStyle: CSSProperties = { display: "grid", gap: 16 };
const eyebrowStyle: CSSProperties = { margin: 0, color: "var(--lf-text-secondary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" };
const h2Style: CSSProperties = { margin: 0, color: "var(--lf-text)", fontSize: 24 };
const mutedStyle: CSSProperties = { margin: 0, color: "var(--lf-text-secondary)", lineHeight: 1.5 };
const filterStyle: CSSProperties = { ...panelStyle, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const actionRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const emptyStyle: CSSProperties = { display: "grid", gap: 5, padding: 18, color: "var(--lf-text-secondary)" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, color: "var(--lf-text)", fontWeight: 700, fontSize: 13 };
const checkboxStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center", color: "var(--lf-text)", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: "var(--lf-primary-bg)", color: "var(--lf-primary-text)", fontWeight: 700, cursor: "pointer", minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 };
const secondaryButtonStyle: CSSProperties = { border: "1px solid var(--lf-border-input)", borderRadius: 8, padding: "10px 13px", background: "var(--lf-surface-card)", color: "var(--lf-text)", fontWeight: 700, cursor: "pointer", minHeight: 44 };
const dangerButtonStyle: CSSProperties = { border: "1px solid #b91c1c", borderRadius: 6, padding: "9px 13px", background: "var(--lf-surface-card)", color: "var(--lf-status-rejected-text)", fontWeight: 800, cursor: "pointer" };
const alertStyle: CSSProperties = { padding: 12, border: "1px solid #fbbf24", background: "var(--lf-status-pending-bg)", color: "#78350f", borderRadius: 6 };
const modalBackdropStyle: CSSProperties = { position: "fixed", inset: 0, zIndex: 30, background: "rgba(15, 23, 42, 0.42)", display: "grid", placeItems: "center", padding: 18 };
const modalStyle: CSSProperties = { width: "min(720px, 100%)", maxHeight: "min(90vh, 760px)", overflow: "auto", background: "var(--lf-surface-card)", borderRadius: 8, padding: 20, boxShadow: "0 20px 60px rgba(15,23,42,.22)", display: "grid", gap: 16 };
