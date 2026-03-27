"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";

type AdminSessionPayload = {
  ok: boolean;
  admin?: {
    email: string;
    isMasterAdmin: boolean;
    displayName: string;
  };
  admins?: Array<{
    id: string;
    email_normalized: string;
    status: string;
    is_master: boolean;
    display_name: string | null;
  }>;
  message?: string;
};

type AdminLookupResult = {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastSignInAt: string;
  hasProfile: boolean;
  counts: {
    assets: number;
    documents: number;
    contacts: number;
    invitations: number;
    linkedAccessGrants: number;
    verificationRequests: number;
  };
  commercial: {
    accountPlan: string;
    planStatus: string;
    monthlyCharge: number;
    billingCurrency: string;
  };
};

type AdminVerificationItem = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  assignedRole: string;
  activationStatus: string;
  requestType: string;
  requestStatus: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  contactName: string;
  contactEmail: string;
  evidencePath: string | null;
};

type AdminSupportSnapshot = {
  counts: {
    pendingInvitations: number;
    verificationAwaitingReview: number;
    linkedAccountsActive: number;
    invitationIssues: number;
  };
  issues: Array<{
    invitationId: string;
    ownerName: string;
    contactName: string;
    contactEmail: string;
    assignedRole: string;
    invitationStatus: string;
    activationStatus: string;
    issueLabel: string;
  }>;
};

type LoadState = "checking" | "ready" | "denied";

