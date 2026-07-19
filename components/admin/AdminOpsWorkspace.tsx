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
    role: string;
    capabilities: string[];
    displayName: string;
  };
  admins?: Array<{
    id: string;
    email_normalized: string;
    user_id: string | null;
    status: string;
    is_master: boolean;
    role: string | null;
    display_name: string | null;
    granted_by_user_id?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
  message?: string;
};

type AdminActionResponse = {
  ok?: boolean;
  admins?: NonNullable<AdminSessionPayload["admins"]>;
  message?: string;
  code?: string;
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

type AdminAuditHistoryItem = {
  id: string;
  category: string;
  action: string;
  result: string;
  actorEmail: string | null;
  actorRole: string | null;
  resourceType: string;
  resourceLabel: string | null;
  route: string;
  policyDecision: string;
  createdAt: string;
};

type ProbateCaseEvidenceItem = {
  id: string;
  caseId: string;
  evidenceType: string;
  source: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  reviewStatus: string;
  createdAt: string;
};

type ProbateCaseStatus = "submitted" | "needs_information" | "under_review" | "approved" | "rejected" | "revoked" | "closed";

type ProbateCaseItem = {
  id: string;
  ownerName: string;
  contactName: string;
  contactEmail: string;
  assignedRole: string;
  caseType: string;
  status: ProbateCaseStatus;
  submittedAt: string;
  reviewedAt: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  applicantStatusMessage: string;
  accessGrantId: string | null;
  evidence: ProbateCaseEvidenceItem[];
};

function getAllowedProbateActions(status: ProbateCaseStatus) {
  if (status === "submitted" || status === "needs_information" || status === "under_review") {
    return {
      canRequestInformation: true,
      canReview: true,
      canApprove: true,
      canReject: true,
      canRevoke: false,
      terminal: false,
    };
  }
  if (status === "approved") {
    return {
      canRequestInformation: false,
      canReview: false,
      canApprove: false,
      canReject: false,
      canRevoke: true,
      terminal: true,
    };
  }
  return {
    canRequestInformation: false,
    canReview: false,
    canApprove: false,
    canReject: false,
    canRevoke: false,
    terminal: true,
  };
}

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
  const [auditHistory, setAuditHistory] = useState<AdminAuditHistoryItem[]>([]);
  const [probateCases, setProbateCases] = useState<ProbateCaseItem[]>([]);
  const [probateDecisionNotes, setProbateDecisionNotes] = useState("");
  const [actingProbateCaseId, setActingProbateCaseId] = useState("");
  const [uploadingEvidenceFor, setUploadingEvidenceFor] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [actingAdminUserId, setActingAdminUserId] = useState("");
  const [actingVerificationId, setActingVerificationId] = useState("");
  const capabilities = adminInfo?.capabilities ?? [];
  const canManageAdmins = capabilities.includes("admin_users:manage");
  const canLookupUsers = capabilities.includes("users:lookup");
  const canReadSupport = capabilities.includes("support:read");
  const canReviewVerification = capabilities.includes("verification:review");
  const canDecideVerification = capabilities.includes("verification:decide");
  const canReadAudit = capabilities.includes("audit:read");
  const adminRoles = ["super_admin", "support_agent", "verification_reviewer", "probate_reviewer", "auditor", "enterprise_admin"];

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
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

    const [sessionRes, verificationRes, supportRes, auditRes, probateRes] = await Promise.all([
      authFetch("/api/internal/admin/session"),
      authFetch("/api/internal/admin/verifications"),
      authFetch("/api/internal/admin/support"),
      authFetch("/api/internal/admin/audit-history?limit=25"),
      authFetch("/api/internal/admin/probate-cases"),
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
    const auditJson = (await auditRes.json().catch(() => ({}))) as { events?: AdminAuditHistoryItem[] };
    const probateJson = (await probateRes.json().catch(() => ({}))) as { cases?: ProbateCaseItem[] };
    setVerificationQueue(verificationJson.queue ?? []);
    setSupport(supportJson.support ?? null);
    setAuditHistory(auditJson.events ?? []);
    setProbateCases(probateJson.cases ?? []);
    setState("ready");
  }, [authFetch, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
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
    const json = (await res.json().catch(() => ({}))) as AdminActionResponse;
    if (!res.ok || !json.ok) {
      setStatus(getAdminActionMessage(json.code, json.message));
    } else {
      setAdmins(json.admins ?? []);
      setNewAdminEmail("");
    }
    setSavingAdmin(false);
  }

  async function actOnAdminUser(adminUserId: string, action: "activate" | "deactivate" | "change_role", role?: string | null) {
    const target = admins.find((item) => item.id === adminUserId);
    if (target && isProtectedMasterAdmin(target) && (action === "deactivate" || (action === "change_role" && role !== "super_admin"))) {
      setStatus(getAdminActionMessage("ADMIN_PROTECTED_ACCOUNT"));
      return;
    }
    const reason =
      action === "activate"
        ? ""
        : window.prompt(
          action === "change_role"
            ? "Reason for changing this admin role"
            : "Reason for deactivating this admin user",
        );
    if (action !== "activate" && !String(reason ?? "").trim()) {
      setStatus("A reason is required before changing admin access.");
      return;
    }
    if (action !== "activate" && !window.confirm("Apply this admin access change? The server will record an audit event before changing access.")) {
      return;
    }
    setActingAdminUserId(adminUserId);
    setStatus("");
    const res = await authFetch("/api/internal/admin/admin-users", {
      method: "PATCH",
      body: JSON.stringify({ adminUserId, action, role, reason }),
    });
    const json = (await res.json().catch(() => ({}))) as AdminActionResponse;
    if (!res.ok || !json.ok) {
      setStatus(getAdminActionMessage(json.code, json.message));
    } else {
      setAdmins(json.admins ?? []);
      void loadAll();
    }
    setActingAdminUserId("");
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

  async function actOnProbateCase(caseId: string, action: "request_information" | "review" | "approve" | "reject" | "revoke") {
    setActingProbateCaseId(caseId);
    setStatus("");
    const res = await authFetch(`/api/internal/admin/probate-cases/${caseId}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, reason: probateDecisionNotes }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; case?: ProbateCaseItem; message?: string };
    if (!res.ok || !json.ok || !json.case) {
      setStatus(json.message || "Could not update probate case.");
    } else {
      setProbateCases((current) => current.map((item) => item.id === caseId ? json.case! : item));
      setProbateDecisionNotes("");
    }
    setActingProbateCaseId("");
  }

  async function uploadProbateEvidence(caseId: string, file: File | null) {
    if (!file) return;
    setUploadingEvidenceFor(caseId);
    setStatus("");
    const form = new FormData();
    form.set("file", file);
    form.set("evidenceType", "other_supporting_evidence");
    const res = await authFetch(`/api/internal/admin/probate-cases/${caseId}/evidence`, {
      method: "POST",
      body: form,
      headers: {},
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; evidence?: ProbateCaseEvidenceItem; message?: string };
    if (!res.ok || !json.ok || !json.evidence) {
      setStatus(json.message || "Could not upload evidence.");
    } else {
      setProbateCases((current) => current.map((item) => item.id === caseId
        ? { ...item, evidence: [json.evidence!, ...item.evidence] }
        : item));
    }
    setUploadingEvidenceFor("");
  }

  async function openProbateEvidence(caseId: string, evidenceId: string) {
    setStatus("");
    const res = await authFetch(`/api/internal/admin/probate-cases/${caseId}/evidence/${evidenceId}/signed-url`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; signedUrl?: string; message?: string };
    if (!res.ok || !json.ok || !json.signedUrl) {
      setStatus(json.message || "Could not open evidence.");
      return;
    }
    window.open(json.signedUrl, "_blank", "noopener,noreferrer");
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
          {adminInfo?.isMasterAdmin ? <span style={masterPillStyle}>Master admin</span> : <span style={pillStyle}>{String(adminInfo?.role ?? "authorised_admin").replace(/_/g, " ")}</span>}
          <span style={pillStyle}>{capabilities.length} permissions</span>
          <Link href="/dashboard" style={linkBtnStyle}>Open customer dashboard</Link>
        </div>
      </section>

      {status ? <section style={panelStyle}><div style={{ color: "#b91c1c", fontSize: 13 }}>{status}</div></section> : null}

      <nav aria-label="Admin sections" style={navStyle}>
        <a href="#admin-users" style={navLinkStyle}>Admin users</a>
        <a href="#support-tools" style={navLinkStyle}>Support</a>
        <a href="#user-lookup" style={navLinkStyle}>Users</a>
        <a href="#verification-queue" style={navLinkStyle}>Verification</a>
        <a href="#probate-cases" style={navLinkStyle}>Probate</a>
        <a href="#audit-history" style={navLinkStyle}>Audit</a>
      </nav>

      <section style={gridStyle}>
        <section id="admin-users" style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={h2Style}>Admin users</h2>
              <div style={mutedStyle}>{canManageAdmins ? "Designate additional admin users without exposing admin entry points in the main application." : "Your current admin role does not include admin user management."}</div>
            </div>
          </div>
          {canManageAdmins ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={newAdminEmail}
              onChange={(event) => setNewAdminEmail(event.target.value)}
              placeholder="Add admin email"
              style={inputStyle}
            />
            <button type="button" style={primaryBtnStyle} onClick={() => void saveAdminUser()} disabled={savingAdmin}>
              {savingAdmin ? "Saving..." : "Add admin"}
            </button>
          </div> : null}
          <div style={{ display: "grid", gap: 8 }}>
            {admins.map((item) => (
              <article key={item.id} style={rowStyle}>
                <div style={{ fontWeight: 700 }}>{item.display_name || item.email_normalized}</div>
                <div style={mutedStyle}>{item.email_normalized}</div>
                <div style={mutedStyle}>
                  Role {String(item.role ?? (item.is_master ? "super_admin" : "support_agent")).replace(/_/g, " ")}
                  {item.created_at ? ` · Created ${formatDate(item.created_at)}` : ""}
                  {isSyntheticAdmin(item) ? " · Synthetic staging admin" : ""}
                  {isProtectedMasterAdmin(item) ? " · Protected master admin" : ""}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={item.is_master ? masterPillStyle : pillStyle}>{item.is_master ? "Master admin" : "Admin"}</span>
                  <span style={item.status === "active" ? positivePillStyle : pillStyle}>{item.status}</span>
                </div>
                {canManageAdmins ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={mutedStyle}>Role</span>
                      <select
                        value={String(item.role ?? (item.is_master ? "super_admin" : "support_agent"))}
                        style={inputStyle}
                        disabled={actingAdminUserId === item.id || isProtectedMasterAdmin(item)}
                        onChange={(event) => void actOnAdminUser(item.id, "change_role", event.target.value)}
                      >
                        {adminRoles.map((role) => (
                          <option key={role} value={role}>{role.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </label>
                    {item.status === "active" ? (
                      <button type="button" style={dangerBtnStyle} disabled={actingAdminUserId === item.id || isProtectedMasterAdmin(item)} onClick={() => void actOnAdminUser(item.id, "deactivate")}>
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" style={primaryBtnStyle} disabled={actingAdminUserId === item.id} onClick={() => void actOnAdminUser(item.id, "activate")}>
                        Activate
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section id="support-tools" style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={h2Style}>Support tools</h2>
              <div style={mutedStyle}>{canReadSupport ? "High-level signals for invitation, linked access, and verification support work." : "Support queue access is not available for this admin role."}</div>
            </div>
          </div>
          {canReadSupport ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {supportCards.map((item) => (
              <a key={item.label} href={supportCardHref(item.label)} style={metricCardLinkStyle}>
                <div style={mutedStyle}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{item.value}</div>
              </a>
            ))}
          </div> : null}
          {canReadSupport ? <div style={{ display: "grid", gap: 8 }}>
            {(support?.issues ?? []).map((item) => (
              <article key={item.invitationId} style={rowStyle}>
                <div style={{ fontWeight: 700 }}>{item.contactName || item.contactEmail}</div>
                <div style={mutedStyle}>{item.ownerName} · {item.assignedRole.replace(/_/g, " ")}</div>
                <div style={mutedStyle}>{item.issueLabel}</div>
              </article>
            ))}
            {support && support.issues.length === 0 ? <div style={mutedStyle}>No invitation or linked-access issues need attention right now.</div> : null}
          </div> : null}
        </section>
      </section>

      <section id="user-lookup" style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>User lookup</h2>
            <div style={mutedStyle}>{canLookupUsers ? "Search by email or display name and review a safe account summary for support context." : "User lookup requires support or super admin permission."}</div>
          </div>
        </div>
        {canLookupUsers ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={lookupQuery}
            onChange={(event) => setLookupQuery(event.target.value)}
            placeholder="Search by email or name"
            style={inputStyle}
          />
          <button type="button" style={primaryBtnStyle} onClick={() => void runLookup()} disabled={lookupLoading}>
            {lookupLoading ? "Searching..." : "Search users"}
          </button>
        </div> : null}
        {canLookupUsers ? <div style={{ display: "grid", gap: 8 }}>
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
        </div> : null}
      </section>

      <section id="verification-queue" style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>Executor verification queue</h2>
            <div style={mutedStyle}>{canReviewVerification || canDecideVerification ? "Review submitted evidence and decide whether linked access can move forward." : "Verification queue access is not available for this admin role."}</div>
          </div>
        </div>
        {canReviewVerification || canDecideVerification ? <div style={{ display: "grid", gap: 10 }}>
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
                <button type="button" style={ghostBtnStyle} onClick={() => void actOnVerification(item.id, "review")} disabled={!canReviewVerification || actingVerificationId === item.id}>
                  Mark reviewed
                </button>
                <button type="button" style={primaryBtnStyle} onClick={() => void actOnVerification(item.id, "approve")} disabled={!canDecideVerification || actingVerificationId === item.id}>
                  Approve
                </button>
                <button type="button" style={dangerBtnStyle} onClick={() => void actOnVerification(item.id, "reject")} disabled={!canDecideVerification || actingVerificationId === item.id}>
                  Reject
                </button>
              </div>
            </article>
          ))}
          {verificationQueue.length === 0 ? <div style={mutedStyle}>No executor verification cases are waiting in the queue.</div> : null}
        </div> : null}
      </section>

      <section id="probate-cases" style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>Probate and executor cases</h2>
            <div style={mutedStyle}>{canReviewVerification || canDecideVerification ? "Live governed cases with evidence, required notes, decisions, access grants, revocation and audit events." : "Probate case access is not available for this admin role."}</div>
          </div>
        </div>
        {canReviewVerification || canDecideVerification ? (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={mutedStyle}>Decision notes required for request-info, review, approve, reject and revoke</span>
              <textarea
                value={probateDecisionNotes}
                onChange={(event) => setProbateDecisionNotes(event.target.value)}
                placeholder="Record the operational reason before changing a case."
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              />
            </label>
            {probateCases.map((item) => {
              const actions = getAllowedProbateActions(item.status);
              return (
              <article key={item.id} style={rowStyle}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={positivePillStyle}>{item.status.replace(/_/g, " ")}</span>
                  <span style={pillStyle}>{item.caseType.replace(/_/g, " ")}</span>
                  <span style={pillStyle}>{item.assignedRole.replace(/_/g, " ")}</span>
                </div>
                <div style={{ fontWeight: 700 }}>{item.ownerName} · {item.contactName}</div>
                <div style={mutedStyle}>{item.contactEmail || "No contact email"} · Submitted {formatDate(item.submittedAt)}</div>
                <div style={mutedStyle}>{item.applicantStatusMessage}</div>
                {item.decisionReason ? <div style={mutedStyle}>Last notes: {item.decisionReason}</div> : null}
                {actions.terminal ? (
                  <div style={mutedStyle}>
                    Terminal status{item.decidedAt ? ` · decided ${formatDate(item.decidedAt)}` : ""}. Further approve or reject actions are unavailable for this case.
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Evidence</div>
                  {item.evidence.map((evidence) => (
                    <div key={evidence.id} style={{ ...rowStyle, background: "#fff" }}>
                      <div style={{ fontWeight: 700 }}>{evidence.fileName}</div>
                      <div style={mutedStyle}>{evidence.evidenceType.replace(/_/g, " ")} · {evidence.mimeType} · {formatDate(evidence.createdAt)}</div>
                      <button type="button" style={ghostBtnStyle} onClick={() => void openProbateEvidence(item.id, evidence.id)}>
                        View evidence
                      </button>
                    </div>
                  ))}
                  {item.evidence.length === 0 ? <div style={mutedStyle}>No evidence linked yet.</div> : null}
                  <label style={ghostBtnStyle}>
                    {uploadingEvidenceFor === item.id ? "Uploading..." : "Upload evidence"}
                    <input
                      type="file"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        event.currentTarget.value = "";
                        void uploadProbateEvidence(item.id, file);
                      }}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={ghostBtnStyle} disabled={!canReviewVerification || actingProbateCaseId === item.id || !actions.canRequestInformation} onClick={() => void actOnProbateCase(item.id, "request_information")}>
                    Request information
                  </button>
                  <button type="button" style={ghostBtnStyle} disabled={!canReviewVerification || actingProbateCaseId === item.id || !actions.canReview} onClick={() => void actOnProbateCase(item.id, "review")}>
                    Mark under review
                  </button>
                  <button type="button" style={primaryBtnStyle} disabled={!canDecideVerification || actingProbateCaseId === item.id || !actions.canApprove} onClick={() => void actOnProbateCase(item.id, "approve")}>
                    Approve limited access
                  </button>
                  <button type="button" style={dangerBtnStyle} disabled={!canDecideVerification || actingProbateCaseId === item.id || !actions.canReject} onClick={() => void actOnProbateCase(item.id, "reject")}>
                    Reject
                  </button>
                  <button type="button" style={dangerBtnStyle} disabled={!canDecideVerification || actingProbateCaseId === item.id || !actions.canRevoke} onClick={() => void actOnProbateCase(item.id, "revoke")}>
                    Revoke access
                  </button>
                </div>
              </article>
              );
            })}
            {probateCases.length === 0 ? <div style={mutedStyle}>No live probate or executor cases are available yet.</div> : null}
          </div>
        ) : null}
      </section>

      <section id="audit-history" style={panelStyle} aria-label="Audit history">
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>Audit history</h2>
            <div style={mutedStyle}>{canReadAudit ? "Read-only view of recent admin audit events. Payload metadata and internal secrets are not shown." : "Audit history requires auditor or super admin permission."}</div>
          </div>
        </div>
        {canReadAudit ? <div style={{ display: "grid", gap: 10 }}>
          {auditHistory.map((item) => (
            <article key={item.id} style={rowStyle}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={positivePillStyle}>{item.result.replace(/_/g, " ")}</span>
                <span style={pillStyle}>{item.category.replace(/_/g, " ")}</span>
                <span style={pillStyle}>{item.policyDecision.replace(/_/g, " ")}</span>
              </div>
              <div style={{ fontWeight: 700 }}>{item.action}</div>
              <div style={mutedStyle}>
                {item.actorEmail || "Unknown actor"} · {item.actorRole ? item.actorRole.replace(/_/g, " ") : "unknown role"} · {formatDate(item.createdAt)}
              </div>
              <div style={mutedStyle}>
                {item.resourceType.replace(/_/g, " ")}{item.resourceLabel ? ` · ${item.resourceLabel}` : ""} · {item.route}
              </div>
            </article>
          ))}
          {auditHistory.length === 0 ? <div style={mutedStyle}>No audit events are available yet.</div> : null}
        </div> : null}
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

function isSyntheticAdmin(item: { email_normalized: string; display_name: string | null }) {
  return /\blf uat\b/i.test(String(item.display_name ?? "")) || /\.test$/i.test(item.email_normalized);
}

function isProtectedMasterAdmin(item: { email_normalized: string; is_master?: boolean | null }) {
  return item.email_normalized.trim().toLowerCase() === "ivanyardley@me.com" || Boolean(item.is_master && item.email_normalized.trim().toLowerCase() === "ivanyardley@me.com");
}

function getAdminActionMessage(code?: string, fallback?: string) {
  const messages: Record<string, string> = {
    ADMIN_AUTH_REQUIRED: "You must be signed in to continue.",
    ADMIN_PERMISSION_DENIED: "You do not have permission to manage admin users.",
    ADMIN_INVALID_EMAIL: "Enter a valid admin email address.",
    ADMIN_INVALID_ROLE: "Choose a valid admin role.",
    ADMIN_INVALID_STATUS: "Choose a valid admin user action.",
    ADMIN_SELF_ACTION_BLOCKED: "You cannot remove your own active super-admin access.",
    ADMIN_PROTECTED_ACCOUNT: "The protected master admin account cannot be deactivated or demoted.",
    ADMIN_LAST_SUPER_ADMIN: "At least one active super admin must remain.",
    ADMIN_AUDIT_FAILED: "Admin audit logging is unavailable, so the change was not applied.",
    ADMIN_RATE_LIMITED: "Too many admin changes were attempted. Wait and try again.",
    ADMIN_OPERATION_CONFLICT: "The admin user changed state. Reload and try again.",
  };
  if (code && messages[code]) return messages[code];
  return fallback || "Could not complete the admin change safely.";
}

function supportCardHref(label: string) {
  if (/pending invitations/i.test(label)) return "#support-tools";
  if (/verification/i.test(label)) return "#verification-queue";
  if (/linked accounts|invitation/i.test(label)) return "#support-tools";
  return "#support-tools";
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

const navStyle: CSSProperties = {
  border: "1px solid #d8dee8",
  borderRadius: 12,
  background: "#fff",
  padding: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const navLinkStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  color: "#0f172a",
  textDecoration: "none",
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 600,
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

const metricCardLinkStyle: CSSProperties = {
  ...metricCardStyle,
  color: "#0f172a",
  textDecoration: "none",
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
