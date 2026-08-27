"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { waitForActiveUser } from "@/lib/auth/session";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
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

type Membership = { id: string; organisationId: string; email: string; fullName: string | null; organisationRole: string; status: string };
type AuditEvent = { id: string; action: string; result: string; actor_email_normalized: string | null; created_at: string; resource_label: string | null };
type Portfolio = { organisations: Organisation[]; licences: Licence[]; invitations: Invitation[]; memberships: Membership[] };
type Detail = { organisation: Organisation; licences: Licence[]; invitations: Invitation[]; memberships: Membership[]; auditEvents: AuditEvent[]; privacyBoundary: { vaultContentExcluded: boolean; documentContentExcluded: boolean; financialValuesExcluded: boolean } };
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
  const [licenceForm, setLicenceForm] = useState({ licencePlan: "starter", startDate: TODAY, renewalDate: "", purchasedSeats: "10", licenceStatus: "pending_approval", billingStatus: "not_configured" });
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", expiryDays: "14", requireMfa: true });
  const [saving, setSaving] = useState(false);

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const headers = new Headers(init?.headers ?? {});
    if (sessionRes.data.session?.access_token) headers.set("authorization", `Bearer ${sessionRes.data.session.access_token}`);
    if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const load = useCallback(async () => {
    setState("checking");
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
  }, [authFetch, organisationId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!formOpen && !editOpen && !licenceOpen && !inviteOpen && !confirmState) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") closeDialogs(); }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); };
  }, [confirmState, editOpen, formOpen, inviteOpen, licenceOpen]);

  function closeDialogs() { setFormOpen(false); setEditOpen(false); setLicenceOpen(false); setInviteOpen(false); setConfirmState(null); }

  async function runAction(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | false> {
    setSaving(true); setMessage("");
    const response = await authFetch("/api/internal/admin/enterprise", { method: "POST", body: JSON.stringify({ action, ...payload }) });
    const json = await response.json().catch(() => ({})) as Record<string, unknown>;
    setSaving(false);
    if (!response.ok || json.ok !== true) { setMessage(String(json.message || "The commercial action was blocked.")); return false; }
    closeDialogs(); await load(); setMessage("Commercial action completed and audit recorded."); return json;
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
    <AdminWorkspaceShell workspaceLabel="Platform Administration" eyebrow="Platform Administration" title={currentLabel} description={organisationId ? "Manage commercial metadata, licence position and administrator access without entering customer vault data." : "Privacy-bounded organisation register for commercial account operations."} currentPathname={organisationId ? `/admin/organisations/${organisationId}` : "/admin/organisations"} navigation={navigation} onSignOut={() => { void supabase.auth.signOut(); window.location.assign("/sign-in"); }} identityLabel={identity?.label} identityDetail={identity?.detail}>
      {message ? <div role="status" style={alertStyle}>{message}</div> : null}
      {organisationId && detail ? renderDetail() : renderRegister()}
      {formOpen ? <Modal title="New organisation" onClose={closeDialogs}><OrganisationForm value={form} onChange={setForm} onSubmit={submitOrganisation} onCancel={closeDialogs} saving={saving} /></Modal> : null}
      {editOpen ? <Modal title="Edit organisation" onClose={closeDialogs}><OrganisationForm value={form} onChange={setForm} onSubmit={submitEdit} onCancel={closeDialogs} saving={saving} submitLabel="Save organisation" /></Modal> : null}
      {licenceOpen ? <Modal title="Allocate licence" onClose={closeDialogs}><LicenceForm value={licenceForm} onChange={setLicenceForm} onSubmit={submitLicence} onCancel={closeDialogs} saving={saving} /></Modal> : null}
      {inviteOpen ? <Modal title="Invite organisation administrator" onClose={closeDialogs}><InviteForm value={inviteForm} onChange={setInviteForm} onSubmit={submitInvite} onCancel={closeDialogs} saving={saving} /></Modal> : null}
      {confirmState ? <Modal title={confirmState === "suspend" ? "Suspend organisation" : "Reactivate organisation"} onClose={closeDialogs}><p>{confirmState === "suspend" ? "Suspension prevents normal organisation operations until reactivated. Customer Personal Vault data is not opened or deleted." : "Reactivation restores the organisation's commercial operating state."}</p><div style={actionRowStyle}><button type="button" onClick={closeDialogs} style={secondaryButtonStyle}>Cancel</button><button type="button" disabled={saving} onClick={() => detail && void runAction("transition_organisation", { organisationId: detail.organisation.id, status: confirmState === "suspend" ? "suspended" : "active", reason: `Platform operator ${confirmState}` })} style={dangerButtonStyle}>{saving ? "Saving..." : confirmState === "suspend" ? "Suspend organisation" : "Reactivate organisation"}</button></div></Modal> : null}
    </AdminWorkspaceShell>
  );

  function renderRegister() {
    const organisations = portfolio?.organisations ?? [];
    const licences = portfolio?.licences ?? [];
    const invitations = portfolio?.invitations ?? [];
    const rows = organisations.filter((org) => {
      const licence = licences.find((item) => item.organisationId === org.id);
      const text = `${org.name} ${org.legalName} ${org.tradingName ?? ""} ${org.registrationNumber ?? ""} ${org.primaryContactEmail ?? ""} ${org.nominatedAdminEmail ?? ""} ${org.id}`.toLowerCase();
      return (!search || text.includes(search.toLowerCase())) && (!statusFilter || org.status === statusFilter) && (!typeFilter || org.type === typeFilter) && (!licenceFilter || licence?.status === licenceFilter);
    }).sort((a, b) => sort === "renewal" ? (renewalFor(a, licences) || "9999").localeCompare(renewalFor(b, licences) || "9999") : sort === "capacity" ? availableFor(b, licences) - availableFor(a, licences) : a.name.localeCompare(b.name));
    const totalPurchased = licences.reduce((sum, licence) => sum + licence.purchasedSeats, 0);
    const totalActive = licences.reduce((sum, licence) => sum + licence.activeSeats, 0);
    const totalAvailable = licences.reduce((sum, licence) => sum + licence.availableSeats, 0);
    return <div style={stackStyle}>
      <section style={headerRowStyle}><div><p style={eyebrowStyle}>Commercial account register</p><h2 style={h2Style}>Organisations</h2><p style={mutedStyle}>Metadata and licence position only. Personal Vault content, documents and private financial values are excluded.</p></div><button type="button" style={primaryButtonStyle} disabled={!canManage} onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }}>+ New organisation</button></section>
      <section style={metricGridStyle}><Metric label="Organisations" value={String(organisations.length)} /><Metric label="Purchased licences" value={String(totalPurchased)} /><Metric label="Active seats" value={String(totalActive)} /><Metric label="Available seats" value={String(totalAvailable)} /></section>
      <section style={filterStyle} aria-label="Organisation search and filters"><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, ID, registration or administrator" /></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{ENTERPRISE_ORGANISATION_STATUSES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label><label>Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{ENTERPRISE_ORGANISATION_TYPES.map((item) => <option key={item} value={item}>{labelise(item)}</option>)}</select></label><label>Licence<select value={licenceFilter} onChange={(event) => setLicenceFilter(event.target.value)}><option value="">All licence states</option><option value="active">Active</option><option value="pending_approval">Pending approval</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select></label><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Organisation name</option><option value="renewal">Renewal date</option><option value="capacity">Available capacity</option></select></label></section>
      <section style={tableWrapStyle}><table style={tableStyle}><caption>Platform organisation register</caption><thead><tr><th>Organisation</th><th>Status</th><th>Licence position</th><th>Administrator</th><th>Renewal</th><th>Last activity</th><th>Risk</th><th>Action</th></tr></thead><tbody>{rows.map((org) => { const licence = licences.find((item) => item.organisationId === org.id); const pending = invitations.filter((item) => item.organisationId === org.id && ["draft", "scheduled", "sent", "delivered"].includes(item.status)).length; return <tr key={org.id}><td><Link href={`/admin/organisations/${org.id}`}><strong>{org.name}</strong></Link><small>{org.registrationNumber || org.legalName}</small></td><td><AdminStatusBadge status={badgeStatus(org.status)} /></td><td>{licence ? <><strong>{licence.activeSeats} active / {licence.purchasedSeats} purchased</strong><small>{licence.allocatedSeats} committed · {licence.invitedSeats} invited · {licence.availableSeats} available</small></> : "No licence"}</td><td>{org.nominatedAdminName || org.primaryContactName || "Not assigned"}<small>{org.nominatedAdminEmail || org.primaryContactEmail || ""}{pending ? ` · ${pending} pending invitation${pending === 1 ? "" : "s"}` : ""}</small></td><td>{licence?.renewalDate ? formatDate(licence.renewalDate) : "Not configured"}</td><td>{formatDate(org.updatedAt)}</td><td><AdminStatusBadge status={badgeStatus(org.risk)} /></td><td><Link href={`/admin/organisations/${org.id}`} style={secondaryLinkStyle}>Open</Link></td></tr>; })}</tbody></table>{rows.length === 0 ? <div style={emptyStyle}><strong>No organisations match</strong><span>Adjust the filters or create a new organisation.</span></div> : null}</section>
    </div>;
  }

  function renderDetail() {
    if (!detail) return null;
    const org = detail.organisation;
    const licence = detail.licences[0];
    const pendingInvitations = detail.invitations.filter((item) => ["draft", "scheduled", "sent", "delivered"].includes(item.status));
    const canSuspend = canManage && ["active", "pending_setup", "pending_administrator_acceptance", "expiring"].includes(org.status);
    const canReactivate = canManage && org.status === "suspended";
    return <div style={stackStyle}>
      <Link href="/admin/organisations" style={secondaryLinkStyle}>Back to organisations</Link>
      <section style={headerRowStyle}><div><p style={eyebrowStyle}>Platform commercial account</p><h2 style={h2Style}>{org.name}</h2><p style={mutedStyle}>{org.legalName}{org.tradingName ? ` · ${org.tradingName}` : ""} · updated {formatDate(org.updatedAt)}</p></div><div style={actionRowStyle}><AdminStatusBadge status={badgeStatus(org.status)} /><AdminStatusBadge status={badgeStatus(org.risk)} /></div></section>
      <section style={actionRowStyle}><button type="button" style={primaryButtonStyle} disabled={!canManage} onClick={() => { setForm(toForm(org)); setEditOpen(true); }}>Edit organisation</button><button type="button" style={secondaryButtonStyle} disabled={!canCreateLicence || Boolean(licence)} onClick={() => setLicenceOpen(true)}>{licence ? "Licence configured" : "Allocate licence"}</button><button type="button" style={secondaryButtonStyle} disabled={!canInvite || ["suspended", "cancelled", "archived"].includes(org.status)} onClick={() => setInviteOpen(true)}>Invite administrator</button>{canSuspend || canReactivate ? <button type="button" style={dangerButtonStyle} onClick={() => setConfirmState(canReactivate ? "reactivate" : "suspend")}>{canReactivate ? "Reactivate" : "Suspend"}</button> : null}</section>
      <section style={metricGridStyle}><Metric label="Purchased" value={licence ? String(licence.purchasedSeats) : "0"} /><Metric label="Committed" value={licence ? String(licence.allocatedSeats) : "0"} /><Metric label="Active" value={licence ? String(licence.activeSeats) : "0"} /><Metric label="Invited" value={licence ? String(licence.invitedSeats) : "0"} /><Metric label="Available" value={licence ? String(licence.availableSeats) : "0"} /></section>
      <section style={twoColumnStyle}><section style={panelStyle}><h3 style={h3Style}>Account details</h3><dl style={definitionGridStyle}><Info label="Organisation type" value={labelise(org.type)} /><Info label="Primary administrator" value={org.nominatedAdminEmail || org.primaryContactEmail || "Not assigned"} /><Info label="Internal account owner" value={org.accountOwner || "Not assigned"} /><Info label="Onboarding" value={labelise(org.onboardingStatus)} /><Info label="Licence status" value={licence ? labelise(licence.status) : "Not configured"} /><Info label="Billing status" value={licence ? labelise(licence.billingStatus) : "Not configured"} /><Info label="Renewal" value={licence ? formatDate(licence.renewalDate) : "Not configured"} /></dl></section><section style={panelStyle}><h3 style={h3Style}>Administrator invitations</h3>{pendingInvitations.length ? pendingInvitations.map((item) => <div key={item.id} style={listRowStyle}><strong>{item.fullName || item.email}</strong><span>{item.email} · {labelise(item.status)}</span></div>) : <div style={emptyStyle}><strong>No pending invitations</strong><span>Invite the primary organisation administrator when ready.</span></div>}<Link href={`/admin/organisations/${org.id}/invitations`} style={secondaryLinkStyle}>Open invitation history</Link></section></section>
      <section style={panelStyle}><h3 style={h3Style}>Enterprise Operations handoff</h3>{canEnterpriseHandoff ? <><p style={mutedStyle}>Day-to-day enrolment links, sponsored users, member operations and organisation reporting remain in the separate Enterprise Operations workspace.</p><Link href="/enterprise" style={secondaryLinkStyle}>Open Enterprise Operations</Link></> : <p style={mutedStyle}>Enterprise Operations access is not assigned to this account. Platform review does not change identity or organisation membership.</p>}</section>
      <section style={panelStyle}><h3 style={h3Style}>Recent activity</h3>{detail.auditEvents.length ? <ol style={activityListStyle}>{detail.auditEvents.slice(0, 10).map((event) => <li key={event.id}><strong>{event.action}</strong><span>{event.result} · {event.actor_email_normalized || "System"}</span><small>{formatDate(event.created_at)}</small></li>)}</ol> : <div style={emptyStyle}><strong>No recent activity</strong><span>Organisation activity will appear here after an audited operation.</span></div>}<Link href={`/admin/audit?resource=organisation:${org.id}`} style={secondaryLinkStyle}>Open Platform Audit</Link></section>
      {detail.memberships.length ? <section style={panelStyle}><h3 style={h3Style}>Members and sponsored users</h3><p style={mutedStyle}>{detail.memberships.length} membership record{detail.memberships.length === 1 ? "" : "s"}. Personal Vault content is not shown.</p><Link href={`/admin/organisations/${org.id}/users`} style={secondaryLinkStyle}>Open member status</Link></section> : null}
    </div>;
  }
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div style={modalBackdropStyle} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-labelledby="platform-dialog-title" tabIndex={-1} style={modalStyle}><h2 id="platform-dialog-title" style={h2Style}>{title}</h2>{children}</div></div>;
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
function Metric({ label, value }: { label: string; value: string }) { return <section style={metricStyle}><span>{label}</span><strong>{value}</strong></section>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function toForm(org: Organisation) { return { ...EMPTY_FORM, legalName: org.legalName, tradingName: org.tradingName || "", organisationType: org.type, country: org.country, primaryContactName: org.primaryContactName || "", primaryContactEmail: org.primaryContactEmail || "", internalAccountOwner: org.accountOwner || "", registrationNumber: org.registrationNumber || "" }; }
function renewalFor(org: Organisation, licences: Licence[]) { return licences.find((licence) => licence.organisationId === org.id)?.renewalDate || ""; }
function availableFor(org: Organisation, licences: Licence[]) { return licences.find((licence) => licence.organisationId === org.id)?.availableSeats || 0; }
function labelise(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { if (!value) return "Not available"; return new Date(value).toLocaleDateString("en-GB"); }
function badgeStatus(value: string): "Active" | "Suspended" | "Pending" | "Restricted" | "Blocked" | "High" | "Urgent" | "Normal" | "Review" {
  if (value === "active") return "Active";
  if (value === "suspended") return "Suspended";
  if (value === "restricted") return "Restricted";
  if (value === "critical") return "Urgent";
  if (value === "at_risk") return "High";
  if (value === "watch") return "Review";
  if (["cancelled", "archived"].includes(value)) return "Blocked";
  if (["draft", "pending_setup", "pending_administrator_acceptance", "expiring"].includes(value)) return "Pending";
  return "Normal";
}

const pageStyle: CSSProperties = { minHeight: "100vh", background: "#f8fafc", padding: 24 };
const panelStyle: CSSProperties = { border: "1px solid #dbe3ef", borderRadius: 8, padding: 18, background: "#fff", display: "grid", gap: 12 };
const stackStyle: CSSProperties = { display: "grid", gap: 16 };
const eyebrowStyle: CSSProperties = { margin: 0, color: "#526173", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" };
const h2Style: CSSProperties = { margin: 0, color: "#0f172a", fontSize: 24 };
const h3Style: CSSProperties = { margin: 0, color: "#0f172a", fontSize: 17 };
const mutedStyle: CSSProperties = { margin: 0, color: "#526173", lineHeight: 1.5 };
const headerRowStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" };
const metricGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };
const metricStyle: CSSProperties = { ...panelStyle, gap: 6 };
const filterStyle: CSSProperties = { ...panelStyle, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const definitionGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 };
const twoColumnStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 };
const actionRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const tableWrapStyle: CSSProperties = { ...panelStyle, overflowX: "auto" };
const tableStyle: CSSProperties = { width: "100%", minWidth: 820, borderCollapse: "collapse", textAlign: "left", fontSize: 14 };
const listRowStyle: CSSProperties = { display: "grid", gap: 3, borderTop: "1px solid #e2e8f0", padding: "10px 0" };
const activityListStyle: CSSProperties = { display: "grid", gap: 10, margin: 0, paddingLeft: 22 };
const emptyStyle: CSSProperties = { display: "grid", gap: 5, padding: 18, color: "#526173" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, color: "#334155", fontWeight: 700, fontSize: 13 };
const checkboxStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center", color: "#334155", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#0f172a", color: "#fff", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { border: "1px solid #94a3b8", borderRadius: 6, padding: "9px 13px", background: "#fff", color: "#0f172a", fontWeight: 700, cursor: "pointer" };
const dangerButtonStyle: CSSProperties = { border: "1px solid #b91c1c", borderRadius: 6, padding: "9px 13px", background: "#fff", color: "#991b1b", fontWeight: 800, cursor: "pointer" };
const secondaryLinkStyle: CSSProperties = { display: "inline-block", border: "1px solid #94a3b8", borderRadius: 6, padding: "9px 13px", color: "#0f172a", fontWeight: 700, textDecoration: "none" };
const alertStyle: CSSProperties = { padding: 12, border: "1px solid #fbbf24", background: "#fffbeb", color: "#78350f", borderRadius: 6 };
const modalBackdropStyle: CSSProperties = { position: "fixed", inset: 0, zIndex: 30, background: "rgba(15, 23, 42, 0.42)", display: "grid", placeItems: "center", padding: 18 };
const modalStyle: CSSProperties = { width: "min(720px, 100%)", maxHeight: "min(90vh, 760px)", overflow: "auto", background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 20px 60px rgba(15,23,42,.22)", display: "grid", gap: 16 };
