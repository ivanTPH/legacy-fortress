"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceSwitcher from "@/components/navigation/WorkspaceSwitcher";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type AdminControlPlaneSection =
  | "overview"
  | "users"
  | "user-detail"
  | "admin-users"
  | "admin-user-detail"
  | "invitations"
  | "access"
  | "verification"
  | "verification-detail"
  | "probate"
  | "probate-detail"
  | "support"
  | "audit"
  | "system-health"
  | "settings";

type AdminSessionPayload = {
  ok?: boolean;
  admin?: {
    email: string;
    isMasterAdmin?: boolean;
    role: string;
    capabilities: string[];
    displayName: string;
  };
  admins?: AdminUser[];
  invitations?: AdminInvitation[];
  message?: string;
};

type AdminUser = {
  id: string;
  email_normalized: string;
  user_id: string | null;
  display_name: string | null;
  status: string;
  is_master: boolean;
  role: string | null;
  created_at: string;
  updated_at: string;
};

type AdminInvitation = {
  id: string;
  email_normalized: string;
  full_name: string | null;
  role_template: string;
  scope_type: string;
  organisation_id: string | null;
  status: string;
  require_mfa: boolean;
  expires_at: string;
  access_expires_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type DashboardMetric = {
  key: string;
  label: string;
  value: number | null;
  available: boolean;
  status: "ok" | "warning" | "unavailable";
  definition: string;
  source: string;
  warning?: string;
};

type SupportSnapshot = {
  counts: {
    pendingInvitations: number;
    verificationAwaitingReview: number;
    linkedAccountsActive: number;
    invitationIssues: number;
  };
  issues: Array<{
    invitationId: string;
    ownerName: string;
    contactName: string | null;
    contactEmail: string | null;
    assignedRole: string;
    issueLabel: string;
  }>;
};

type VerificationItem = {
  id: string;
  ownerName: string;
  contactName: string;
  contactEmail: string | null;
  assignedRole: string;
  requestType: string;
  requestStatus: string;
  activationStatus: string;
  submittedAt: string;
  evidencePath: string | null;
};

type ProbateCase = {
  id: string;
  ownerName: string;
  contactName: string;
  contactEmail: string | null;
  caseType: string;
  status: string;
  assignedRole: string;
  submittedAt: string;
  decidedAt?: string | null;
  decisionReason?: string | null;
  applicantStatusMessage: string;
  evidence: Array<{
    id: string;
    fileName: string;
    evidenceType: string;
    mimeType: string;
    createdAt: string;
  }>;
};

type AuditEvent = {
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

type LookupUser = {
  userId: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  hasProfile: boolean;
  commercial: {
    accountPlan: string;
    planStatus: string;
    monthlyCharge: number;
    billingCurrency: string;
  };
  counts: {
    assets: number;
    documents: number;
    contacts: number;
    invitations: number;
    linkedAccessGrants: number;
  };
};

type HealthState = {
  appHealth: number | null;
  schemaHealth: number | null;
  versionStatus: number | null;
  schemaOk: boolean | null;
  version: string | null;
  environment: string | null;
};

const ADMIN_NAV = [
  {
    group: "Overview",
    items: [
      { section: "overview", label: "Overview", href: "/admin", capability: "admin.dashboard.read" },
    ],
  },
  {
    group: "Operations",
    items: [
      { section: "users", label: "Users", href: "/admin/users", capability: "users:lookup" },
      { section: "invitations", label: "Invitations", href: "/admin/invitations", capability: "support:read" },
      { section: "access", label: "Access requests", href: "/admin/access", capability: "support:read" },
      { section: "verification", label: "Verification", href: "/admin/verification", capability: "verification:read" },
      { section: "probate", label: "Probate", href: "/admin/probate", capability: "verification:read" },
      { section: "support", label: "Support", href: "/admin/support", capability: "support:read" },
      { section: "settings", label: "Enterprise organisations", href: "/application/enterprise", capability: "organisation:manage" },
    ],
  },
  {
    group: "Administration",
    items: [
      { section: "admin-users", label: "Admin users", href: "/admin/admin-users", capability: "admin_users:manage" },
      { section: "settings", label: "Settings", href: "/admin/settings", capability: "admin_shell:view" },
    ],
  },
  {
    group: "Governance",
    items: [
      { section: "audit", label: "Audit", href: "/admin/audit", capability: "audit:read" },
      { section: "system-health", label: "System health", href: "/admin/system-health", capability: "admin.dashboard.read" },
    ],
  },
] as const;

const PAGE_COPY: Record<AdminControlPlaneSection, { title: string; eyebrow: string; description: string }> = {
  overview: {
    title: "Admin overview",
    eyebrow: "Legacy Fortress Admin",
    description: "Privacy-safe operational summary with links into live queues. Customer vault contents and private documents are not shown here.",
  },
  users: {
    title: "Customer users",
    eyebrow: "Operations",
    description: "Search safe customer metadata for support context without exposing private vault contents.",
  },
  "user-detail": {
    title: "Customer user detail",
    eyebrow: "Operations",
    description: "Privacy-bounded user support summary. Detailed private records remain outside admin browsing.",
  },
  "admin-users": {
    title: "Admin users",
    eyebrow: "Administration",
    description: "Manage admin access through audited, server-authorised lifecycle controls.",
  },
  "admin-user-detail": {
    title: "Admin user detail",
    eyebrow: "Administration",
    description: "Review role, status, effective permission context, and recent governance events.",
  },
  invitations: {
    title: "Invitation queue",
    eyebrow: "Operations",
    description: "Review invitation and linked-access signals from the support snapshot.",
  },
  access: {
    title: "Access requests",
    eyebrow: "Operations",
    description: "Review linked-access issues and verification handoffs without exposing unrelated vault content.",
  },
  verification: {
    title: "Verification queue",
    eyebrow: "Operations",
    description: "Review executor verification requests and evidence presence.",
  },
  "verification-detail": {
    title: "Verification detail",
    eyebrow: "Operations",
    description: "Inspect one verification request in context.",
  },
  probate: {
    title: "Probate cases",
    eyebrow: "Operations",
    description: "Review probate cases with terminal actions derived from server transition rules.",
  },
  "probate-detail": {
    title: "Probate case detail",
    eyebrow: "Operations",
    description: "Inspect one probate case, its evidence metadata, decision state, and valid next actions.",
  },
  support: {
    title: "Support queue",
    eyebrow: "Operations",
    description: "Invitation, linked access, and verification issues that need operational follow-up.",
  },
  audit: {
    title: "Audit history",
    eyebrow: "Governance",
    description: "Read-only, sanitised admin audit trail with filters for actor, route, action, and outcome.",
  },
  "system-health": {
    title: "System health",
    eyebrow: "Governance",
    description: "Non-secret application, schema, deployment, and queue health signals.",
  },
  settings: {
    title: "Settings",
    eyebrow: "Configuration",
    description: "Governed configuration surface. High-risk settings remain read-only until dedicated audited APIs exist.",
  },
};

export default function AdminControlPlaneWorkspace({
  section = "overview",
  resourceId = null,
}: {
  section?: AdminControlPlaneSection;
  resourceId?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [admin, setAdmin] = useState<NonNullable<AdminSessionPayload["admin"]> | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminInvitations, setAdminInvitations] = useState<AdminInvitation[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [support, setSupport] = useState<SupportSnapshot | null>(null);
  const [verificationQueue, setVerificationQueue] = useState<VerificationItem[]>([]);
  const [probateCases, setProbateCases] = useState<ProbateCase[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<LookupUser[]>([]);
  const [auditFilter, setAuditFilter] = useState("");
  const [adminFilter, setAdminFilter] = useState<"real-active" | "all" | "synthetic" | "inactive">("real-active");
  const [adminInviteForm, setAdminInviteForm] = useState({
    email: "",
    fullName: "",
    roleTemplate: "support_agent",
    scopeType: "platform",
    expiryDays: 7,
    requireMfa: true,
  });
  const [health, setHealth] = useState<HealthState>({
    appHealth: null,
    schemaHealth: null,
    versionStatus: null,
    schemaOk: null,
    version: null,
    environment: null,
  });

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const capabilities = useMemo(() => admin?.capabilities ?? [], [admin?.capabilities]);
  const can = useCallback((capability: string) => capabilities.includes(capability), [capabilities]);

  const loadAll = useCallback(async () => {
    setState("checking");
    setMessage("");
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(currentHrefForSection(section, resourceId))}`);
      return;
    }

    const sessionRes = await authFetch("/api/internal/admin/session");
    const sessionJson = (await sessionRes.json().catch(() => ({}))) as AdminSessionPayload;
    if (sessionRes.status === 401) {
      router.replace(`/sign-in?next=${encodeURIComponent(currentHrefForSection(section, resourceId))}`);
      return;
    }
    if (!sessionRes.ok || !sessionJson.ok || !sessionJson.admin) {
      setState("denied");
      setMessage(sessionJson.message || "Admin access is restricted.");
      return;
    }
    setAdmin(sessionJson.admin);
    setAdmins(sessionJson.admins ?? []);
    setAdminInvitations(sessionJson.invitations ?? []);

    const requested = requestsForSection(section, sessionJson.admin.capabilities);
    const responses = await Promise.all(requested.map((item) => authFetch(item.url).then(async (res) => ({ ...item, res, json: await res.json().catch(() => ({})) }))));
    for (const item of responses) {
      if (!item.res.ok) continue;
      if (item.key === "summary") setMetrics(item.json.summary?.metrics ?? []);
      if (item.key === "support") setSupport(item.json.support ?? null);
      if (item.key === "verification") setVerificationQueue(item.json.queue ?? []);
      if (item.key === "probate") setProbateCases(item.json.cases ?? []);
      if (item.key === "audit") setAuditEvents(item.json.events ?? []);
    }
    if (section === "system-health") {
      const [appHealth, schemaHealth, version] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/health/schema"),
        fetch("/api/version"),
      ]);
      const schemaJson = await schemaHealth.json().catch(() => ({}));
      const versionJson = await version.json().catch(() => ({}));
      setHealth({
        appHealth: appHealth.status,
        schemaHealth: schemaHealth.status,
        versionStatus: version.status,
        schemaOk: schemaJson.ok ?? null,
        version: versionJson.version ?? null,
        environment: versionJson.env ?? null,
      });
    }
    setState("ready");
  }, [authFetch, resourceId, router, section]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  async function runLookup(query = lookupQuery) {
    const trimmed = query.trim();
    if (!trimmed) {
      setLookupResults([]);
      return;
    }
    const res = await authFetch(`/api/internal/admin/users?q=${encodeURIComponent(trimmed)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; users?: LookupUser[]; message?: string };
    if (!res.ok || !json.ok) {
      setMessage(json.message || "Could not search users.");
      setLookupResults([]);
      return;
    }
    setLookupResults(json.users ?? []);
  }

  async function sendAdminInvitation() {
    setMessage("");
    const res = await authFetch("/api/internal/admin/admin-users", {
      method: "POST",
      body: JSON.stringify(adminInviteForm),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; admins?: AdminUser[]; invitations?: AdminInvitation[]; message?: string };
    if (!res.ok || !json.ok) {
      setMessage(json.message || "Could not send admin invitation.");
      return;
    }
    setAdmins(json.admins ?? []);
    setAdminInvitations(json.invitations ?? []);
    setAdminInviteForm({ email: "", fullName: "", roleTemplate: "support_agent", scopeType: "platform", expiryDays: 7, requireMfa: true });
    setMessage("Admin invitation sent. The recipient is not active until they accept and satisfy required checks.");
  }

  const visibleNav = useMemo(() => {
    return ADMIN_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.capability)),
    })).filter((group) => group.items.length > 0);
  }, [can]);

  const page = PAGE_COPY[section];

  if (state === "checking") {
    return (
      <main style={loadingPageStyle}>
        <section style={panelStyle} aria-live="polite">
          <p style={eyebrowStyle}>Legacy Fortress Admin</p>
          <h1 style={h1Style}>Checking admin access</h1>
          <p style={mutedStyle}>Confirming your signed-in session and server-side permissions.</p>
        </section>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main style={loadingPageStyle}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Access denied</p>
          <h1 style={h1Style}>Admin access is restricted</h1>
          <p style={mutedStyle}>{message || "This area is available only to authorised admin users."}</p>
          <Link href="/dashboard" style={secondaryLinkStyle}>Return to customer app</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <aside style={sidebarStyle} aria-label="Admin navigation">
        <Link href="/admin" style={brandStyle}>
          <span style={brandMarkStyle}>LF</span>
          <span>
            <strong>Legacy Fortress</strong>
            <small>Admin control plane</small>
          </span>
        </Link>
        <nav style={navStackStyle}>
          {visibleNav.map((group) => (
            <section key={group.group} style={navGroupStyle}>
              <div style={navGroupLabelStyle}>{group.group}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrentSection(section, item.section) ? "page" : undefined}
                  style={isCurrentSection(section, item.section) ? activeNavLinkStyle : navLinkStyle}
                >
                  {item.label}
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <section style={contentStyle}>
        <header style={topbarStyle}>
          <div>
            <p style={eyebrowStyle}>{page.eyebrow}</p>
            <h1 style={h1Style}>{page.title}</h1>
            <p style={mutedStyle}>{page.description}</p>
          </div>
          <div style={topbarActionsStyle}>
            <WorkspaceSwitcher currentPathname={currentHrefForSection(section, resourceId)} alwaysShow compact />
            <Link href="/dashboard" style={secondaryLinkStyle}>Customer app</Link>
            <button type="button" onClick={signOut} style={secondaryButtonStyle}>Sign out</button>
          </div>
        </header>

        <nav aria-label="Breadcrumb" style={breadcrumbStyle}>
          <Link href="/admin">Admin</Link>
          <span>/</span>
          <span>{page.title}</span>
        </nav>

        {message ? <section style={alertStyle}>{message}</section> : null}

        {section === "overview" ? renderOverview(metrics, support, verificationQueue, probateCases) : null}
        {section === "admin-users" || section === "admin-user-detail" ? renderAdminUsers(admins, adminInvitations, adminFilter, setAdminFilter, adminInviteForm, setAdminInviteForm, sendAdminInvitation, resourceId) : null}
        {section === "users" || section === "user-detail" ? renderUsers(lookupQuery, setLookupQuery, lookupResults, runLookup, resourceId) : null}
        {section === "support" || section === "invitations" || section === "access" ? renderSupport(section, support) : null}
        {section === "verification" || section === "verification-detail" ? renderVerification(verificationQueue, resourceId) : null}
        {section === "probate" || section === "probate-detail" ? renderProbate(probateCases, resourceId) : null}
        {section === "audit" ? renderAudit(auditEvents, auditFilter, setAuditFilter) : null}
        {section === "system-health" ? renderSystemHealth(health, metrics, support) : null}
        {section === "settings" ? renderSettings(capabilities) : null}
      </section>
    </main>
  );
}

function requestsForSection(section: AdminControlPlaneSection, capabilities: string[]) {
  const requests: Array<{ key: string; url: string }> = [];
  if (section === "overview" || section === "system-health") requests.push({ key: "summary", url: "/api/internal/admin/dashboard-summary" });
  if (["support", "invitations", "access", "overview", "system-health"].includes(section) && capabilities.includes("support:read")) {
    requests.push({ key: "support", url: "/api/internal/admin/support" });
  }
  if (["verification", "verification-detail", "overview"].includes(section) && capabilities.includes("verification:read")) {
    requests.push({ key: "verification", url: "/api/internal/admin/verifications" });
  }
  if (["probate", "probate-detail", "overview"].includes(section) && capabilities.includes("verification:read")) {
    requests.push({ key: "probate", url: "/api/internal/admin/probate-cases" });
  }
  if (["audit", "admin-user-detail"].includes(section) && capabilities.includes("audit:read")) {
    requests.push({ key: "audit", url: "/api/internal/admin/audit-history?limit=50" });
  }
  return requests;
}

function currentHrefForSection(section: AdminControlPlaneSection, resourceId: string | null) {
  if (section === "overview") return "/admin";
  if (section === "admin-user-detail") return `/admin/admin-users/${resourceId ?? ""}`;
  if (section === "user-detail") return `/admin/users/${resourceId ?? ""}`;
  if (section === "verification-detail") return `/admin/verification/${resourceId ?? ""}`;
  if (section === "probate-detail") return `/admin/probate/${resourceId ?? ""}`;
  return `/admin/${section}`;
}

function isCurrentSection(current: AdminControlPlaneSection, navSection: string) {
  if (current === navSection) return true;
  if (current === "admin-user-detail" && navSection === "admin-users") return true;
  if (current === "user-detail" && navSection === "users") return true;
  if (current === "verification-detail" && navSection === "verification") return true;
  if (current === "probate-detail" && navSection === "probate") return true;
  return false;
}

function renderOverview(metrics: DashboardMetric[], support: SupportSnapshot | null, verification: VerificationItem[], probate: ProbateCase[]) {
  const cards = [
    { label: "Pending invitations", value: support?.counts.pendingInvitations ?? null, href: "/admin/invitations?status=pending", source: "support snapshot" },
    { label: "Verification awaiting review", value: support?.counts.verificationAwaitingReview ?? verification.length, href: "/admin/verification?status=awaiting_review", source: "verification queue" },
    { label: "Probate cases", value: probate.length, href: "/admin/probate", source: "probate cases API" },
    { label: "Access issues", value: support?.counts.invitationIssues ?? null, href: "/admin/access?status=issue", source: "support snapshot" },
  ];
  return (
    <div style={stackStyle}>
      <section style={gridStyle}>
        {cards.map((card) => (
          <Link key={card.label} href={card.href} style={metricLinkStyle}>
            <span>{card.label}</span>
            <strong>{card.value === null ? "Unavailable" : card.value.toLocaleString()}</strong>
            <small>Source: {card.source}</small>
          </Link>
        ))}
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Operational metrics</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Metric</th><th>Status</th><th>Value</th><th>Destination</th></tr></thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.key}>
                  <td>{metric.label}<small>{metric.definition}</small></td>
                  <td>{metric.status}</td>
                  <td>{metric.available ? metric.value?.toLocaleString() : "Unavailable"}</td>
                  <td><Link href={metricDestination(metric.key)}>Open queue</Link></td>
                </tr>
              ))}
              {metrics.length === 0 ? <tr><td colSpan={4}>No summary metrics are available.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function renderAdminUsers(
  admins: AdminUser[],
  invitations: AdminInvitation[],
  filter: string,
  setFilter: (value: "real-active" | "all" | "synthetic" | "inactive") => void,
  inviteForm: {
    email: string;
    fullName: string;
    roleTemplate: string;
    scopeType: string;
    expiryDays: number;
    requireMfa: boolean;
  },
  setInviteForm: (value: {
    email: string;
    fullName: string;
    roleTemplate: string;
    scopeType: string;
    expiryDays: number;
    requireMfa: boolean;
  }) => void,
  sendAdminInvitation: () => Promise<void>,
  resourceId: string | null,
) {
  const filtered = admins.filter((item) => {
    const synthetic = isSyntheticAdmin(item);
    if (filter === "synthetic") return synthetic;
    if (filter === "inactive") return item.status !== "active";
    if (filter === "real-active") return !synthetic && item.status === "active";
    return true;
  });
  const selected = resourceId ? admins.find((item) => item.id === resourceId) : null;
  return (
    <div style={stackStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Invite administrator</h2>
        <p style={mutedStyle}>Sending an invitation does not activate admin access. The recipient must authenticate, accept terms, accept the role, and satisfy MFA where required.</p>
        <div style={formGridStyle}>
          <label>Email address *
            <input value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} />
          </label>
          <label>Full name
            <input value={inviteForm.fullName} onChange={(event) => setInviteForm({ ...inviteForm, fullName: event.target.value })} />
          </label>
          <label>Role template
            <select value={inviteForm.roleTemplate} onChange={(event) => setInviteForm({ ...inviteForm, roleTemplate: event.target.value })}>
              <option value="super_admin">Super administrator</option>
              <option value="support_agent">Support agent</option>
              <option value="probate_reviewer">Probate reviewer</option>
              <option value="auditor">Auditor</option>
              <option value="enterprise_admin">Enterprise administrator</option>
              <option value="read_only_operations">Read-only operations user</option>
            </select>
          </label>
          <label>Access scope
            <select value={inviteForm.scopeType} onChange={(event) => setInviteForm({ ...inviteForm, scopeType: event.target.value })}>
              <option value="platform">Platform-wide</option>
              <option value="organisation">Specific organisation</option>
              <option value="support_only">Support-only</option>
              <option value="probate_only">Probate-only</option>
              <option value="read_only">Read-only</option>
              <option value="time_limited">Time-limited</option>
            </select>
          </label>
          <label>Invitation expiry days
            <input type="number" min={1} max={90} value={inviteForm.expiryDays} onChange={(event) => setInviteForm({ ...inviteForm, expiryDays: Number(event.target.value) })} />
          </label>
          <label style={checkboxLineStyle}>
            <input type="checkbox" checked={inviteForm.requireMfa} onChange={(event) => setInviteForm({ ...inviteForm, requireMfa: event.target.checked })} />
            Require MFA
          </label>
        </div>
        <section style={permissionSummaryStyle}>
          <strong>Permission summary</strong>
          <span>{permissionSummaryForRole(inviteForm.roleTemplate)}</span>
        </section>
        <button type="button" onClick={() => void sendAdminInvitation()} style={primaryButtonStyle}>Review and send invitation</button>
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Administrator invitations</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Recipient</th><th>Role</th><th>Scope</th><th>Status</th><th>MFA</th><th>Expires</th></tr></thead>
            <tbody>
              {invitations.map((item) => (
                <tr key={item.id}>
                  <td>{item.full_name || item.email_normalized}<small>{item.email_normalized}</small></td>
                  <td>{formatRoleLabel(item.role_template, item.role_template === "super_admin")}</td>
                  <td>{item.scope_type.replace(/_/g, " ")}</td>
                  <td>{item.status}</td>
                  <td>{item.require_mfa ? "Required" : "Not required"}</td>
                  <td>{formatDate(item.expires_at)}</td>
                </tr>
              ))}
              {invitations.length === 0 ? <tr><td colSpan={6}>No administrator invitations have been created.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={toolbarStyle}>
        <label>Admin filter
          <select value={filter} onChange={(event) => setFilter(event.target.value as "real-active" | "all" | "synthetic" | "inactive")}>
            <option value="real-active">Real active</option>
            <option value="all">All</option>
            <option value="synthetic">Synthetic</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <span>{filtered.length} shown · {admins.length} total</span>
      </section>
      {selected ? renderAdminDetail(selected) : null}
      <section style={panelStyle}>
        <h2 style={h2Style}>Admin users</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.display_name || item.email_normalized}<small>{item.email_normalized}{isSyntheticAdmin(item) ? " · Synthetic staging admin" : ""}</small></td>
                  <td>{formatRoleLabel(item.role, item.is_master)}</td>
                  <td>{item.status}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td><Link href={`/admin/admin-users/${item.id}`}>Inspect</Link></td>
                </tr>
              ))}
              {filtered.length === 0 ? <tr><td colSpan={5}>No admin users match this filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Lifecycle controls</h2>
        <p style={mutedStyle}>Role change, activation, deactivation, final-master protection, self-lockout protection, and audit recording are still served by `/api/internal/admin/admin-users`. High-impact actions require server-side permission and reason validation.</p>
        <Link href="/internal/admin" style={secondaryLinkStyle}>Open legacy lifecycle controls</Link>
      </section>
    </div>
  );
}

