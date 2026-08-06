"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDataTable, { AdminEmptyState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import AdminWorkspaceShell from "@/components/admin/AdminWorkspaceShell";
import { filterAdminNavigation, PLATFORM_ADMIN_NAVIGATION } from "@/components/admin/adminNavigation";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type AdminControlPlaneSection =
  | "overview"
  | "organisations"
  | "organisation-detail"
  | "organisation-users"
  | "organisation-invitations"
  | "organisation-licences"
  | "licences"
  | "licence-detail"
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

type EnterprisePortfolio = {
  summary: {
    organisations: number;
    activeLicences: number;
    pendingInvitations: number;
    seats: {
      purchased: number;
      active: number;
      invited: number;
      available?: number;
    };
  };
  organisations: EnterpriseOrganisation[];
  licences: EnterpriseLicence[];
  invitations: EnterpriseInvitation[];
  memberships: EnterpriseMembership[];
};

type EnterpriseOrganisation = {
  id: string;
  name: string;
  legalName: string;
  tradingName: string | null;
  type: string;
  status: string;
  risk: string;
  primaryContactEmail: string | null;
  accountOwner: string | null;
  onboardingStatus: string;
  nominatedAdminName: string | null;
  nominatedAdminEmail: string | null;
  registrationNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

type EnterpriseLicence = {
  id: string;
  organisationId: string;
  plan: string;
  customPlanName: string | null;
  startDate: string;
  renewalDate: string;
  endDate: string | null;
  purchasedSeats: number;
  activeSeats: number;
  invitedSeats: number;
  availableSeats: number;
  billingStatus: string;
  status: string;
  accountOwner: string | null;
  renewalRisk: string;
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
  acceptedAt: string | null;
  revokedAt: string | null;
};

type EnterpriseMembership = {
  id: string;
  organisationId: string;
  licenceId: string | null;
  email: string;
  fullName: string | null;
  organisationRole: string;
  status: string;
  onboardingStatus: string;
  consentStatus: string;
  lastActiveAt: string | null;
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
  organisations: {
    title: "Enterprise organisations",
    eyebrow: "Platform Administration",
    description: "Global licensed organisation portfolio. Select an organisation before managing its licence, users, invitations, seats, or audit history.",
  },
  "organisation-detail": {
    title: "Organisation detail",
    eyebrow: "Platform Administration",
    description: "Organisation context, licence position, users, invitations, and audit links for the selected enterprise account.",
  },
  "organisation-users": {
    title: "Organisation users and seats",
    eyebrow: "Platform Administration",
    description: "Scoped users and seat status for the selected organisation.",
  },
  "organisation-invitations": {
    title: "Organisation invitations",
    eyebrow: "Platform Administration",
    description: "Scoped organisation administrator and user invitations.",
  },
  "organisation-licences": {
    title: "Organisation licences",
    eyebrow: "Platform Administration",
    description: "Licences attached to the selected organisation.",
  },
  licences: {
    title: "Enterprise licences",
    eyebrow: "Platform Administration",
    description: "Platform-level licence register linked back to the owning organisation before detail actions.",
  },
  "licence-detail": {
    title: "Licence detail",
    eyebrow: "Platform Administration",
    description: "Licence entitlement, seat usage, renewal state, and linked organisation context.",
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
  const [enterprisePortfolio, setEnterprisePortfolio] = useState<EnterprisePortfolio | null>(null);
  const [enterpriseSearch, setEnterpriseSearch] = useState("");
  const [enterpriseStatusFilter, setEnterpriseStatusFilter] = useState("");
  const [enterpriseTypeFilter, setEnterpriseTypeFilter] = useState("");
  const [enterpriseLicenceFilter, setEnterpriseLicenceFilter] = useState("");
  const [enterprisePlanFilter, setEnterprisePlanFilter] = useState("");
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
  const [adminInviteOpen, setAdminInviteOpen] = useState(false);
  const [adminLifecycleForm, setAdminLifecycleForm] = useState({
    adminUserId: "",
    action: "activate",
    role: "support_agent",
    reason: "",
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
      if (item.key === "enterprise") setEnterprisePortfolio(item.json.portfolio ?? null);
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
    setState("checking");
    setMessage("");
    setAdmin(null);
    setAdmins([]);
    setAdminInvitations([]);
    setMetrics([]);
    setSupport(null);
    setVerificationQueue([]);
    setProbateCases([]);
    setAuditEvents([]);
    setEnterprisePortfolio(null);
    setLookupResults([]);
    await supabase.auth.signOut();
    router.replace("/sign-in");
    router.refresh();
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
    setAdminInviteOpen(false);
    setMessage("Admin invitation sent. The recipient is not active until they accept and satisfy required checks.");
  }

  async function runAdminLifecycle() {
    setMessage("");
    const res = await authFetch("/api/internal/admin/admin-users", {
      method: "PATCH",
      body: JSON.stringify(adminLifecycleForm),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; admins?: AdminUser[]; message?: string; code?: string };
    if (!res.ok || !json.ok) {
      setMessage(json.message || json.code || "Admin lifecycle action was blocked.");
      return;
    }
    setAdmins(json.admins ?? []);
    setAdminLifecycleForm({ adminUserId: "", action: "activate", role: "support_agent", reason: "" });
    setMessage("Admin lifecycle action completed and audit recorded.");
  }

  async function runAdminInvitationLifecycle(invitationId: string, action: "resend_invitation" | "revoke_invitation") {
    const res = await authFetch("/api/internal/admin/admin-users", {
      method: "PATCH",
      body: JSON.stringify({ invitationId, action }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      code?: string;
      admins?: AdminUser[];
      invitations?: AdminInvitation[];
    };
    if (!res.ok || !json.ok) {
      setMessage(json.message || json.code || "Admin invitation lifecycle action failed.");
      return;
    }
    if (json.admins) setAdmins(json.admins);
    if (json.invitations) setAdminInvitations(json.invitations);
    setMessage(action === "revoke_invitation" ? "Admin invitation revoked and audit recorded." : "Admin invitation resent and audit recorded.");
  }

  const visibleNav = useMemo(() => {
    return filterAdminNavigation(PLATFORM_ADMIN_NAVIGATION, capabilities);
  }, [capabilities]);

  const page = PAGE_COPY[section];
  const currentPathname = currentHrefForSection(section, resourceId);
  const enterpriseViews = useMemo(() => {
    return buildEnterpriseViews(enterprisePortfolio, {
      search: enterpriseSearch,
      status: enterpriseStatusFilter,
      type: enterpriseTypeFilter,
      licence: enterpriseLicenceFilter,
      plan: enterprisePlanFilter,
    });
  }, [enterpriseLicenceFilter, enterprisePlanFilter, enterprisePortfolio, enterpriseSearch, enterpriseStatusFilter, enterpriseTypeFilter]);

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
    <AdminWorkspaceShell
      workspaceLabel="Platform Administration"
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
      currentPathname={currentPathname}
      navigation={visibleNav}
      onSignOut={signOut}
      identityLabel={admin?.displayName || admin?.email || "Admin user"}
      identityDetail={admin ? `${admin.role.replace(/_/g, " ")} · ${admin.email}` : undefined}
      breadcrumbs={buildPlatformBreadcrumbs(section, resourceId, enterprisePortfolio, page.title)}
    >
        {message ? <section style={alertStyle}>{message}</section> : null}

        {section === "overview" ? renderOverview(metrics, support, verificationQueue, probateCases) : null}
        {section === "organisations" ? renderPlatformOrganisations(enterpriseViews, {
          search: enterpriseSearch,
          status: enterpriseStatusFilter,
          type: enterpriseTypeFilter,
          licence: enterpriseLicenceFilter,
          plan: enterprisePlanFilter,
        }, {
          setSearch: setEnterpriseSearch,
          setStatus: setEnterpriseStatusFilter,
          setType: setEnterpriseTypeFilter,
          setLicence: setEnterpriseLicenceFilter,
          setPlan: setEnterprisePlanFilter,
          reset: () => {
            setEnterpriseSearch("");
            setEnterpriseStatusFilter("");
            setEnterpriseTypeFilter("");
            setEnterpriseLicenceFilter("");
            setEnterprisePlanFilter("");
          },
        }) : null}
        {section === "organisation-detail" || section === "organisation-users" || section === "organisation-invitations" || section === "organisation-licences" ? renderPlatformOrganisationDetail(section, resourceId, enterprisePortfolio) : null}
        {section === "licences" ? renderPlatformLicences(enterpriseViews) : null}
        {section === "licence-detail" ? renderPlatformLicenceDetail(resourceId, enterprisePortfolio) : null}
        {section === "admin-users" || section === "admin-user-detail" ? renderAdminUsers(admins, adminInvitations, adminFilter, setAdminFilter, adminInviteForm, setAdminInviteForm, sendAdminInvitation, adminInviteOpen, setAdminInviteOpen, adminLifecycleForm, setAdminLifecycleForm, runAdminLifecycle, runAdminInvitationLifecycle, resourceId) : null}
        {section === "users" || section === "user-detail" ? renderUsers(lookupQuery, setLookupQuery, lookupResults, runLookup, resourceId) : null}
        {section === "support" || section === "invitations" || section === "access" ? renderSupport(section, support) : null}
        {section === "verification" || section === "verification-detail" ? renderVerification(verificationQueue, resourceId) : null}
        {section === "probate" || section === "probate-detail" ? renderProbate(probateCases, resourceId) : null}
        {section === "audit" ? renderAudit(auditEvents, auditFilter, setAuditFilter) : null}
        {section === "system-health" ? renderSystemHealth(health, metrics, support) : null}
        {section === "settings" ? renderSettings(capabilities) : null}
    </AdminWorkspaceShell>
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
  if (["organisations", "organisation-detail", "organisation-users", "organisation-invitations", "organisation-licences", "licences", "licence-detail", "overview"].includes(section) && capabilities.includes("organisation:view")) {
    requests.push({ key: "enterprise", url: "/api/internal/admin/enterprise" });
  }
  return requests;
}

function currentHrefForSection(section: AdminControlPlaneSection, resourceId: string | null) {
  if (section === "overview") return "/admin";
  if (section === "organisation-detail") return `/admin/organisations/${resourceId ?? ""}`;
  if (section === "organisation-users") return `/admin/organisations/${resourceId ?? ""}/users`;
  if (section === "organisation-invitations") return `/admin/organisations/${resourceId ?? ""}/invitations`;
  if (section === "organisation-licences") return `/admin/organisations/${resourceId ?? ""}/licences`;
  if (section === "licence-detail") return `/admin/licences/${resourceId ?? ""}`;
  if (section === "admin-user-detail") return `/admin/admin-users/${resourceId ?? ""}`;
  if (section === "user-detail") return `/admin/users/${resourceId ?? ""}`;
  if (section === "verification-detail") return `/admin/verification/${resourceId ?? ""}`;
  if (section === "probate-detail") return `/admin/probate/${resourceId ?? ""}`;
  return `/admin/${section}`;
}

function buildPlatformBreadcrumbs(section: AdminControlPlaneSection, resourceId: string | null, portfolio: EnterprisePortfolio | null, fallbackTitle: string) {
  const crumbs: Array<{ label: string; href?: string }> = [{ label: "Platform Administration", href: "/admin" }];
  if (["organisations", "organisation-detail", "organisation-users", "organisation-invitations", "organisation-licences"].includes(section)) {
    crumbs.push({ label: "Organisations", href: "/admin/organisations" });
    if (resourceId && section !== "organisations") {
      const org = portfolio?.organisations.find((item) => item.id === resourceId);
      crumbs.push({ label: org?.name ?? "Selected organisation", href: `/admin/organisations/${resourceId}` });
    }
    if (section === "organisation-users") crumbs.push({ label: "Users" });
    if (section === "organisation-invitations") crumbs.push({ label: "Invitations" });
    if (section === "organisation-licences") crumbs.push({ label: "Licences" });
    return crumbs;
  }
  if (section === "licences" || section === "licence-detail") {
    crumbs.push({ label: "Licences", href: "/admin/licences" });
    if (resourceId && section === "licence-detail") {
      const licence = portfolio?.licences.find((item) => item.id === resourceId);
      crumbs.push({ label: licence ? licenceLabel(licence) : "Selected licence" });
    }
    return crumbs;
  }
  crumbs.push({ label: fallbackTitle });
  return crumbs;
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

function buildEnterpriseViews(portfolio: EnterprisePortfolio | null, filters: { search: string; status: string; type: string; licence: string; plan: string }) {
  const empty = { organisations: [] as EnterpriseOrganisation[], licences: [] as EnterpriseLicence[] };
  if (!portfolio) return empty;
  const search = filters.search.trim().toLowerCase();
  const organisations = portfolio.organisations.filter((org) => {
    const orgLicences = portfolio.licences.filter((licence) => licence.organisationId === org.id);
    if (search && !`${org.name} ${org.legalName} ${org.registrationNumber ?? ""} ${org.primaryContactEmail ?? ""} ${org.nominatedAdminEmail ?? ""}`.toLowerCase().includes(search)) return false;
    if (filters.status && org.status !== filters.status) return false;
    if (filters.type && org.type !== filters.type) return false;
    if (filters.licence && !orgLicences.some((licence) => licence.status === filters.licence)) return false;
    if (filters.plan && !orgLicences.some((licence) => licence.plan === filters.plan)) return false;
    return true;
  });
  const visibleOrganisationIds = new Set(organisations.map((org) => org.id));
  const licences = portfolio.licences.filter((licence) => {
    const org = portfolio.organisations.find((item) => item.id === licence.organisationId);
    if (!visibleOrganisationIds.has(licence.organisationId)) return false;
    if (search && !`${org?.name ?? ""} ${licence.plan} ${licence.status} ${licence.billingStatus}`.toLowerCase().includes(search)) return false;
    if (filters.licence && licence.status !== filters.licence) return false;
    if (filters.plan && licence.plan !== filters.plan) return false;
    return true;
  });
  return { organisations, licences };
}

function renderPlatformOrganisations(
  views: { organisations: EnterpriseOrganisation[]; licences: EnterpriseLicence[] },
  filters: { search: string; status: string; type: string; licence: string; plan: string },
  actions: {
    setSearch: (value: string) => void;
    setStatus: (value: string) => void;
    setType: (value: string) => void;
    setLicence: (value: string) => void;
    setPlan: (value: string) => void;
    reset: () => void;
  },
) {
  return (
    <div style={stackStyle}>
      <section style={gridStyle} aria-label="Enterprise portfolio metrics">
        <MetricCard label="Organisations" value={String(views.organisations.length)} detail="Visible in Platform Administration" href="/admin/organisations" />
        <MetricCard label="Licences" value={String(views.licences.length)} detail="Linked to listed organisations" href="/admin/licences" />
        <MetricCard label="Purchased seats" value={String(views.licences.reduce((sum, licence) => sum + licence.purchasedSeats, 0))} detail="Across listed licences" />
        <MetricCard label="Active seats" value={String(views.licences.reduce((sum, licence) => sum + licence.activeSeats, 0))} detail="Currently consuming entitlement" />
      </section>
      {renderPlatformFilterToolbar(filters, actions)}
      <section style={panelStyle}>
        <AdminDataTable
          caption="Platform enterprise organisations"
          description={<p style={mutedStyle}>Global organisation register. Select an organisation before managing licence, users, invitations, seats, or activity.</p>}
          columns={[
            { key: "organisation", header: "Organisation", render: (org) => <><Link href={`/admin/organisations/${org.id}`}>{org.name}</Link><small>{org.registrationNumber ?? org.legalName}</small></> },
            { key: "type", header: "Type", render: (org) => labelise(org.type) },
            { key: "status", header: "Status", render: (org) => <AdminStatusBadge status={org.status} /> },
            { key: "licence", header: "Licence", render: (org) => renderOrgLicenceSummary(org, views.licences) },
            { key: "admin", header: "Primary administrator", render: (org) => <>{org.nominatedAdminEmail ?? org.primaryContactEmail ?? "Not assigned"}<small>{org.nominatedAdminName ?? "Manage administrator from detail"}</small></> },
            { key: "risk", header: "Risk", render: (org) => <AdminStatusBadge status={org.risk} /> },
            { key: "actions", header: "Actions", render: (org) => renderOrganisationActions(org, views.licences) },
          ]}
          rows={views.organisations}
          getRowKey={(org) => org.id}
          emptyState={<AdminEmptyState title="No organisations found">No enterprise organisations match the current filters.</AdminEmptyState>}
        />
      </section>
    </div>
  );
}

function renderPlatformFilterToolbar(
  filters: { search: string; status: string; type: string; licence: string; plan: string },
  actions: {
    setSearch: (value: string) => void;
    setStatus: (value: string) => void;
    setType: (value: string) => void;
    setLicence: (value: string) => void;
    setPlan: (value: string) => void;
    reset: () => void;
  },
) {
  return (
    <section style={compactFilterStyle} aria-label="Organisation filters">
      <label style={labelStyle}>Search
        <input value={filters.search} onChange={(event) => actions.setSearch(event.target.value)} placeholder="Organisation, contact or registration" />
      </label>
      <label style={labelStyle}>Status
        <select value={filters.status} onChange={(event) => actions.setStatus(event.target.value)}>
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="pending_setup">Pending setup</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label style={labelStyle}>Organisation type
        <select value={filters.type} onChange={(event) => actions.setType(event.target.value)}>
          <option value="">Any</option>
          <option value="employer">Employer</option>
          <option value="law_firm">Law firm</option>
          <option value="wealth_manager">Wealth manager</option>
          <option value="insurer">Insurer</option>
          <option value="enterprise_reseller">Enterprise reseller</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label style={labelStyle}>Licence status
        <select value={filters.licence} onChange={(event) => actions.setLicence(event.target.value)}>
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </label>
      <label style={labelStyle}>Plan
        <select value={filters.plan} onChange={(event) => actions.setPlan(event.target.value)}>
          <option value="">Any</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <button type="button" style={secondaryButtonStyle} onClick={actions.reset}>Reset</button>
    </section>
  );
}

function renderPlatformOrganisationDetail(section: AdminControlPlaneSection, organisationId: string | null, portfolio: EnterprisePortfolio | null) {
  const org = portfolio?.organisations.find((item) => item.id === organisationId);
  if (!portfolio || !org) {
    return <AdminEmptyState title="Organisation unavailable">The selected organisation was not found or is outside your authorised scope.</AdminEmptyState>;
  }
  const licences = portfolio.licences.filter((licence) => licence.organisationId === org.id);
  const invitations = portfolio.invitations.filter((invitation) => invitation.organisationId === org.id);
  const memberships = portfolio.memberships.filter((membership) => membership.organisationId === org.id);
  const primaryLicence = licences[0] ?? null;
  return (
    <div style={stackStyle}>
      <section style={panelStyle}>
        <Link href="/admin/organisations" style={secondaryLinkStyle}>Back to organisations</Link>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>{org.name}</h2>
            <p style={mutedStyle}>{labelise(org.type)} · {org.primaryContactEmail ?? "No primary contact"} · updated {formatDate(org.updatedAt)}</p>
          </div>
          <div style={actionRowStyle}>
            <AdminStatusBadge status={org.status} />
            <AdminStatusBadge status={org.risk} />
          </div>
        </div>
        <nav aria-label="Organisation sections" style={contextNavStyle}>
          <Link href={`/admin/organisations/${org.id}`}>Overview</Link>
          <Link href={`/admin/organisations/${org.id}/licences`}>Licence</Link>
          <Link href={`/admin/organisations/${org.id}/users`}>Users</Link>
          <Link href={`/admin/organisations/${org.id}/invitations`}>Invitations</Link>
          <Link href={`/admin/audit?resource=organisation:${org.id}`}>Activity</Link>
        </nav>
      </section>
      {section === "organisation-users" ? renderOrganisationMembers(memberships) : null}
      {section === "organisation-invitations" ? renderOrganisationInvitations(invitations) : null}
      {section === "organisation-licences" ? renderScopedLicences(licences, portfolio) : null}
      {section === "organisation-detail" ? (
        <>
          <section style={gridStyle}>
            <MetricCard label="Licence plan" value={primaryLicence ? licenceLabel(primaryLicence) : "None"} detail={primaryLicence ? labelise(primaryLicence.status) : "No active licence configured"} href={primaryLicence ? `/admin/organisations/${org.id}/licences/${primaryLicence.id}` : undefined} />
            <MetricCard label="Purchased seats" value={String(licences.reduce((sum, licence) => sum + licence.purchasedSeats, 0))} detail="Across organisation licences" />
            <MetricCard label="Active seats" value={String(licences.reduce((sum, licence) => sum + licence.activeSeats, 0))} detail="Current seat use" />
            <MetricCard label="Pending invitations" value={String(invitations.filter((item) => ["sent", "scheduled", "delivered"].includes(item.status)).length)} detail="Organisation invitations" href={`/admin/organisations/${org.id}/invitations`} />
          </section>
          <section style={panelStyle}>
            <h2 style={h2Style}>Authorised actions</h2>
            <div style={actionRowStyle}>
              <button type="button" style={secondaryButtonStyle} disabled title="Platform edit form has not yet been promoted from the enterprise detail workflow.">Edit organisation unavailable</button>
              {primaryLicence ? <Link href={`/admin/organisations/${org.id}/licences/${primaryLicence.id}`} style={secondaryLinkStyle}>View licence</Link> : <button type="button" style={secondaryButtonStyle} disabled title="Licence creation remains in Enterprise Operations until the platform create form is promoted.">Add licence unavailable</button>}
              <button type="button" style={secondaryButtonStyle} disabled title="Platform administrator invitation for organisations remains a recorded workflow blocker.">Invite administrator unavailable</button>
              <Link href={`/admin/audit?resource=organisation:${org.id}`} style={secondaryLinkStyle}>View audit history</Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function renderPlatformLicences(views: { organisations: EnterpriseOrganisation[]; licences: EnterpriseLicence[] }) {
  const portfolio = { organisations: views.organisations, licences: views.licences };
  return (
    <section style={panelStyle}>
      <AdminDataTable
        caption="Platform enterprise licences"
        description={<p style={mutedStyle}>Licence register with organisation context preserved. Open a licence only after selecting a record.</p>}
        columns={[
          { key: "organisation", header: "Organisation", render: (licence) => orgLink(licence.organisationId, views.organisations) },
          { key: "plan", header: "Plan", render: (licence) => <><Link href={`/admin/licences/${licence.id}`}>{licenceLabel(licence)}</Link><small>{labelise(licence.billingStatus)}</small></> },
          { key: "status", header: "Status", render: (licence) => <AdminStatusBadge status={licence.status} /> },
          { key: "seats", header: "Seats", render: (licence) => <>{licence.activeSeats}/{licence.purchasedSeats}<small>{licence.availableSeats} available · {licence.invitedSeats} invited</small></> },
          { key: "renewal", header: "Renewal", render: (licence) => <>{formatDate(licence.renewalDate)}<small>{labelise(licence.renewalRisk)}</small></> },
          { key: "actions", header: "Actions", render: (licence) => renderLicenceActions(licence, portfolio) },
        ]}
        rows={views.licences}
        getRowKey={(licence) => licence.id}
        emptyState={<AdminEmptyState title="No licences found">No enterprise licences match the current filters.</AdminEmptyState>}
      />
    </section>
  );
}

function renderPlatformLicenceDetail(licenceId: string | null, portfolio: EnterprisePortfolio | null) {
  const licence = portfolio?.licences.find((item) => item.id === licenceId);
  const org = licence ? portfolio?.organisations.find((item) => item.id === licence.organisationId) : null;
  if (!portfolio || !licence || !org) {
    return <AdminEmptyState title="Licence unavailable">The selected licence was not found or is outside your authorised scope.</AdminEmptyState>;
  }
  const memberships = portfolio.memberships.filter((item) => item.licenceId === licence.id);
  return (
    <div style={stackStyle}>
      <section style={panelStyle}>
        <Link href="/admin/licences" style={secondaryLinkStyle}>Back to licences</Link>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>{licenceLabel(licence)}</h2>
            <p style={mutedStyle}>Linked to <Link href={`/admin/organisations/${org.id}`}>{org.name}</Link> · renewal {formatDate(licence.renewalDate)}</p>
          </div>
          <AdminStatusBadge status={licence.status} />
        </div>
      </section>
      <section style={gridStyle}>
        <MetricCard label="Purchased seats" value={String(licence.purchasedSeats)} detail="Configured entitlement" />
        <MetricCard label="Active seats" value={String(licence.activeSeats)} detail="Current usage" />
        <MetricCard label="Available seats" value={String(licence.availableSeats)} detail={`${licence.invitedSeats} invited or reserved`} />
        <MetricCard label="Billing status" value={labelise(licence.billingStatus)} detail="No private payment details shown" />
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Authorised actions</h2>
        <div style={actionRowStyle}>
          <button type="button" style={secondaryButtonStyle} disabled title="Platform licence edit form has not yet been promoted.">Edit licence unavailable</button>
          <Link href={`/admin/organisations/${org.id}`} style={secondaryLinkStyle}>View organisation</Link>
          <Link href={`/admin/organisations/${org.id}/users`} style={secondaryLinkStyle}>View users consuming seats</Link>
          <Link href={`/admin/audit?resource=licence:${licence.id}`} style={secondaryLinkStyle}>View audit history</Link>
        </div>
        <p style={mutedStyle}>Suspend, cancel, renewal, and seat-allocation changes remain available through the existing authorised licence detail action surface until the platform edit form is promoted.</p>
      </section>
      {renderOrganisationMembers(memberships)}
    </div>
  );
}

function renderOrganisationMembers(memberships: EnterpriseMembership[]) {
  return (
    <section style={panelStyle}>
      <AdminDataTable
        caption="Organisation users and seats"
        columns={[
          { key: "user", header: "User", render: (membership) => <>{membership.fullName ?? membership.email}<small>{membership.email}</small></> },
          { key: "role", header: "Role", render: (membership) => labelise(membership.organisationRole) },
          { key: "status", header: "Status", render: (membership) => <AdminStatusBadge status={membership.status} /> },
          { key: "onboarding", header: "Onboarding", render: (membership) => labelise(membership.onboardingStatus) },
          { key: "consent", header: "Consent", render: (membership) => <AdminStatusBadge status={membership.consentStatus} /> },
        ]}
        rows={memberships}
        getRowKey={(membership) => membership.id}
        emptyState={<AdminEmptyState title="No users found">No users are linked to this organisation in the current scope.</AdminEmptyState>}
      />
    </section>
  );
}

function renderOrganisationInvitations(invitations: EnterpriseInvitation[]) {
  return (
    <section style={panelStyle}>
      <AdminDataTable
        caption="Organisation invitations"
        columns={[
          { key: "recipient", header: "Recipient", render: (invitation) => <>{invitation.fullName ?? invitation.email}<small>{invitation.email}</small></> },
          { key: "type", header: "Type", render: (invitation) => labelise(invitation.invitationType) },
          { key: "role", header: "Role", render: (invitation) => labelise(invitation.roleTemplate) },
          { key: "status", header: "Status", render: (invitation) => <AdminStatusBadge status={invitation.status} /> },
          { key: "expiry", header: "Expiry", render: (invitation) => formatDate(invitation.expiresAt) },
        ]}
        rows={invitations}
        getRowKey={(invitation) => invitation.id}
        emptyState={<AdminEmptyState title="No invitations found">No invitations are linked to this organisation.</AdminEmptyState>}
      />
    </section>
  );
}

function renderScopedLicences(licences: EnterpriseLicence[], portfolio: EnterprisePortfolio) {
  return renderPlatformLicences({ organisations: portfolio.organisations, licences });
}

function renderOrgLicenceSummary(org: EnterpriseOrganisation, licences: EnterpriseLicence[]) {
  const orgLicences = licences.filter((licence) => licence.organisationId === org.id);
  const primary = orgLicences[0];
  if (!primary) return "No licence configured";
  return (
    <>
      <Link href={`/admin/organisations/${org.id}/licences/${primary.id}`}>{licenceLabel(primary)}</Link>
      <small>{primary.activeSeats}/{primary.purchasedSeats} active seats · renews {formatDate(primary.renewalDate)}</small>
    </>
  );
}

function renderOrganisationActions(org: EnterpriseOrganisation, licences: EnterpriseLicence[]) {
  const licence = licences.find((item) => item.organisationId === org.id);
  return (
    <div style={actionsCellStyle}>
      <Link href={`/admin/organisations/${org.id}`}>View organisation</Link>
      {licence ? <Link href={`/admin/organisations/${org.id}/licences/${licence.id}`}>View licence</Link> : <span title="No licence exists for this organisation yet.">No licence</span>}
      <Link href={`/admin/organisations/${org.id}/users`}>Users</Link>
      <Link href={`/admin/organisations/${org.id}/invitations`}>Invitations</Link>
    </div>
  );
}

function renderLicenceActions(licence: EnterpriseLicence, portfolio: { organisations: EnterpriseOrganisation[]; licences: EnterpriseLicence[] }) {
  const org = portfolio.organisations.find((item) => item.id === licence.organisationId);
  return (
    <div style={actionsCellStyle}>
      <Link href={`/admin/licences/${licence.id}`}>View licence</Link>
      {org ? <Link href={`/admin/organisations/${org.id}`}>Organisation</Link> : null}
      {org ? <Link href={`/admin/organisations/${org.id}/users`}>Users and seats</Link> : null}
    </div>
  );
}

function orgLink(organisationId: string, organisations: EnterpriseOrganisation[]) {
  const org = organisations.find((item) => item.id === organisationId);
  if (!org) return "Unknown organisation";
  return <Link href={`/admin/organisations/${org.id}`}>{org.name}</Link>;
}

function licenceLabel(licence: EnterpriseLicence) {
  return licence.plan === "custom" ? licence.customPlanName || "Custom licence" : `${labelise(licence.plan)} licence`;
}

function MetricCard({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </>
  );
  return href ? <Link href={href} style={metricLinkStyle}>{body}</Link> : <div style={metricLinkStyle}>{body}</div>;
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
  inviteOpen: boolean,
  setInviteOpen: (value: boolean) => void,
  lifecycleForm: {
    adminUserId: string;
    action: string;
    role: string;
    reason: string;
  },
  setLifecycleForm: (value: {
    adminUserId: string;
    action: string;
    role: string;
    reason: string;
  }) => void,
  runAdminLifecycle: () => Promise<void>,
  runAdminInvitationLifecycle: (invitationId: string, action: "resend_invitation" | "revoke_invitation") => Promise<void>,
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
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>Administrator access</h2>
            <p style={mutedStyle}>Create invitations and run lifecycle actions from the canonical admin route. Recipients are not active until acceptance and required checks succeed.</p>
          </div>
          <button type="button" onClick={() => setInviteOpen(true)} style={primaryButtonStyle}>Invite administrator</button>
        </div>
        {inviteOpen ? (
          <section style={contextPanelStyle} aria-label="Invite administrator form">
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
            <div style={rowStyle}>
              <button type="button" onClick={() => void sendAdminInvitation()} style={primaryButtonStyle}>Review and send invitation</button>
              <button type="button" onClick={() => setInviteOpen(false)} style={secondaryButtonStyle}>Cancel</button>
            </div>
          </section>
        ) : null}
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Administrator invitations</h2>
        <AdminDataTable
          caption="Administrator invitations"
          columns={[
            {
              key: "recipient",
              header: "Recipient",
              render: (item) => <>{item.full_name || item.email_normalized}<small>{item.email_normalized}</small></>,
            },
            {
              key: "role",
              header: "Role",
              render: (item) => formatRoleLabel(item.role_template, item.role_template === "super_admin"),
            },
            { key: "scope", header: "Scope", render: (item) => item.scope_type.replace(/_/g, " ") },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
            { key: "mfa", header: "MFA", render: (item) => item.require_mfa ? "Required" : "Not required" },
            { key: "expires", header: "Expires", render: (item) => formatDate(item.expires_at) },
            {
              key: "actions",
              header: "Actions",
              render: (item) => (
                <div style={actionsCellStyle}>
                  {["draft", "pending", "sent", "delivered", "failed"].includes(item.status) ? <button type="button" onClick={() => void runAdminInvitationLifecycle(item.id, "resend_invitation")}>Resend</button> : null}
                  {["draft", "pending", "sent", "delivered", "failed"].includes(item.status) ? <button type="button" onClick={() => window.confirm("Revoke this pending administrator invitation? The recipient will not become active and no authentication account is deleted.") && void runAdminInvitationLifecycle(item.id, "revoke_invitation")}>Revoke</button> : null}
                  {["accepted", "revoked", "expired"].includes(item.status) ? <span style={mutedInlineStyle}>No pending action</span> : null}
                </div>
              ),
            },
          ]}
          rows={invitations}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No administrator invitations">No administrator invitations have been created.</AdminEmptyState>}
        />
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
        <AdminDataTable
          caption="Admin users"
          columns={[
            {
              key: "name",
              header: "Name",
              render: (item) => <>{item.display_name || item.email_normalized}<small>{item.email_normalized}{isSyntheticAdmin(item) ? " · Synthetic staging admin" : ""}</small></>,
            },
            { key: "role", header: "Role", render: (item) => formatRoleLabel(item.role, item.is_master) },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
            { key: "created", header: "Created", render: (item) => formatDate(item.created_at) },
            {
              key: "actions",
              header: "Actions",
              render: (item) => (
                <div style={actionsCellStyle}>
                  <Link href={`/admin/admin-users/${item.id}`}>Inspect</Link>
                  <button type="button" onClick={() => setLifecycleForm({ ...lifecycleForm, adminUserId: item.id, action: item.status === "active" ? "deactivate" : "activate" })}>{item.status === "active" ? "Suspend access" : "Reactivate access"}</button>
                  <button type="button" onClick={() => setLifecycleForm({ ...lifecycleForm, adminUserId: item.id, action: "change_role", role: item.role ?? "support_agent" })}>Edit role</button>
                </div>
              ),
            },
          ]}
          rows={filtered}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No matching administrators">No admin users match this filter.</AdminEmptyState>}
        />
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Lifecycle controls</h2>
        <p style={mutedStyle}>Role change, activation, deactivation, final-master protection, self-lockout protection, and audit recording are served by the canonical admin lifecycle API.</p>
        <div style={formGridStyle}>
          <label>Selected administrator
            <select value={lifecycleForm.adminUserId} onChange={(event) => setLifecycleForm({ ...lifecycleForm, adminUserId: event.target.value })}>
              <option value="">Select administrator</option>
              {admins.map((item) => <option key={item.id} value={item.id}>{item.display_name || item.email_normalized}</option>)}
            </select>
          </label>
          <label>Action
            <select value={lifecycleForm.action} onChange={(event) => setLifecycleForm({ ...lifecycleForm, action: event.target.value })}>
              <option value="activate">Reactivate access</option>
              <option value="deactivate">Suspend access</option>
              <option value="change_role">Edit role</option>
            </select>
          </label>
          <label>New role
            <select value={lifecycleForm.role} disabled={lifecycleForm.action !== "change_role"} onChange={(event) => setLifecycleForm({ ...lifecycleForm, role: event.target.value })}>
              <option value="super_admin">Super administrator</option>
              <option value="support_agent">Support agent</option>
              <option value="probate_reviewer">Probate reviewer</option>
              <option value="auditor">Auditor</option>
              <option value="enterprise_admin">Enterprise administrator</option>
            </select>
          </label>
          <label>Reason
            <input value={lifecycleForm.reason} onChange={(event) => setLifecycleForm({ ...lifecycleForm, reason: event.target.value })} />
          </label>
        </div>
        <section style={permissionSummaryStyle}>
          <strong>Consequence</strong>
          <span>{lifecycleForm.action === "deactivate" ? "Suspends platform administrator access only. It does not delete the person’s authentication account or personal vault." : lifecycleForm.action === "change_role" ? "Changes the platform role after server-side final-super-admin and self-lockout checks." : "Restores administrator access if the account is eligible."}</span>
        </section>
        <button type="button" onClick={() => void runAdminLifecycle()} disabled={!lifecycleForm.adminUserId} style={primaryButtonStyle}>Confirm lifecycle action</button>
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
        <label style={fieldStackStyle}>Search users
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
        <AdminDataTable
          caption="Safe lookup results"
          columns={[
            {
              key: "user",
              header: "User",
              render: (item) => <>{item.displayName}<small>{item.email ?? "No email"} · {item.hasProfile ? "Profile present" : "Profile missing"}</small></>,
            },
            {
              key: "plan",
              header: "Plan",
              render: (item) => `${item.commercial.accountPlan.replace(/_/g, " ")} · ${item.commercial.planStatus.replace(/_/g, " ")}`,
            },
            {
              key: "counts",
              header: "Counts",
              render: (item) => `Assets ${item.counts.assets} · Documents ${item.counts.documents} · Contacts ${item.counts.contacts}`,
            },
            { key: "last-sign-in", header: "Last sign-in", render: (item) => formatDate(item.lastSignInAt ?? "") },
          ]}
          rows={results}
          getRowKey={(item) => item.userId}
          emptyState={<AdminEmptyState title="No lookup results">Search to load live customer metadata.</AdminEmptyState>}
        />
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

function labelise(value: string) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
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

const loadingPageStyle = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  background: "#f4f6f8",
  padding: 24,
} satisfies CSSProperties;

const panelStyle = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, display: "grid", gap: 14 } satisfies CSSProperties;
const alertStyle = { ...panelStyle, color: "#991b1b", background: "#fff7ed" } satisfies CSSProperties;
const stackStyle = { display: "grid", gap: 16 } satisfies CSSProperties;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 } satisfies CSSProperties;
const toolbarStyle = { ...panelStyle, display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" } satisfies CSSProperties;
const fieldStackStyle = { display: "grid", gap: 6, minWidth: 0, flex: "1 1 260px" } satisfies CSSProperties;
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
const mutedInlineStyle = { color: "#64748b", fontSize: 13 } satisfies CSSProperties;
const secondaryLinkStyle = { border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", color: "#0f172a", textDecoration: "none", fontWeight: 700, background: "#fff" } satisfies CSSProperties;
const secondaryButtonStyle = { ...secondaryLinkStyle, cursor: "pointer" } satisfies CSSProperties;
const primaryButtonStyle = { border: 0, borderRadius: 6, padding: "10px 14px", color: "#fff", background: "#111827", fontWeight: 800, cursor: "pointer" } satisfies CSSProperties;
const checkboxLineStyle = { display: "flex", gap: 8, alignItems: "center", fontWeight: 700 } satisfies CSSProperties;
const permissionSummaryStyle = { border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, background: "#eff6ff", color: "#1e3a8a", display: "grid", gap: 4 } satisfies CSSProperties;
const sectionHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" } satisfies CSSProperties;
const contextPanelStyle = { border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, display: "grid", gap: 12, background: "#f8fafc" } satisfies CSSProperties;
const actionsCellStyle = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties;
const actionRowStyle = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties;
const compactFilterStyle = { ...panelStyle, display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(4, minmax(150px, 1fr)) auto", gap: 10, alignItems: "end" } satisfies CSSProperties;
const contextNavStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 } satisfies CSSProperties;
const labelStyle = { display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 700 } satisfies CSSProperties;
