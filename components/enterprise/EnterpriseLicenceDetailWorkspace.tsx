"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import AdminWorkspaceShell from "@/components/admin/AdminWorkspaceShell";
import { ENTERPRISE_ADMIN_NAVIGATION, filterAdminNavigation } from "@/components/admin/adminNavigation";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type Licence = {
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
  committedSeats: number;
  activeSeats: number;
  invitedSeats: number;
  suspendedSeats: number;
  availableSeats: number;
  billingStatus: string;
  status: string;
  accountOwner: string | null;
  renewalRisk: string;
  updatedAt: string;
};

type Detail = {
  licence: Licence;
  organisation: { id: string; name: string; legalName: string; status: string } | null;
  seats: Array<{ id: string; invitee_email_normalized: string | null; seat_status: string; assigned_at: string; released_at: string | null }>;
  renewals: Array<{ id: string; previous_renewal_date: string; new_renewal_date: string; previous_purchased_seats: number; new_purchased_seats: number; previous_plan: string; new_plan: string; created_at: string }>;
  auditEvents: Array<{ id: string; action: string; result: string; actor_role: string | null; created_at: string }>;
};

export default function EnterpriseLicenceDetailWorkspace({ licenceId }: { licenceId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [navigationCapabilities, setNavigationCapabilities] = useState<string[]>([]);
  const [identity, setIdentity] = useState({ label: "Enterprise user", detail: "" });
  const [tab, setTab] = useState<"overview" | "seats" | "invitations" | "renewals" | "audit" | "settings">("overview");
  const [seatQuantity, setSeatQuantity] = useState(25);
  const [seatEmail, setSeatEmail] = useState("");
  const [reason, setReason] = useState("");
  const [renewalDate, setRenewalDate] = useState(nextYearInput());
  const [renewalSeats, setRenewalSeats] = useState(25);
  const [editOpen, setEditOpen] = useState(false);
  const [licenceForm, setLicenceForm] = useState({
    licencePlan: "starter",
    customPlanName: "",
    contractReference: "",
    billingReference: "",
    startDate: "",
    renewalDate: "",
    endDate: "",
    renewalNoticeDays: 90,
    autoRenew: false,
    renewalNotes: "",
    purchasedSeats: 1,
    billingStatus: "not_configured",
    licenceStatus: "draft",
    accountOwner: "",
  });

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const load = useCallback(async () => {
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/enterprise/licences/${licenceId}`)}`);
      return;
    }
    const res = await authFetch(`/api/internal/admin/enterprise?licenceId=${encodeURIComponent(licenceId)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: Detail; message?: string };
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || "This licence is unavailable.");
      setState(res.status === 403 ? "denied" : "error");
      return;
    }
    const sessionRes = await authFetch("/api/internal/admin/session");
    const sessionJson = await sessionRes.json().catch(() => ({})) as { admin?: { displayName?: string; email?: string; role?: string; capabilities?: string[] } };
    setNavigationCapabilities(sessionRes.ok && sessionJson.admin?.capabilities?.length ? sessionJson.admin.capabilities : ["enterprise.workspace.access", "organisation:view", "licence:view"]);
    setIdentity({
      label: sessionJson.admin?.displayName || sessionJson.admin?.email || user.email || "Enterprise user",
      detail: sessionJson.admin?.role ? `${sessionJson.admin.role.replace(/_/g, " ")} · ${sessionJson.admin.email ?? user.email ?? ""}` : user.email ?? "",
    });
    setDetail(json.detail);
    setSeatQuantity(json.detail.licence.purchasedSeats);
    setRenewalSeats(json.detail.licence.purchasedSeats);
    setRenewalDate(json.detail.licence.renewalDate);
    setLicenceForm(toLicenceForm(json.detail.licence));
    setState("ready");
  }, [authFetch, licenceId, router]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const timer = window.setTimeout(() => {
      if (["seats", "invitations", "renewals", "audit", "settings"].includes(hash)) setTab(hash as typeof tab);
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction(action: string, payload: Record<string, unknown>) {
    setMessage("");
    const res = await authFetch("/api/internal/admin/enterprise", {
      method: "POST",
      body: JSON.stringify({ action, licenceId, ...payload }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string };
    if (!res.ok || !json.ok) {
      setMessage(json.message || json.code || "The licence action was blocked.");
      return;
    }
    setMessage("Licence action completed.");
    await load();
  }

  async function signOut() {
    setDetail(null);
    setMessage("");
    await supabase.auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  if (state === "checking") return <main style={pageStyle}><section style={panelStyle}><h1>Checking licence access</h1><p>Confirming your signed-in session and role permissions.</p></section></main>;
  if (state !== "ready" || !detail) return <main style={pageStyle}><section style={panelStyle}><h1>{state === "denied" ? "Access denied" : "Licence unavailable"}</h1><p>{message}</p><Link href="/enterprise">Back to Enterprise Operations</Link></section></main>;

  const licence = detail.licence;
  const navigation = filterAdminNavigation(ENTERPRISE_ADMIN_NAVIGATION, navigationCapabilities);
  return (
    <AdminWorkspaceShell
      workspaceLabel="Enterprise Operations"
      eyebrow="Legacy Fortress Enterprise"
      title={licence.plan === "custom" ? licence.customPlanName || "Custom licence" : labelise(licence.plan)}
      description={`${detail.organisation?.name ?? "Unknown organisation"} · ${labelise(licence.status)} · ${licence.availableSeats} seats available`}
      currentPathname={`/enterprise/licences/${licenceId}`}
      navigation={navigation}
      onSignOut={signOut}
      identityLabel={identity.label}
      identityDetail={identity.detail}
      breadcrumbs={[
        { label: "Enterprise Operations", href: "/enterprise" },
        { label: "Licences", href: "/enterprise?tab=licences" },
        ...(detail.organisation ? [{ label: detail.organisation.name, href: `/enterprise/organisations/${detail.organisation.id}` }] : []),
        { label: licence.plan === "custom" ? licence.customPlanName || "Custom licence" : labelise(licence.plan) },
      ]}
      stagingLabel="STAGING - synthetic test data may be present"
    >
      {message ? <section style={alertStyle}>{message}</section> : null}
      <nav aria-label="Licence detail navigation" style={tabListStyle}>
        {["overview", "seats", "invitations", "renewals", "audit", "settings"].map((item) => (
          <button key={item} type="button" style={tab === item ? activeTabStyle : tabStyle} onClick={() => setTab(item as typeof tab)}>{labelise(item === "seats" ? "seat_usage" : item)}</button>
        ))}
      </nav>
      {tab === "overview" ? (
        <section style={panelStyle}>
          <h2>Overview</h2>
          <dl style={detailsGridStyle}>
            <Info label="Organisation" value={detail.organisation?.name ?? "Unknown"} />
            <Info label="Plan" value={licence.plan === "custom" ? licence.customPlanName || "Custom" : labelise(licence.plan)} />
            <Info label="Licence status" value={labelise(licence.status)} />
            <Info label="Billing status" value={labelise(licence.billingStatus)} />
            <Info label="Purchased seats" value={String(licence.purchasedSeats)} />
            <Info label="Committed seats" value={String(licence.committedSeats)} />
            <Info label="Available seats" value={String(licence.availableSeats)} />
            <Info label="Renewal date" value={formatDate(licence.renewalDate)} />
            <Info label="Account owner" value={licence.accountOwner ?? "Unassigned"} />
            <Info label="Recent activity" value={detail.auditEvents[0]?.action ?? "No activity yet"} />
          </dl>
          <p style={privacyStyle}>Private vault records, uploaded documents, legal contents and individual financial values are not queried by this workspace.</p>
        </section>
      ) : null}
      {tab === "seats" ? (
        <section style={panelStyle}>
          <h2>Seat usage</h2>
          <p style={privacyStyle}>Committed seats are active + invited + suspended reservations. Suspended seats continue consuming entitlement until released.</p>
          <div style={detailsGridStyle}>
            <Info label="Purchased" value={String(licence.purchasedSeats)} />
            <Info label="Active" value={String(licence.activeSeats)} />
            <Info label="Invited" value={String(licence.invitedSeats)} />
            <Info label="Suspended" value={String(licence.suspendedSeats)} />
            <Info label="Available" value={String(licence.availableSeats)} />
          </div>
          <h3>Change entitlement</h3>
          <FormInput label="New purchased seats" type="number" value={String(seatQuantity)} onChange={(value) => setSeatQuantity(Number(value))} />
          <FormInput label="Reason" value={reason} onChange={setReason} />
          <button type="button" style={primaryButtonStyle} onClick={() => runAction("change_licence_seats", { newPurchasedSeats: seatQuantity, reason })}>Save seat entitlement</button>
          <h3>Controlled Phase 2 seat reservation</h3>
          <p style={mutedStyle}>This creates a seat reservation record only. Full user invitation acceptance is Phase 3.</p>
          <FormInput label="Reservation email" value={seatEmail} onChange={setSeatEmail} />
          <button type="button" style={secondaryButtonStyle} onClick={() => runAction("reserve_licence_seat", { email: seatEmail })}>Reserve seat</button>
          <table style={tableStyle}><thead><tr><th>Email</th><th>Status</th><th>Assigned</th></tr></thead><tbody>
            {detail.seats.map((seat) => <tr key={seat.id}><td>{seat.invitee_email_normalized ?? "Unclaimed"}</td><td>{labelise(seat.seat_status)}</td><td>{formatDate(seat.assigned_at)}</td></tr>)}
            {detail.seats.length === 0 ? <tr><td colSpan={3}>No seats have been allocated yet. Invite users is delivered in Phase 3.</td></tr> : null}
          </tbody></table>
        </section>
      ) : null}
      {tab === "renewals" ? (
        <section style={panelStyle}>
          <h2>Renewals</h2>
          <FormInput label="New renewal date" type="date" value={renewalDate} onChange={setRenewalDate} />
          <FormInput label="Renewed seat quantity" type="number" value={String(renewalSeats)} onChange={(value) => setRenewalSeats(Number(value))} />
          <FormInput label="Renewal notes" value={reason} onChange={setReason} />
          <button type="button" style={primaryButtonStyle} onClick={() => runAction("renew_licence", { newRenewalDate: renewalDate, renewedSeatQuantity: renewalSeats, renewalNotes: reason })}>Complete renewal</button>
          <table style={tableStyle}><thead><tr><th>Previous renewal</th><th>New renewal</th><th>Seats</th><th>Plan</th></tr></thead><tbody>
            {detail.renewals.map((renewal) => <tr key={renewal.id}><td>{formatDate(renewal.previous_renewal_date)}</td><td>{formatDate(renewal.new_renewal_date)}</td><td>{renewal.previous_purchased_seats} to {renewal.new_purchased_seats}</td><td>{labelise(renewal.previous_plan)} to {labelise(renewal.new_plan)}</td></tr>)}
            {detail.renewals.length === 0 ? <tr><td colSpan={4}>No renewal history yet.</td></tr> : null}
          </tbody></table>
        </section>
      ) : null}
      {tab === "settings" ? (
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2>Edit licence</h2>
              <p style={mutedStyle}>Edit the currently supported canonical licence fields. Seat reductions remain protected by committed usage.</p>
            </div>
            <button type="button" style={primaryButtonStyle} onClick={() => setEditOpen(true)}>Edit licence</button>
          </div>
          {editOpen ? (
            <section style={contextPanelStyle} aria-label="Edit licence form">
              <label style={labelStyle}>Licence plan<select value={licenceForm.licencePlan} onChange={(event) => setLicenceForm({ ...licenceForm, licencePlan: event.target.value })}><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option><option value="custom">Custom</option></select></label>
              {licenceForm.licencePlan === "custom" ? <FormInput label="Custom plan name" required value={licenceForm.customPlanName} onChange={(customPlanName) => setLicenceForm({ ...licenceForm, customPlanName })} /> : null}
              <FormInput label="Contract reference" value={licenceForm.contractReference} onChange={(contractReference) => setLicenceForm({ ...licenceForm, contractReference })} />
              <FormInput label="Billing reference" value={licenceForm.billingReference} onChange={(billingReference) => setLicenceForm({ ...licenceForm, billingReference })} />
              <FormInput label="Purchased seats" type="number" required value={String(licenceForm.purchasedSeats)} onChange={(value) => setLicenceForm({ ...licenceForm, purchasedSeats: Number(value) })} />
              <p style={privacyStyle}>Minimum safe seat count is {licence.committedSeats}. The server rejects reductions below committed seats.</p>
              <FormInput label="Start date" type="date" required value={licenceForm.startDate} onChange={(startDate) => setLicenceForm({ ...licenceForm, startDate })} />
              <FormInput label="Renewal date" type="date" required value={licenceForm.renewalDate} onChange={(renewalDate) => setLicenceForm({ ...licenceForm, renewalDate })} />
              <FormInput label="End date" type="date" value={licenceForm.endDate} onChange={(endDate) => setLicenceForm({ ...licenceForm, endDate })} />
              <FormInput label="Renewal notice days" type="number" value={String(licenceForm.renewalNoticeDays)} onChange={(value) => setLicenceForm({ ...licenceForm, renewalNoticeDays: Number(value) })} />
              <label style={labelStyle}>Licence status<select value={licenceForm.licenceStatus} onChange={(event) => setLicenceForm({ ...licenceForm, licenceStatus: event.target.value })}><option value="draft">Draft</option><option value="pending_approval">Pending approval</option><option value="active">Active</option><option value="expiring">Expiring</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label>
              <label style={labelStyle}>Billing status<select value={licenceForm.billingStatus} onChange={(event) => setLicenceForm({ ...licenceForm, billingStatus: event.target.value })}><option value="not_configured">Not configured</option><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select></label>
              <FormInput label="Account owner" value={licenceForm.accountOwner} onChange={(accountOwner) => setLicenceForm({ ...licenceForm, accountOwner })} />
              <label style={checkboxStyle}><input type="checkbox" checked={licenceForm.autoRenew} onChange={(event) => setLicenceForm({ ...licenceForm, autoRenew: event.target.checked })} /> Auto-renew</label>
              <label style={labelStyle}>Renewal notes<textarea value={licenceForm.renewalNotes} onChange={(event) => setLicenceForm({ ...licenceForm, renewalNotes: event.target.value })} /></label>
              <div style={rowStyle}>
                <button type="button" style={primaryButtonStyle} onClick={() => runAction("update_licence", licenceForm).then(() => setEditOpen(false))}>Save licence</button>
                <button type="button" style={secondaryButtonStyle} onClick={() => { setLicenceForm(toLicenceForm(licence)); setEditOpen(false); }}>Cancel</button>
              </div>
            </section>
          ) : null}
          <h2>Lifecycle</h2>
          <FormInput label="Reason" value={reason} onChange={setReason} />
          <div style={rowStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_licence", { status: licence.status === "suspended" ? "active" : "suspended", reason })}>{licence.status === "suspended" ? "Reactivate" : "Suspend"}</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_licence", { status: "expiring", reason })}>Mark expiring</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_licence", { status: "cancelled", reason })}>Cancel</button>
          </div>
        </section>
      ) : null}
      {tab === "audit" ? (
        <section style={panelStyle}>
          <h2>Audit</h2>
          <table style={tableStyle}><thead><tr><th>When</th><th>Action</th><th>Result</th><th>Actor role</th></tr></thead><tbody>
            {detail.auditEvents.map((event) => <tr key={event.id}><td>{formatDate(event.created_at)}</td><td>{event.action}</td><td>{event.result}</td><td>{event.actor_role ?? "Unknown"}</td></tr>)}
            {detail.auditEvents.length === 0 ? <tr><td colSpan={4}>No audit events for this licence yet.</td></tr> : null}
          </tbody></table>
        </section>
      ) : null}
      {tab === "invitations" ? <section style={panelStyle}><h2>Invitations</h2><p style={mutedStyle}>Organisation-user invitation acceptance and seat activation are delivered in Phase 3.</p></section> : null}
    </AdminWorkspaceShell>
  );
}

function toLicenceForm(licence: Licence) {
  return {
    licencePlan: licence.plan,
    customPlanName: licence.customPlanName || "",
    contractReference: licence.contractReference || "",
    billingReference: licence.billingReference || "",
    startDate: licence.startDate,
    renewalDate: licence.renewalDate,
    endDate: licence.endDate || "",
    renewalNoticeDays: licence.renewalNoticeDays || 90,
    autoRenew: Boolean(licence.autoRenew),
    renewalNotes: licence.renewalNotes || "",
    purchasedSeats: licence.purchasedSeats,
    billingStatus: licence.billingStatus,
    licenceStatus: licence.status,
    accountOwner: licence.accountOwner || "",
  };
}

function FormInput({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label style={labelStyle}>{label}{required ? " *" : ""}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function nextYearInput() {
  const next = new Date();
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function labelise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc", color: "#111827" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 18, boxShadow: "0 12px 30px rgba(15,23,42,.05)", display: "grid", gap: 12 };
const mutedStyle: CSSProperties = { color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 };
const privacyStyle: CSSProperties = { color: "#334155", background: "#f1f5f9", border: "1px solid #dbe3ef", borderRadius: 6, padding: 10, margin: "12px 0 0" };
const secondaryButtonStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", background: "#fff", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#111827", color: "#fff", fontWeight: 800 };
const alertStyle: CSSProperties = { background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16 };
const tabListStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const tabStyle: CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "9px 12px", fontWeight: 700 };
const activeTabStyle: CSSProperties = { ...tabStyle, background: "#111827", color: "#fff", borderColor: "#111827" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontWeight: 700, color: "#334155", fontSize: 13 };
const checkboxStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center", color: "#334155", fontWeight: 700 };
const rowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const contextPanelStyle: CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, display: "grid", gap: 12, background: "#f8fafc" };
const detailsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