function permissionSummaryForRole(role: string) {
  if (role === "super_admin") return "Full platform administration, admin invitations, lifecycle actions, audit, enterprise management, probate and support.";
  if (role === "enterprise_admin") return "Enterprise organisations, licences, invitations, consent-aware reporting and governed export requests.";
  if (role === "probate_reviewer") return "Probate and verification queues with decision permissions; no enterprise licence management.";
  if (role === "auditor") return "Read-only audit and reporting review; no user mutation.";
  if (role === "read_only_operations") return "Read-only operational review only. Mutation actions stay blocked.";
  return "Support user lookup, invitations and support queues. Probate approval and enterprise licence management stay blocked.";
}

function renderAdminDetail(item: AdminUser) {
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{item.display_name || item.email_normalized}</h2>
      <dl style={definitionGridStyle}>
        <div><dt>Email</dt><dd>{item.email_normalized}</dd></div>
        <div><dt>Role</dt><dd>{formatRoleLabel(item.role, item.is_master)}</dd></div>
        <div><dt>Status</dt><dd>{item.status}</dd></div>
        <div><dt>Environment scope</dt><dd>{isSyntheticAdmin(item) ? "Synthetic staging/local review" : "Staging operational admin"}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(item.created_at)}</dd></div>
        <div><dt>Updated</dt><dd>{formatDate(item.updated_at)}</dd></div>
      </dl>
    </section>
  );
}

