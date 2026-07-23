"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import WorkspaceSwitcher from "@/components/navigation/WorkspaceSwitcher";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type Organisation = {
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
  updatedAt: string;
};

type Detail = {
  organisation: Organisation;
  licences: Array<{ id: string; plan: string; status: string; purchasedSeats: number; activeSeats: number }>;
  invitations: Array<{ id: string; email: string; invitationType: string; status: string }>;
  auditEvents: Array<{ id: string; action: string; result: string; actor_email_normalized: string | null; actor_role: string | null; created_at: string; policy_decision: string; metadata: Record<string, unknown> }>;
};

type FormState = {
  legalName: string;
  tradingName: string;
  organisationType: string;
  organisationTypeOther: string;
  registrationNumber: string;
  country: string;
  website: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactTelephone: string;
  internalAccountOwner: string;
  contractReference: string;
  customerReference: string;
  onboardingStatus: string;
  onboardingNotes: string;
  riskStatus: string;
  nominatedAdminName: string;
  nominatedAdminEmail: string;
  nominatedAdminRequireMfa: boolean;
  nominatedAdminExpiryDays: number;
  expectedUpdatedAt: string;
};

export default function EnterpriseOrganisationDetailWorkspace({ organisationId }: { organisationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"overview" | "licence" | "users" | "invitations" | "adoption" | "consent" | "reports" | "audit" | "settings">("overview");
  const [form, setForm] = useState<FormState | null>(null);
  const [reason, setReason] = useState("");

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
      router.replace(`/sign-in?next=${encodeURIComponent(`/application/enterprise/organisations/${organisationId}`)}`);
      return;
    }
    const res = await authFetch(`/api/internal/admin/enterprise?organisationId=${encodeURIComponent(organisationId)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: Detail; message?: string };
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || "This organisation is unavailable.");
      setState(res.status === 403 ? "denied" : "error");
      return;
    }
    setDetail(json.detail);
    setForm(toForm(json.detail.organisation));
    setState("ready");
  }, [authFetch, organisationId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction(action: string, payload: Record<string, unknown>) {
    setMessage("");
    const res = await authFetch("/api/internal/admin/enterprise", {
      method: "POST",
      body: JSON.stringify({ action, organisationId, ...payload }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string; mode?: "deleted" | "archived" };
    if (!res.ok || !json.ok) {
      setMessage(json.message || json.code || "The organisation action was blocked.");
      return;
    }
    setMessage(action === "delete_or_archive_organisation" ? "Organisation archived or deleted." : "Organisation updated.");
    if (action === "delete_or_archive_organisation" && json.mode === "deleted") {
      router.replace("/application/enterprise");
      return;
    }
    await load();
  }

  if (state === "checking") return <main style={pageStyle}><section style={panelStyle}><h1>Checking organisation access</h1><p>Confirming your signed-in session and role permissions.</p></section></main>;
  if (state !== "ready" || !detail || !form) return <main style={pageStyle}><section style={panelStyle}><h1>{state === "denied" ? "Access denied" : "Organisation unavailable"}</h1><p>{message}</p><Link href="/application/enterprise">Back to Enterprise Operations</Link></section></main>;

  const org = detail.organisation;
  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Legacy Fortress Enterprise</p>
          <h1 style={h1Style}>{org.name}</h1>
          <p style={mutedStyle}>{labelise(org.status)} · {labelise(org.risk)} · {org.accountOwner || "No account owner"}</p>
        </div>
        <div style={headerActionsStyle}>
          <span style={stageBadgeStyle}>STAGING — synthetic test data may be present</span>
          <WorkspaceSwitcher currentPathname={`/application/enterprise/organisations/${organisationId}`} alwaysShow compact />
          <Link style={secondaryLinkStyle} href="/application/enterprise">Enterprise Operations</Link>
          <Link style={secondaryLinkStyle} href="/dashboard">Personal Vault</Link>
        </div>
      </header>
      {message ? <section style={alertStyle}>{message}</section> : null}
      <nav style={tabListStyle} aria-label="Organisation detail navigation">
        {["overview", "licence", "users", "invitations", "adoption", "consent", "reports", "audit", "settings"].map((item) => (
          <button key={item} type="button" style={tab === item ? activeTabStyle : tabStyle} onClick={() => setTab(item as typeof tab)}>{labelise(item === "users" ? "users_and_seats" : item)}</button>
        ))}
      </nav>
      {tab === "overview" ? (
        <section style={panelStyle}>
          <h2>Overview</h2>
          <dl style={detailsGridStyle}>
            <Info label="Legal name" value={org.legalName} />
            <Info label="Trading name" value={org.tradingName || "Not set"} />
            <Info label="Type" value={org.type === "other" ? `Other: ${org.typeOther}` : labelise(org.type)} />
            <Info label="Registration" value={org.registrationNumber || "Not set"} />
            <Info label="Primary contact" value={`${org.primaryContactName || "Not set"} · ${org.primaryContactEmail || "No email"}`} />
            <Info label="Telephone" value={org.primaryContactTelephone || "Not set"} />
            <Info label="Nominated administrator" value={org.nominatedAdminEmail || "No organisation administrator has accepted access."} />
            <Info label="Account owner" value={org.accountOwner || "Unassigned"} />
            <Info label="Onboarding" value={labelise(org.onboardingStatus)} />
            <Info label="Licence state" value={detail.licences.length ? `${detail.licences.length} configured` : "No licence has been configured for this organisation."} />
            <Info label="Seats state" value={detail.licences.length ? `${detail.licences.reduce((sum, licence) => sum + licence.activeSeats, 0)} active seats` : "No licence configured"} />
            <Info label="Recent activity" value={detail.auditEvents[0]?.action || "No activity yet"} />
          </dl>
          <p style={privacyStyle}>Private customer vault records, uploaded documents, legal contents and individual financial values are not queried by this workspace.</p>
        </section>
      ) : null}
      {tab === "audit" ? (
        <section style={panelStyle}>
          <h2>Audit</h2>
          <table style={tableStyle}><thead><tr><th>When</th><th>Action</th><th>Result</th><th>Actor role</th></tr></thead><tbody>
            {detail.auditEvents.map((event) => <tr key={event.id}><td>{formatDate(event.created_at)}</td><td>{event.action}</td><td>{event.result}</td><td>{event.actor_role || "Unknown"}</td></tr>)}
            {detail.auditEvents.length === 0 ? <tr><td colSpan={4}>No audit events for this organisation yet.</td></tr> : null}
          </tbody></table>
        </section>
      ) : null}
      {tab === "settings" ? (
        <section style={panelStyle}>
          <h2>Edit organisation</h2>
          <FormInput label="Legal name" required value={form.legalName} onChange={(legalName) => setForm({ ...form, legalName })} />
          <FormInput label="Trading name" value={form.tradingName} onChange={(tradingName) => setForm({ ...form, tradingName })} />
          <FormInput label="Registration number" value={form.registrationNumber} onChange={(registrationNumber) => setForm({ ...form, registrationNumber })} />
          <label style={labelStyle}>Organisation type<select value={form.organisationType} onChange={(event) => setForm({ ...form, organisationType: event.target.value })}>
            <option value="employer">Employer</option><option value="law_firm">Law firm</option><option value="wealth_manager">Wealth manager</option><option value="insurer">Insurer</option><option value="funeral_provider">Funeral provider</option><option value="employee_benefit_provider">Employee-benefit provider</option><option value="enterprise_reseller">Enterprise reseller</option><option value="other">Other</option>
          </select></label>
          {form.organisationType === "other" ? <FormInput label="Other organisation type" required value={form.organisationTypeOther} onChange={(organisationTypeOther) => setForm({ ...form, organisationTypeOther })} /> : null}
          <FormInput label="Primary contact email" required value={form.primaryContactEmail} onChange={(primaryContactEmail) => setForm({ ...form, primaryContactEmail })} />
          <FormInput label="Internal account owner" required value={form.internalAccountOwner} onChange={(internalAccountOwner) => setForm({ ...form, internalAccountOwner })} />
          <FormInput label="Nominated administrator email" value={form.nominatedAdminEmail} onChange={(nominatedAdminEmail) => setForm({ ...form, nominatedAdminEmail })} />
          <label style={labelStyle}>Risk<select value={form.riskStatus} onChange={(event) => setForm({ ...form, riskStatus: event.target.value })}><option value="normal">Normal</option><option value="watch">Watch</option><option value="at_risk">At risk</option><option value="critical">Critical</option></select></label>
          <label style={labelStyle}>Onboarding<select value={form.onboardingStatus} onChange={(event) => setForm({ ...form, onboardingStatus: event.target.value })}><option value="not_started">Not started</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select></label>
          <button type="button" style={primaryButtonStyle} onClick={() => runAction("update_organisation", form)}>Save organisation</button>
          <h2>Lifecycle</h2>
          <FormInput label="Reason" value={reason} onChange={setReason} />
          <div style={rowStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_organisation", { status: org.status === "suspended" ? "active" : "suspended", reason })}>{org.status === "suspended" ? "Reactivate" : "Suspend"}</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_organisation", { status: "expiring", reason })}>Mark expiring</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("delete_or_archive_organisation", { reason })}>Archive or delete</button>
          </div>
        </section>
      ) : null}
      {!["overview", "audit", "settings"].includes(tab) ? <section style={panelStyle}><h2>{labelise(tab)}</h2><p style={mutedStyle}>This section is staged for a later Enterprise Operations phase. No fabricated operational data is shown.</p></section> : null}
    </main>
  );
}

function toForm(org: Organisation): FormState {
  return {
    legalName: org.legalName,
    tradingName: org.tradingName || "",
    organisationType: org.type,
    organisationTypeOther: org.typeOther || "",
    registrationNumber: org.registrationNumber || "",
    country: org.country,
    website: org.website || "",
    primaryContactName: org.primaryContactName || "",
    primaryContactEmail: org.primaryContactEmail || "",
    primaryContactTelephone: org.primaryContactTelephone || "",
    internalAccountOwner: org.accountOwner || "",
    contractReference: org.contractReference || "",
    customerReference: org.customerReference || "",
    onboardingStatus: org.onboardingStatus || "not_started",
    onboardingNotes: org.onboardingNotes || "",
    riskStatus: org.risk,
    nominatedAdminName: org.nominatedAdminName || "",
    nominatedAdminEmail: org.nominatedAdminEmail || "",
    nominatedAdminRequireMfa: org.nominatedAdminRequireMfa,
    nominatedAdminExpiryDays: org.nominatedAdminExpiryDays || 14,
    expectedUpdatedAt: org.updatedAt,
  };
}

function FormInput({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label style={labelStyle}>{label}{required ? " *" : ""}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function labelise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc", color: "#111827" };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 };
const headerActionsStyle: CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 18, boxShadow: "0 12px 30px rgba(15,23,42,.05)", display: "grid", gap: 12 };
const h1Style: CSSProperties = { margin: 0, fontSize: 28, lineHeight: 1.15 };
const eyebrowStyle: CSSProperties = { margin: "0 0 8px", color: "#475569", fontSize: 12, textTransform: "uppercase", fontWeight: 800, letterSpacing: 0 };
const mutedStyle: CSSProperties = { color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 };
const privacyStyle: CSSProperties = { color: "#334155", background: "#f1f5f9", border: "1px solid #dbe3ef", borderRadius: 6, padding: 10, margin: "12px 0 0" };
const secondaryLinkStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", textDecoration: "none", background: "#fff", fontWeight: 700 };
const secondaryButtonStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", background: "#fff", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#111827", color: "#fff", fontWeight: 800 };
const stageBadgeStyle: CSSProperties = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 900 };
const alertStyle: CSSProperties = { background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16 };
const tabListStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const tabStyle: CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "9px 12px", fontWeight: 700 };
const activeTabStyle: CSSProperties = { ...tabStyle, background: "#111827", color: "#fff", borderColor: "#111827" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontWeight: 700, color: "#334155", fontSize: 13 };
const rowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const detailsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