export default function AdminOpsWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("checking");
  const [status, setStatus] = useState("");
  const [adminInfo, setAdminInfo] = useState<AdminSessionPayload["admin"] | null>(null);
  const [admins, setAdmins] = useState<NonNullable<AdminSessionPayload["admins"]>>([]);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<AdminLookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [verificationQueue, setVerificationQueue] = useState<AdminVerificationItem[]>([]);
  const [support, setSupport] = useState<AdminSupportSnapshot | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [actingVerificationId, setActingVerificationId] = useState("");

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body) headers.set("content-type", "application/json");
    return fetch(input, {
      ...init,
      headers,
    });
  }, []);

  const loadAll = useCallback(async () => {
    setStatus("");

    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent("/internal/admin")}`);
      return;
    }

    const [sessionRes, verificationRes, supportRes] = await Promise.all([
      authFetch("/api/internal/admin/session"),
      authFetch("/api/internal/admin/verifications"),
      authFetch("/api/internal/admin/support"),
    ]);

    const sessionJson = (await sessionRes.json().catch(() => ({}))) as AdminSessionPayload;
    if (!sessionRes.ok || !sessionJson.ok || !sessionJson.admin) {
      setState("denied");
      setStatus(sessionJson.message || "Admin access is restricted.");
      return;
    }

    setAdminInfo(sessionJson.admin);
    setAdmins(sessionJson.admins ?? []);

    const verificationJson = (await verificationRes.json().catch(() => ({}))) as { queue?: AdminVerificationItem[] };
    const supportJson = (await supportRes.json().catch(() => ({}))) as { support?: AdminSupportSnapshot };
    setVerificationQueue(verificationJson.queue ?? []);
    setSupport(supportJson.support ?? null);
    setState("ready");
  }, [authFetch, router]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function runLookup() {
    setLookupLoading(true);
    setStatus("");
    const res = await authFetch(`/api/internal/admin/users?q=${encodeURIComponent(lookupQuery.trim())}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; users?: AdminLookupResult[]; message?: string };
    if (!res.ok || !json.ok) {
      setStatus(json.message || "Could not load user lookup results.");
      setLookupResults([]);
    } else {
      setLookupResults(json.users ?? []);
    }
    setLookupLoading(false);
  }

  async function saveAdminUser() {
    setSavingAdmin(true);
    setStatus("");
    const res = await authFetch("/api/internal/admin/admin-users", {
      method: "POST",
      body: JSON.stringify({ email: newAdminEmail }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; admins?: NonNullable<AdminSessionPayload["admins"]>; message?: string };
    if (!res.ok || !json.ok) {
      setStatus(json.message || "Could not store admin user.");
    } else {
      setAdmins(json.admins ?? []);
      setNewAdminEmail("");
    }
    setSavingAdmin(false);
  }

  async function actOnVerification(requestId: string, action: "approve" | "reject" | "review") {
    setActingVerificationId(requestId);
    setStatus("");
    const res = await authFetch("/api/internal/admin/verifications", {
      method: "POST",
      body: JSON.stringify({ requestId, action }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; queue?: AdminVerificationItem[]; message?: string };
    if (!res.ok || !json.ok) {
      setStatus(json.message || "Could not update verification request.");
    } else {
      setVerificationQueue(json.queue ?? []);
    }
    setActingVerificationId("");
  }

  const supportCards = useMemo(() => {
    if (!support) return [];
    return [
      { label: "Pending invitations", value: support.counts.pendingInvitations },
      { label: "Verification awaiting review", value: support.counts.verificationAwaitingReview },
      { label: "Active linked accounts", value: support.counts.linkedAccountsActive },
      { label: "Invitation / access issues", value: support.counts.invitationIssues },
    ];
  }, [support]);

  if (state === "checking") {
    return <main style={pageStyle}><section style={panelStyle}>Checking admin access...</section></main>;
  }

  if (state === "denied") {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Access denied</div>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            {status || "This operational area is restricted to authorised admin users."}
          </div>
          <Link href="/dashboard" style={linkBtnStyle}>Return to dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
            Internal admin operations
          </div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Admin operations</h1>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Operational access for support, verification review, and controlled admin user management. This area is intentionally isolated from the standard customer application.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle}>{adminInfo?.displayName || adminInfo?.email}</span>
          {adminInfo?.isMasterAdmin ? <span style={masterPillStyle}>Master admin</span> : <span style={pillStyle}>Authorised admin</span>}
          <Link href="/dashboard" style={linkBtnStyle}>Open customer dashboard</Link>
        </div>
      </section>

      {status ? <section style={panelStyle}><div style={{ color: "#b91c1c", fontSize: 13 }}>{status}</div></section> : null}

      <section style={gridStyle}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={h2Style}>Admin users</h2>
              <div style={mutedStyle}>Designate additional admin users without exposing admin entry points in the main application.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={newAdminEmail}
              onChange={(event) => setNewAdminEmail(event.target.value)}
              placeholder="Add admin email"
              style={inputStyle}
            />
            <button type="button" style={primaryBtnStyle} onClick={() => void saveAdminUser()} disabled={savingAdmin}>
              {savingAdmin ? "Saving..." : "Add admin"}
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {admins.map((item) => (
              <article key={item.id} style={rowStyle}>
                <div style={{ fontWeight: 700 }}>{item.display_name || item.email_normalized}</div>
                <div style={mutedStyle}>{item.email_normalized}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={item.is_master ? masterPillStyle : pillStyle}>{item.is_master ? "Master admin" : "Admin"}</span>
                  <span style={item.status === "active" ? positivePillStyle : pillStyle}>{item.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={h2Style}>Support tools</h2>
              <div style={mutedStyle}>High-level signals for invitation, linked access, and verification support work.</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {supportCards.map((item) => (
              <div key={item.label} style={metricCardStyle}>
                <div style={mutedStyle}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {(support?.issues ?? []).map((item) => (
              <article key={item.invitationId} style={rowStyle}>
                <div style={{ fontWeight: 700 }}>{item.contactName || item.contactEmail}</div>
                <div style={mutedStyle}>{item.ownerName} · {item.assignedRole.replace(/_/g, " ")}</div>
                <div style={mutedStyle}>{item.issueLabel}</div>
              </article>
            ))}
            {support && support.issues.length === 0 ? <div style={mutedStyle}>No invitation or linked-access issues need attention right now.</div> : null}
          </div>
        </section>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>User lookup</h2>
            <div style={mutedStyle}>Search by email or display name and review a safe account summary for support context.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={lookupQuery}
            onChange={(event) => setLookupQuery(event.target.value)}
            placeholder="Search by email or name"
            style={inputStyle}
          />
          <button type="button" style={primaryBtnStyle} onClick={() => void runLookup()} disabled={lookupLoading}>
            {lookupLoading ? "Searching..." : "Search users"}
          </button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {lookupResults.map((item) => (
            <article key={item.userId} style={rowStyle}>
              <div style={{ fontWeight: 700 }}>{item.displayName}</div>
              <div style={mutedStyle}>{item.email}</div>
              <div style={mutedStyle}>
                Plan {item.commercial.accountPlan.replace(/_/g, " ")} · {item.commercial.planStatus.replace(/_/g, " ")}
                {item.commercial.monthlyCharge > 0 ? ` · ${item.commercial.billingCurrency} ${item.commercial.monthlyCharge.toFixed(2)}` : ""}
              </div>
              <div style={mutedStyle}>
                Assets {item.counts.assets} · Documents {item.counts.documents} · Contacts {item.counts.contacts} · Invitations {item.counts.invitations} · Grants {item.counts.linkedAccessGrants}
              </div>
              <div style={mutedStyle}>
                {item.hasProfile ? "Profile in place" : "Profile missing"} · Created {formatDate(item.createdAt)} · Last sign-in {formatDate(item.lastSignInAt)}
              </div>
            </article>
          ))}
          {!lookupLoading && lookupResults.length === 0 ? <div style={mutedStyle}>Search results will appear here.</div> : null}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>Executor verification queue</h2>
            <div style={mutedStyle}>Review submitted evidence and decide whether linked access can move forward.</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {verificationQueue.map((item) => (
            <article key={item.id} style={rowStyle}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700 }}>{item.ownerName} · {item.contactName}</div>
                <div style={mutedStyle}>
                  {item.assignedRole.replace(/_/g, " ")} · {item.requestType.replace(/_/g, " ")} · Submitted {formatDate(item.submittedAt)}
                </div>
                <div style={mutedStyle}>
                  Status: {item.requestStatus.replace(/_/g, " ")} · Activation: {item.activationStatus.replace(/_/g, " ")}
                </div>
                <div style={mutedStyle}>
                  {item.contactEmail || "No contact email"}{item.evidencePath ? ` · Evidence on file` : " · No evidence document"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={ghostBtnStyle} onClick={() => void actOnVerification(item.id, "review")} disabled={actingVerificationId === item.id}>
                  Mark reviewed
                </button>
                <button type="button" style={primaryBtnStyle} onClick={() => void actOnVerification(item.id, "approve")} disabled={actingVerificationId === item.id}>
                  Approve
                </button>
                <button type="button" style={dangerBtnStyle} onClick={() => void actOnVerification(item.id, "reject")} disabled={actingVerificationId === item.id}>
                  Reject
                </button>
              </div>
            </article>
          ))}
          {verificationQueue.length === 0 ? <div style={mutedStyle}>No executor verification cases are waiting in the queue.</div> : null}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "Not available";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#f4f5f7",
  padding: 24,
  display: "grid",
  gap: 16,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const panelStyle: CSSProperties = {
  border: "1px solid #d8dee8",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 12,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const mutedStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  flex: "1 1 280px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
};

const primaryBtnStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const ghostBtnStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const dangerBtnStyle: CSSProperties = {
  ...ghostBtnStyle,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff7f7",
};

const rowStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  gap: 6,
};

const metricCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  gap: 4,
};

const pillStyle: CSSProperties = {
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#0f172a",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 600,
};

const masterPillStyle: CSSProperties = {
  ...pillStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const positivePillStyle: CSSProperties = {
  ...pillStyle,
  background: "#dcfce7",
  color: "#166534",
};

const linkBtnStyle: CSSProperties = {
  ...ghostBtnStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