function renderUsers(
  query: string,
  setQuery: (value: string) => void,
  results: LookupUser[],
  runLookup: (query?: string) => Promise<void>,
  resourceId: string | null,
) {
  const selected = resourceId ? results.find((item) => item.userId === resourceId) : null;
  return (
    <div style={stackStyle}>
      <section style={toolbarStyle}>
        <label>Search users
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email or display name" />
        </label>
        <button type="button" onClick={() => void runLookup()}>Search</button>
      </section>
      {selected ? (
        <section style={panelStyle}>
          <h2 style={h2Style}>{selected.displayName}</h2>
          <p style={mutedStyle}>Privacy-bounded account summary. Secure notes, document contents, storage paths and recovery data are not exposed.</p>
        </section>
      ) : null}
      <section style={panelStyle}>
        <h2 style={h2Style}>Safe lookup results</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>User</th><th>Plan</th><th>Counts</th><th>Last sign-in</th></tr></thead>
            <tbody>
              {results.map((item) => (
                <tr key={item.userId}>
                  <td>{item.displayName}<small>{item.email ?? "No email"} · {item.hasProfile ? "Profile present" : "Profile missing"}</small></td>
                  <td>{item.commercial.accountPlan.replace(/_/g, " ")} · {item.commercial.planStatus.replace(/_/g, " ")}</td>
                  <td>Assets {item.counts.assets} · Documents {item.counts.documents} · Contacts {item.counts.contacts}</td>
                  <td>{formatDate(item.lastSignInAt ?? "")}</td>
                </tr>
              ))}
              {results.length === 0 ? <tr><td colSpan={4}>Search to load live customer metadata.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function renderSupport(section: AdminControlPlaneSection, support: SupportSnapshot | null) {
  const title = section === "invitations" ? "Invitation issues" : section === "access" ? "Linked-access issues" : "Support issues";
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{title}</h2>
      <div style={gridStyle}>
        <Metric label="Pending invitations" value={support?.counts.pendingInvitations ?? null} />
        <Metric label="Verification awaiting review" value={support?.counts.verificationAwaitingReview ?? null} />
        <Metric label="Active linked accounts" value={support?.counts.linkedAccountsActive ?? null} />
        <Metric label="Invitation/access issues" value={support?.counts.invitationIssues ?? null} />
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead><tr><th>Contact</th><th>Owner</th><th>Role</th><th>Issue</th></tr></thead>
          <tbody>
            {(support?.issues ?? []).map((item) => (
              <tr key={item.invitationId}>
                <td>{item.contactName || item.contactEmail || "Unknown contact"}</td>
                <td>{item.ownerName}</td>
                <td>{item.assignedRole.replace(/_/g, " ")}</td>
                <td>{item.issueLabel}</td>
              </tr>
            ))}
            {support && support.issues.length === 0 ? <tr><td colSpan={4}>No support issues match this queue.</td></tr> : null}
            {!support ? <tr><td colSpan={4}>Support snapshot unavailable for this role or environment.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderVerification(queue: VerificationItem[], resourceId: string | null) {
  const selected = resourceId ? queue.find((item) => item.id === resourceId) : null;
  return (
    <div style={stackStyle}>
      {selected ? (
        <section style={panelStyle}>
          <h2 style={h2Style}>{selected.ownerName} / {selected.contactName}</h2>
          <p style={mutedStyle}>Evidence: {selected.evidencePath ? "metadata present" : "not linked"}. Opening evidence remains case-authorised through the existing server route.</p>
        </section>
      ) : null}
      <section style={panelStyle}>
        <h2 style={h2Style}>Verification queue</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Case</th><th>Role</th><th>Status</th><th>Evidence</th><th>Detail</th></tr></thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id}>
                  <td>{item.ownerName}<small>{item.contactName} · {formatDate(item.submittedAt)}</small></td>
                  <td>{item.assignedRole.replace(/_/g, " ")}</td>
                  <td>{item.requestStatus.replace(/_/g, " ")} · {item.activationStatus.replace(/_/g, " ")}</td>
                  <td>{item.evidencePath ? "On file" : "Missing"}</td>
                  <td><Link href={`/admin/verification/${item.id}`}>Inspect</Link></td>
                </tr>
              ))}
              {queue.length === 0 ? <tr><td colSpan={5}>No verification requests are waiting.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function renderProbate(cases: ProbateCase[], resourceId: string | null) {
  const selected = resourceId ? cases.find((item) => item.id === resourceId) : null;
  return (
    <div style={stackStyle}>
      {selected ? renderProbateDetail(selected) : null}
      <section style={panelStyle}>
        <h2 style={h2Style}>Probate queue</h2>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead><tr><th>Case</th><th>Status</th><th>Evidence</th><th>Next action</th><th>Detail</th></tr></thead>
            <tbody>
              {cases.map((item) => {
                const actions = getAllowedProbateActions(item.status);
                return (
                  <tr key={item.id}>
                    <td>{item.ownerName}<small>{item.contactName} · {formatDate(item.submittedAt)}</small></td>
                    <td>{item.status.replace(/_/g, " ")}</td>
                    <td>{item.evidence.length}</td>
                    <td>{actions.terminal ? "Terminal: inspect only" : "Review action available in legacy case controls"}</td>
                    <td><Link href={`/admin/probate/${item.id}`}>Inspect</Link></td>
                  </tr>
                );
              })}
              {cases.length === 0 ? <tr><td colSpan={5}>No probate cases are available.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function renderProbateDetail(item: ProbateCase) {
  const actions = getAllowedProbateActions(item.status);
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{item.ownerName} / {item.contactName}</h2>
      <dl style={definitionGridStyle}>
        <div><dt>Status</dt><dd>{item.status.replace(/_/g, " ")}</dd></div>
        <div><dt>Applicant</dt><dd>{item.contactEmail ?? "No email"}</dd></div>
        <div><dt>Role</dt><dd>{item.assignedRole.replace(/_/g, " ")}</dd></div>
        <div><dt>Evidence count</dt><dd>{item.evidence.length}</dd></div>
      </dl>
      {actions.terminal ? <p style={mutedStyle}>This case is terminal. Approve/reject actions are unavailable; decision history remains inspectable.</p> : null}
      <h3 style={h3Style}>Evidence metadata</h3>
      {item.evidence.map((evidence) => (
        <article key={evidence.id} style={rowStyle}>
          <strong>{evidence.fileName}</strong>
          <small>{evidence.evidenceType.replace(/_/g, " ")} · {evidence.mimeType} · {formatDate(evidence.createdAt)}</small>
        </article>
      ))}
      {item.evidence.length === 0 ? <p style={mutedStyle}>No evidence metadata is linked to this case.</p> : null}
    </section>
  );
}

function renderAudit(events: AuditEvent[], filter: string, setFilter: (value: string) => void) {
  const normalized = filter.trim().toLowerCase();
  const filtered = normalized
    ? events.filter((item) => JSON.stringify(item).toLowerCase().includes(normalized))
    : events;
  return (
    <section style={panelStyle}>
      <div style={toolbarStyle}>
        <label>Filter audit
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Actor, route, action, target" />
        </label>
        <span>{filtered.length} events</span>
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Route</th><th>Time</th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>{item.action}<small>{item.result} · {item.category}</small></td>
                <td>{item.actorEmail ?? "Unknown"}<small>{item.actorRole ?? "unknown role"}</small></td>
                <td>{item.resourceType.replace(/_/g, " ")}<small>{item.resourceLabel ?? "No label"}</small></td>
                <td>{item.route}</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan={5}>No audit events match this filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderSystemHealth(health: HealthState, metrics: DashboardMetric[], support: SupportSnapshot | null) {
  return (
    <div style={stackStyle}>
      <section style={gridStyle}>
        <Metric label="Application health" value={health.appHealth} suffix="HTTP" />
        <Metric label="Schema health" value={health.schemaHealth} suffix={health.schemaOk === false ? "check failed" : "HTTP"} />
        <Metric label="Version endpoint" value={health.versionStatus} suffix="HTTP" />
        <Metric label="Support backlog" value={support?.counts.invitationIssues ?? null} />
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Environment</h2>
        <dl style={definitionGridStyle}>
          <div><dt>App version</dt><dd>{health.version ?? "Unavailable"}</dd></div>
          <div><dt>Runtime environment</dt><dd>{health.environment ?? "Unavailable"}</dd></div>
          <div><dt>Metric count</dt><dd>{metrics.length}</dd></div>
          <div><dt>Secret exposure</dt><dd>Connection strings, tokens, and passwords are not displayed.</dd></div>
        </dl>
      </section>
    </div>
  );
}

function renderSettings(capabilities: string[]) {
  const settings = [
    ["General", "Environment identity and admin shell presentation are read-only."],
    ["Security", "Role changes, final-master protection, and reason capture remain server-authorised."],
    ["Invitations", "Expiry, resend, and revocation settings require dedicated audited APIs before editing."],
    ["Verification", "Reviewer decision rules remain enforced by existing verification endpoints."],
    ["Probate", "Terminal state transitions remain derived from canonical transition rules."],
    ["Documents", "Evidence review uses case-scoped signed URL routes; no public bucket changes are exposed here."],
    ["Audit and retention", "Audit history is immutable and read-only in this interface."],
  ];
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>Governed settings</h2>
      <p style={mutedStyle}>This page intentionally avoids a generic key/value editor. Editable controls should be added only with dedicated permissions, confirmation, reason capture, and audit events.</p>
      <div style={gridStyle}>
        {settings.map(([title, copy]) => (
          <article key={title} style={settingsCardStyle}>
            <strong>{title}</strong>
            <span>{copy}</span>
          </article>
        ))}
      </div>
      <p style={mutedStyle}>Effective permissions: {capabilities.length}</p>
    </section>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: number | null; suffix?: string }) {
  return (
    <article style={metricCardStyle}>
      <span>{label}</span>
      <strong>{value === null ? "Unavailable" : value.toLocaleString()}</strong>
      {suffix ? <small>{suffix}</small> : null}
    </article>
  );
}

function metricDestination(key: string) {
  if (/invitation/i.test(key)) return "/admin/invitations";
  if (/probate|will|executor/i.test(key)) return "/admin/probate";
  if (/email|support/i.test(key)) return "/admin/support";
  if (/user|vault/i.test(key)) return "/admin/users";
  return "/admin/system-health";
}

function isSyntheticAdmin(item: Pick<AdminUser, "email_normalized" | "display_name">) {
  return /\blf uat\b/i.test(String(item.display_name ?? "")) || /\.test$/i.test(item.email_normalized);
}

function formatRoleLabel(role: string | null, isMaster: boolean) {
  if (isMaster || role === "super_admin") return "Master admin";
  return String(role ?? "support_agent").replace(/_/g, " ");
}

function formatDate(value: string) {
  if (!value) return "Not available";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getAllowedProbateActions(status: string) {
  const normalized = String(status ?? "").toLowerCase();
  const terminal = ["approved", "rejected", "revoked", "completed", "closed"].includes(normalized);
  return {
    terminal,
    canRequestInformation: !terminal && normalized !== "needs_information",
    canReview: !terminal && normalized !== "under_review",
    canApprove: !terminal,
    canReject: !terminal,
    canRevoke: normalized === "approved",
  };
}

const shellStyle = {
  minHeight: "100dvh",
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  background: "#f4f6f8",
  color: "#0f172a",
} satisfies CSSProperties;

const loadingPageStyle = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  background: "#f4f6f8",
  padding: 24,
} satisfies CSSProperties;

const sidebarStyle = {
  position: "sticky",
  top: 0,
  height: "100dvh",
  overflow: "auto",
  background: "#111827",
  color: "#f8fafc",
  padding: 20,
  display: "grid",
  alignContent: "start",
  gap: 24,
} satisfies CSSProperties;

const brandStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "inherit",
  textDecoration: "none",
} satisfies CSSProperties;

const brandMarkStyle = {
  width: 36,
  height: 36,
  display: "grid",
  placeItems: "center",
  background: "#e5e7eb",
  color: "#111827",
  fontWeight: 800,
} satisfies CSSProperties;

const navStackStyle = { display: "grid", gap: 18 } satisfies CSSProperties;
const navGroupStyle = { display: "grid", gap: 6 } satisfies CSSProperties;
const navGroupLabelStyle = { fontSize: 11, textTransform: "uppercase", color: "#94a3b8", fontWeight: 800 } satisfies CSSProperties;
const navLinkStyle = { color: "#cbd5e1", textDecoration: "none", padding: "9px 10px", borderRadius: 6, fontWeight: 700 } satisfies CSSProperties;
const activeNavLinkStyle = { ...navLinkStyle, background: "#f8fafc", color: "#111827" } satisfies CSSProperties;

const contentStyle = { minWidth: 0, padding: 28, display: "grid", gap: 18, alignContent: "start" } satisfies CSSProperties;
const topbarStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 20 } satisfies CSSProperties;
const topbarActionsStyle = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" } satisfies CSSProperties;
const breadcrumbStyle = { display: "flex", gap: 8, fontSize: 13, color: "#64748b" } satisfies CSSProperties;
const panelStyle = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, display: "grid", gap: 14 } satisfies CSSProperties;
const alertStyle = { ...panelStyle, color: "#991b1b", background: "#fff7ed" } satisfies CSSProperties;
const stackStyle = { display: "grid", gap: 16 } satisfies CSSProperties;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 } satisfies CSSProperties;
const toolbarStyle = { ...panelStyle, display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" } satisfies CSSProperties;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 } satisfies CSSProperties;
const tableWrapStyle = { overflowX: "auto" } satisfies CSSProperties;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 } satisfies CSSProperties;
const definitionGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 } satisfies CSSProperties;
const metricLinkStyle = { ...panelStyle, color: "inherit", textDecoration: "none" } satisfies CSSProperties;
const metricCardStyle = { ...panelStyle, gap: 6 } satisfies CSSProperties;
const settingsCardStyle = { ...panelStyle, gap: 8 } satisfies CSSProperties;
const rowStyle = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "grid", gap: 4 } satisfies CSSProperties;
const eyebrowStyle = { margin: 0, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, fontWeight: 800 } satisfies CSSProperties;
const h1Style = { margin: 0, fontSize: 28, lineHeight: 1.15 } satisfies CSSProperties;
const h2Style = { margin: 0, fontSize: 20 } satisfies CSSProperties;
const h3Style = { margin: 0, fontSize: 16 } satisfies CSSProperties;
const mutedStyle = { margin: 0, color: "#64748b", lineHeight: 1.45 } satisfies CSSProperties;
const secondaryLinkStyle = { border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", color: "#0f172a", textDecoration: "none", fontWeight: 700, background: "#fff" } satisfies CSSProperties;
const secondaryButtonStyle = { ...secondaryLinkStyle, cursor: "pointer" } satisfies CSSProperties;
const primaryButtonStyle = { border: 0, borderRadius: 6, padding: "10px 14px", color: "#fff", background: "#111827", fontWeight: 800, cursor: "pointer" } satisfies CSSProperties;
const checkboxLineStyle = { display: "flex", gap: 8, alignItems: "center", fontWeight: 700 } satisfies CSSProperties;
const permissionSummaryStyle = { border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, background: "#eff6ff", color: "#1e3a8a", display: "grid", gap: 4 } satisfies CSSProperties;
