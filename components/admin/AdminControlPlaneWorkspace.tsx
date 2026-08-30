"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDataTable, { AdminContextHelp, AdminEmptyState, AdminMetricCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import AdminWorkspaceShell from "@/components/admin/AdminWorkspaceShell";
import InfoTip from "@/components/ui/InfoTip";
import { filterAdminNavigation, PLATFORM_ADMIN_NAVIGATION, PROBATE_REVIEW_NAVIGATION } from "@/components/admin/adminNavigation";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";
import { getSupportNextStep, getSupportOperationalState } from "@/lib/admin/operations";

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
    readyToSendInvitations?: number;
    verificationAwaitingReview: number;
    linkedAccountsActive: number;
    invitationIssues: number;
  };
  issues: Array<{
    invitationId: string;
    ownerUserId?: string;
    ownerName: string;
    contactName: string | null;
    contactEmail: string | null;
    assignedRole: string;
    invitationStatus?: string;
    sentAt?: string | null;
    activationStatus?: string;
    issueLabel: string;
    caseId?: string | null;
    caseStatus?: string | null;
    casePriority?: string | null;
    assignedAdminUserId?: string | null;
  }>;
};

type SupportInvitationDetail = {
  case: {
    id: string;
    invitationId: string;
    status: string;
    priority: string;
    assignedAdminUserId: string | null;
    reasonCode: string | null;
    reasonSummary: string | null;
    resolutionCode: string | null;
    resolvedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    notes: Array<{ id: string; note: string; createdBy: string; createdAt: string }>;
  } | null;
  invitation: {
    id: string;
    ownerUserId: string;
    ownerName: string;
    ownerEmail: string | null;
    contactId: string | null;
    contactName: string;
    contactEmail: string;
    assignedRole: string;
    invitationStatus: string;
    activationStatus: string;
    sentAt: string | null;
    lastSentAt: string | null;
    invitedAt: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    revokedAt: string | null;
    linkedAccountUserId: string | null;
    issueLabel: string;
    availableActions: Array<"resend" | "revoke">;
  };
  contact: {
    id: string;
    fullName: string;
    email: string | null;
    relationship: string | null;
  } | null;
  roleAssignment: {
    id: string;
    assignedRole: string;
    activationStatus: string;
    updatedAt: string | null;
  } | null;
  accessGrant: {
    id: string;
    activationStatus: string;
    updatedAt: string | null;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    payload: Record<string, unknown>;
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
  providerKey?: string;
  purpose?: string;
  documentType?: string | null;
  documentCountry?: string | null;
  livenessStatus?: string | null;
  faceMatchResult?: string | null;
  assignedReviewerUserId?: string | null;
  assignedReviewerName?: string | null;
  manualReviewRequired?: boolean;
  reasonCode?: string | null;
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

type ProbateAction = "request_information" | "review" | "approve" | "reject" | "revoke";

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
    verificationRequests: number;
  };
};

type UserOperationalDetail = LookupUser & {
  profile: {
    displayName: string | null;
    hasProfile: boolean;
  };
  contacts: Array<{
    id: string;
    fullName: string;
    email: string | null;
    relationship: string | null;
    inviteStatus: string | null;
    verificationStatus: string | null;
  }>;
  invitations: Array<{
    id: string;
    contactName: string;
    contactEmail: string | null;
    assignedRole: string;
    invitationStatus: string;
    sentAt: string | null;
    acceptedAt: string | null;
    revokedAt: string | null;
  }>;
  accessGrants: Array<{
    id: string;
    invitationId: string | null;
    activationStatus: string;
    updatedAt: string | null;
  }>;
  verificationRequests: Array<{
    id: string;
    requestType: string;
    requestStatus: string;
    submittedAt: string;
    reviewedAt: string | null;
  }>;
  unavailableActions: Array<{
    action: string;
    reason: string;
  }>;
};

type HealthState = {
  status: "ok" | "warning" | "unavailable" | null;
  generatedAt: string | null;
  deployment: {
    commitSha: string | null;
    buildId: string | null;
    environment: string | null;
  } | null;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "unavailable";
    detail: string;
    count?: number | null;
  }>;
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
  const [supportDetail, setSupportDetail] = useState<SupportInvitationDetail | null>(null);
  const [supportDetailLoading, setSupportDetailLoading] = useState(false);
  const [supportActionLoading, setSupportActionLoading] = useState("");
  const [verificationQueue, setVerificationQueue] = useState<VerificationItem[]>([]);
  const [verificationActionLoading, setVerificationActionLoading] = useState("");
  const [verificationReviewNote, setVerificationReviewNote] = useState("");
  const [probateCases, setProbateCases] = useState<ProbateCase[]>([]);
  const [probateActionLoading, setProbateActionLoading] = useState("");
  const [probateDecisionNotes, setProbateDecisionNotes] = useState<Record<string, string>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [enterprisePortfolio, setEnterprisePortfolio] = useState<EnterprisePortfolio | null>(null);
  const [enterpriseSearch, setEnterpriseSearch] = useState("");
  const [enterpriseStatusFilter, setEnterpriseStatusFilter] = useState("");
  const [enterpriseTypeFilter, setEnterpriseTypeFilter] = useState("");
  const [enterpriseLicenceFilter, setEnterpriseLicenceFilter] = useState("");
  const [enterprisePlanFilter, setEnterprisePlanFilter] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<LookupUser[]>([]);
  const [userDetail, setUserDetail] = useState<UserOperationalDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
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
    status: null,
    generatedAt: null,
    deployment: null,
    checks: [],
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
      const systemHealth = await authFetch("/api/internal/admin/system-health");
      const systemHealthJson = await systemHealth.json().catch(() => ({}));
      setHealth({
        status: systemHealthJson.status ?? (systemHealth.ok ? "ok" : "unavailable"),
        generatedAt: systemHealthJson.generatedAt ?? null,
        deployment: systemHealthJson.deployment ?? null,
        checks: Array.isArray(systemHealthJson.checks) ? systemHealthJson.checks : [],
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
    setSupportDetail(null);
    setVerificationQueue([]);
    setProbateCases([]);
    setProbateDecisionNotes({});
    setAuditEvents([]);
    setEnterprisePortfolio(null);
    setLookupResults([]);
    setUserDetail(null);
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

  const loadUserDetail = useCallback(async (userId: string) => {
    setMessage("");
    setUserDetailLoading(true);
    const res = await authFetch(`/api/internal/admin/users/${encodeURIComponent(userId)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: UserOperationalDetail; message?: string; code?: string };
    setUserDetailLoading(false);
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || json.code || "Could not load user detail.");
      setUserDetail(null);
      return;
    }
    setUserDetail(json.detail);
  }, [authFetch]);

  useEffect(() => {
    if (state !== "ready" || section !== "user-detail" || !resourceId) return;
    const timer = window.setTimeout(() => {
      void loadUserDetail(resourceId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUserDetail, resourceId, section, state]);

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

  async function loadSupportInvitationDetail(invitationId: string) {
    setMessage("");
    setSupportDetailLoading(true);
    const res = await authFetch(`/api/internal/admin/support/${encodeURIComponent(invitationId)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: SupportInvitationDetail; message?: string; code?: string };
    setSupportDetailLoading(false);
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || json.code || "Could not load invitation detail.");
      return;
    }
    setSupportDetail(json.detail);
  }

  async function runSupportInvitationAction(invitationId: string, action: "resend" | "revoke") {
    const confirmed = action === "revoke"
      ? window.confirm("Revoke this contact invitation? The recipient will not gain access from this invitation.")
      : true;
    if (!confirmed) return;
    setMessage("");
    setSupportActionLoading(`${invitationId}:${action}`);
    const res = await authFetch(`/api/internal/admin/support/${encodeURIComponent(invitationId)}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: SupportInvitationDetail; message?: string; code?: string };
    setSupportActionLoading("");
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || json.code || "Support invitation action was blocked.");
      return;
    }
    setSupportDetail(json.detail);
    const supportRes = await authFetch("/api/internal/admin/support");
    const supportJson = (await supportRes.json().catch(() => ({}))) as { ok?: boolean; support?: SupportSnapshot };
    if (supportRes.ok && supportJson.ok) setSupport(supportJson.support ?? null);
    setMessage(action === "revoke" ? "Contact invitation revoked and audit recorded." : "Contact invitation resent and audit recorded.");
  }

  async function createSupportCase(invitationId: string) {
    setSupportActionLoading(`${invitationId}:create_case`);
    const res = await authFetch(`/api/internal/admin/support/${encodeURIComponent(invitationId)}`, { method: "POST", body: JSON.stringify({}) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: SupportInvitationDetail; message?: string; code?: string };
    setSupportActionLoading("");
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || json.code || "Could not open the operations case.");
      return;
    }
    setSupportDetail(json.detail);
    setMessage("Operations case opened and audit recorded.");
  }

  async function runSupportCaseAction(invitationId: string, action: "assign_to_me" | "escalate" | "resolve" | "close" | "reopen") {
    const caseDetail = supportDetail?.case;
    if (!caseDetail) return;
    const resolutionCode = action === "resolve" ? window.prompt("Resolution reason", "Security denial confirmed")?.trim() : undefined;
    if (action === "resolve" && !resolutionCode) return;
    if (action === "close" && !window.confirm("Close this resolved operations case?")) return;
    setSupportActionLoading(`${invitationId}:${action}`);
    const res = await authFetch(`/api/internal/admin/support/${encodeURIComponent(invitationId)}`, { method: "PATCH", body: JSON.stringify({ action, caseId: caseDetail.id, resolutionCode, priority: action === "escalate" ? "high" : undefined }) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: SupportInvitationDetail; message?: string; code?: string };
    setSupportActionLoading("");
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || json.code || "Operations case action was blocked.");
      return;
    }
    setSupportDetail(json.detail);
    setMessage(`Operations case ${action.replace(/_/g, " ")} completed and audit recorded.`);
  }

  async function runVerificationAction(requestId: string, action: "retry" | "assign_to_me" | "add_note") {
    if (action === "add_note" && !verificationReviewNote.trim()) return;
    setVerificationActionLoading(`${requestId}:${action}`);
    const res = await authFetch("/api/internal/admin/verifications", {
      method: "POST",
      body: JSON.stringify({ requestId, action, reviewNotes: action === "add_note" || action === "retry" ? verificationReviewNote.trim() : null }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; queue?: VerificationItem[]; message?: string; capability?: string };
    setVerificationActionLoading("");
    if (!res.ok || !json.ok) {
      setMessage(json.message || json.capability || "Verification action was blocked.");
      return;
    }
    setVerificationQueue(json.queue ?? []);
    if (action === "add_note" || action === "retry") setVerificationReviewNote("");
    setMessage(`Verification ${action.replace(/_/g, " ")} completed and audit recorded.`);
  }

  async function addSupportCaseNote(invitationId: string, note: string) {
    if (!supportDetail?.case || !note.trim()) return;
    setSupportActionLoading(`${invitationId}:add_note`);
    const res = await authFetch(`/api/internal/admin/support/${encodeURIComponent(invitationId)}`, { method: "PATCH", body: JSON.stringify({ action: "add_note", caseId: supportDetail.case.id, note }) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: SupportInvitationDetail; message?: string; code?: string };
    setSupportActionLoading("");
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || json.code || "Support note could not be saved.");
      return;
    }
    setSupportDetail(json.detail);
    setMessage("Support note added.");
  }

  async function runProbateCaseAction(caseId: string, action: ProbateAction) {
    const reason = (probateDecisionNotes[caseId] ?? "").trim();
    if (!reason) {
      setMessage("Decision notes are required before changing a probate case.");
      return;
    }
    const confirmed = ["approve", "reject", "revoke"].includes(action)
      ? window.confirm(`Confirm ${action.replace(/_/g, " ")} for this probate case?`)
      : true;
    if (!confirmed) return;

    setMessage("");
    setProbateActionLoading(`${caseId}:${action}`);
    const res = await authFetch(`/api/internal/admin/probate-cases/${encodeURIComponent(caseId)}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; case?: ProbateCase; message?: string; code?: string };
    setProbateActionLoading("");
    if (!res.ok || !json.ok || !json.case) {
      setMessage(json.message || json.code || "Probate case action was blocked.");
      return;
    }
    setProbateCases((current) => current.map((item) => item.id === json.case?.id ? json.case : item));
    setProbateDecisionNotes((current) => {
      const next = { ...current };
      delete next[caseId];
      return next;
    });
    setMessage(`Probate case ${action.replace(/_/g, " ")} saved and audit recorded.`);
  }

  const visibleNav = useMemo(() => {
    const baseNavigation = section === "probate" || section === "probate-detail" ? PROBATE_REVIEW_NAVIGATION : PLATFORM_ADMIN_NAVIGATION;
    return filterAdminNavigation(baseNavigation, capabilities);
  }, [capabilities, section]);

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
      workspaceLabel={section === "probate" || section === "probate-detail" ? "Platform Probate Review" : "Platform Administration"}
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
        {section === "users" || section === "user-detail" ? renderUsers(lookupQuery, setLookupQuery, lookupResults, runLookup, resourceId, userDetail, userDetailLoading) : null}
        {section === "support" || section === "invitations" || section === "access" ? renderSupport(section, support, supportDetail, supportDetailLoading, supportActionLoading, loadSupportInvitationDetail, runSupportInvitationAction, createSupportCase, runSupportCaseAction, addSupportCaseNote, capabilities) : null}
        {section === "probate" || section === "probate-detail" ? renderProbate(probateCases, resourceId, capabilities, probateDecisionNotes, setProbateDecisionNotes, probateActionLoading, runProbateCaseAction) : null}
        {section === "verification" || section === "verification-detail" ? renderVerification(verificationQueue, resourceId, capabilities, verificationActionLoading, verificationReviewNote, setVerificationReviewNote, runVerificationAction) : null}
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
    { label: "Ready to send", value: support?.counts.readyToSendInvitations ?? null, href: "/admin/invitations?status=ready", source: "saved contact invitations without dispatch" },
    { label: "Verification awaiting review", value: support?.counts.verificationAwaitingReview ?? verification.length, href: "/admin/verification?status=awaiting_review", source: "verification queue" },
    { label: "Probate cases", value: probate.length, href: "/admin/probate", source: "probate cases API" },
    { label: "Access issues", value: support?.counts.invitationIssues ?? null, href: "/admin/access?status=issue", source: "support snapshot" },
  ];
  return (
    <div style={stackStyle}>
      <section style={gridStyle}>
        {cards.map((card) => (
          <AdminMetricCard
            key={card.label}
            label={card.label}
            value={card.value === null ? "Unavailable" : card.value.toLocaleString()}
            detail={`Source: ${card.source}`}
            actionLabel="Open queue"
            href={card.href}
          />
        ))}
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Operational metrics</h2>
        <AdminDataTable
          caption="Operational metrics"
          columns={[
            { key: "metric", header: "Metric", render: (metric) => <>{metric.label}<small>{metric.definition}</small></> },
            { key: "status", header: "Status", render: (metric) => <AdminStatusBadge status={metric.status} /> },
            { key: "value", header: "Value", render: (metric) => metric.available ? metric.value?.toLocaleString() : "Unavailable" },
            { key: "destination", header: "Destination", render: (metric) => <Link href={metricDestination(metric.key)}>Open queue</Link> },
          ]}
          rows={metrics}
          getRowKey={(metric) => metric.key}
          emptyState={<AdminEmptyState title="No metrics">No summary metrics are available.</AdminEmptyState>}
        />
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
        <AdminMetricCard label="Organisations" value={String(views.organisations.length)} detail="Visible in Platform Administration" actionLabel="Open register" href="/admin/organisations" />
        <AdminMetricCard label="Licences" value={String(views.licences.length)} detail="Linked to listed organisations" actionLabel="Open register" href="/admin/licences" />
        <AdminMetricCard label="Purchased seats" value={String(views.licences.reduce((sum, licence) => sum + licence.purchasedSeats, 0))} detail="Across listed licences" />
        <AdminMetricCard label="Active seats" value={String(views.licences.reduce((sum, licence) => sum + licence.activeSeats, 0))} detail="Currently consuming entitlement" />
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
        <AdminContextHelp label="Platform context">You are inspecting an enterprise organisation from Platform Administration. This does not switch you into the enterprise customer workspace.</AdminContextHelp>
      </section>
      {section === "organisation-users" ? renderOrganisationMembers(memberships) : null}
      {section === "organisation-invitations" ? renderOrganisationInvitations(invitations) : null}
      {section === "organisation-licences" ? renderScopedLicences(licences, portfolio) : null}
      {section === "organisation-detail" ? (
        <>
          <section style={gridStyle}>
            <AdminMetricCard label="Licence plan" value={primaryLicence ? licenceLabel(primaryLicence) : "None"} detail={primaryLicence ? labelise(primaryLicence.status) : "No active licence configured"} actionLabel={primaryLicence ? "Open licence" : undefined} href={primaryLicence ? `/admin/organisations/${org.id}/licences/${primaryLicence.id}` : undefined} />
            <AdminMetricCard label="Purchased seats" value={String(licences.reduce((sum, licence) => sum + licence.purchasedSeats, 0))} detail="Across organisation licences" />
            <AdminMetricCard label="Active seats" value={String(licences.reduce((sum, licence) => sum + licence.activeSeats, 0))} detail="Current seat use" />
            <AdminMetricCard label="Pending invitations" value={String(invitations.filter((item) => ["sent", "scheduled", "delivered"].includes(item.status)).length)} detail="Organisation invitations" actionLabel="Open invitations" href={`/admin/organisations/${org.id}/invitations`} />
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
        <AdminMetricCard label="Purchased seats" value={String(licence.purchasedSeats)} detail="Configured entitlement" />
        <AdminMetricCard label="Active seats" value={String(licence.activeSeats)} detail="Current usage" />
        <AdminMetricCard label="Available seats" value={String(licence.availableSeats)} detail={`${licence.invitedSeats} invited or reserved`} />
        <AdminMetricCard label="Billing status" value={labelise(licence.billingStatus)} detail="No private payment details shown" />
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
  if (resourceId) {
    return (
      <div style={stackStyle}>
        <section style={panelStyle}>
          <Link href="/admin/admin-users" style={secondaryLinkStyle}>Back to administrators</Link>
          {selected ? renderAdminDetail(selected) : <AdminEmptyState title="Administrator unavailable">The selected administrator was not found or is outside your authorised scope.</AdminEmptyState>}
        </section>
        {selected ? (
          <section style={panelStyle}>
            <h2 style={h2Style}>Permitted lifecycle actions</h2>
            <p style={mutedStyle}>Lifecycle mutations use the canonical admin-user API and remain subject to self-action, stale-state and last-super-admin safeguards.</p>
            <div style={formGridStyle}>
              <label>Action
                <select value={lifecycleForm.adminUserId === selected.id ? lifecycleForm.action : ""} onChange={(event) => setLifecycleForm({ ...lifecycleForm, adminUserId: selected.id, action: event.target.value })}>
                  <option value="">Select action</option>
                  <option value="activate">Reactivate access</option>
                  <option value="deactivate">Suspend access</option>
                  <option value="change_role">Edit role</option>
                </select>
              </label>
              <label>New role
                <select value={lifecycleForm.role} disabled={lifecycleForm.action !== "change_role" || lifecycleForm.adminUserId !== selected.id} onChange={(event) => setLifecycleForm({ ...lifecycleForm, role: event.target.value })}>
                  <option value="super_admin">Super administrator</option>
                  <option value="support_agent">Support agent</option>
                  <option value="probate_reviewer">Probate reviewer</option>
                  <option value="auditor">Auditor</option>
                  <option value="enterprise_admin">Enterprise administrator</option>
                </select>
              </label>
              <label>Reason
                <input value={lifecycleForm.adminUserId === selected.id ? lifecycleForm.reason : ""} onChange={(event) => setLifecycleForm({ ...lifecycleForm, adminUserId: selected.id, reason: event.target.value })} />
              </label>
            </div>
            <button type="button" onClick={() => void runAdminLifecycle()} disabled={lifecycleForm.adminUserId !== selected.id || !lifecycleForm.action} style={primaryButtonStyle}>Confirm lifecycle action</button>
          </section>
        ) : null}
      </div>
    );
  }
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
    <section style={rowStyle}>
      <h2 style={h2Style}>{item.display_name || item.email_normalized}</h2>
      <dl style={definitionGridStyle}>
        <div><dt>Email</dt><dd>{item.email_normalized}</dd></div>
        <div><dt>Role</dt><dd>{formatRoleLabel(item.role, item.is_master)}</dd></div>
        <div><dt>Status</dt><dd><AdminStatusBadge status={item.status} /></dd></div>
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
  detail: UserOperationalDetail | null,
  detailLoading: boolean,
) {
  return (
    <div style={stackStyle}>
      <section style={toolbarStyle}>
        <label style={fieldStackStyle}>Search users
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email or display name" />
        </label>
        <button type="button" onClick={() => void runLookup()}>Search</button>
      </section>
      {resourceId ? renderUserOperationalDetail(detail, detailLoading, resourceId) : null}
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
            {
              key: "actions",
              header: "Actions",
              render: (item) => <Link href={`/admin/users/${encodeURIComponent(item.userId)}`} prefetch={false}>View</Link>,
            },
          ]}
          rows={results}
          getRowKey={(item) => item.userId}
          emptyState={<AdminEmptyState title="No lookup results">Search to load live customer metadata.</AdminEmptyState>}
        />
      </section>
    </div>
  );
}

function renderUserOperationalDetail(detail: UserOperationalDetail | null, loading: boolean, userId: string) {
  if (loading) {
    return (
      <section style={panelStyle} aria-live="polite">
        <h2 style={h2Style}>Loading user detail</h2>
        <p style={mutedStyle}>Fetching privacy-bounded operational metadata.</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section style={panelStyle}>
        <h2 style={h2Style}>User detail unavailable</h2>
        <p style={mutedStyle}>No safe operational detail is loaded for user `{userId}`. Search for the user or check that the account exists.</p>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={h2Style}>{detail.displayName}</h2>
          <p style={mutedStyle}>{detail.email || "No email recorded"} · created {formatDate(detail.createdAt)} · last sign-in {formatDate(detail.lastSignInAt ?? "")}</p>
        </div>
        <AdminStatusBadge status={detail.commercial.planStatus} />
      </div>
      <p style={mutedStyle}>Privacy-bounded account summary. Secure notes, document contents, storage paths and recovery data are not exposed.</p>
      <div style={gridStyle}>
        <Metric label="Assets" value={detail.counts.assets} />
        <Metric label="Documents" value={detail.counts.documents} />
        <Metric label="Contacts" value={detail.counts.contacts} />
        <Metric label="Invitations" value={detail.counts.invitations} />
        <Metric label="Linked access grants" value={detail.counts.linkedAccessGrants} />
        <Metric label="Verification requests" value={detail.counts.verificationRequests} />
      </div>
      <div style={detailGridStyle}>
        <Detail label="Account plan" value={detail.commercial.accountPlan.replace(/_/g, " ")} />
        <Detail label="Plan status" value={detail.commercial.planStatus.replace(/_/g, " ")} />
        <Detail label="Profile" value={detail.profile.hasProfile ? detail.profile.displayName || "Profile present" : "Profile missing"} />
        <Detail label="Monthly charge" value={`${detail.commercial.billingCurrency} ${detail.commercial.monthlyCharge}`} />
      </div>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Contacts and linked access</h3>
        <AdminDataTable
          caption="User contacts and linked access"
          columns={[
            { key: "contact", header: "Contact", render: (item) => <>{item.fullName}<small>{item.email || "No email"} · {item.relationship || "Relationship not recorded"}</small></> },
            { key: "invite", header: "Invite", render: (item) => <AdminStatusBadge status={item.inviteStatus || "not invited"} /> },
            { key: "verification", header: "Verification", render: (item) => <AdminStatusBadge status={item.verificationStatus || "not started"} /> },
          ]}
          rows={detail.contacts}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No contacts found">No contact records are linked to this account.</AdminEmptyState>}
        />
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Invitations</h3>
        <AdminDataTable
          caption="User invitations"
          columns={[
            { key: "recipient", header: "Recipient", render: (item) => <>{item.contactName}<small>{item.contactEmail || "No email"} · {item.assignedRole.replace(/_/g, " ")}</small></> },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.invitationStatus} /> },
            { key: "sent", header: "Sent", render: (item) => formatDate(item.sentAt) },
            { key: "actions", header: "Actions", render: () => <Link href="/admin/support" prefetch={false}>Open support queue</Link> },
          ]}
          rows={detail.invitations}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No invitations found">No invitations have been created for this account.</AdminEmptyState>}
        />
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Verification requests</h3>
        <AdminDataTable
          caption="User verification requests"
          columns={[
            { key: "type", header: "Type", render: (item) => item.requestType.replace(/_/g, " ") },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.requestStatus} /> },
            { key: "submitted", header: "Submitted", render: (item) => formatDate(item.submittedAt) },
          ]}
          rows={detail.verificationRequests}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No verification requests">No executor or probate verification requests are linked to this account.</AdminEmptyState>}
        />
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Unavailable actions</h3>
        <ul style={eventListStyle}>
          {detail.unavailableActions.map((item) => (
            <li key={item.action}>
              <strong>{item.action}</strong>
              <small>{item.reason}</small>
            </li>
          ))}
        </ul>
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Audit history</h3>
        <p style={mutedStyle}>Use the canonical audit page for filtered event review. This detail page records that it was inspected but does not duplicate audit-history retrieval.</p>
        <Link href="/admin/audit" prefetch={false}>Open audit history</Link>
      </section>
    </section>
  );
}

function renderSupport(
  section: AdminControlPlaneSection,
  support: SupportSnapshot | null,
  detail: SupportInvitationDetail | null,
  detailLoading: boolean,
  actionLoading: string,
  loadDetail: (invitationId: string) => Promise<void>,
  runAction: (invitationId: string, action: "resend" | "revoke") => Promise<void>,
  createCase: (invitationId: string) => Promise<void>,
  runCaseAction: (invitationId: string, action: "assign_to_me" | "escalate" | "resolve" | "close" | "reopen", resolutionCode?: string) => Promise<void>,
  addCaseNote: (invitationId: string, note: string) => Promise<void>,
  capabilities: string[],
) {
  const title = section === "invitations" ? "Invitation issues" : section === "access" ? "Linked-access issues" : "Support issues";
  const canManageSupport = capabilities.includes("support:manage");
  return (
    <div style={stackStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>{title}</h2>
        <div style={gridStyle}>
          <AdminMetricCard label="Pending invitations" value={support?.counts.pendingInvitations ?? "Unavailable"} detail="Contact invitations awaiting recipient action" />
          <AdminMetricCard label="Ready to send" value={support?.counts.readyToSendInvitations ?? "Unavailable"} detail="Saved contact invitations without dispatch" />
          <AdminMetricCard label="Verification awaiting review" value={support?.counts.verificationAwaitingReview ?? "Unavailable"} detail="Executor verification handoffs" />
          <AdminMetricCard label="Active linked accounts" value={support?.counts.linkedAccountsActive ?? "Unavailable"} detail="Accepted linked-access relationships" />
          <AdminMetricCard label="Invitation/access issues" value={support?.counts.invitationIssues ?? "Unavailable"} detail="Operational items requiring follow-up" />
        </div>
        <AdminDataTable
          caption={`${title} table`}
          description={<p style={mutedStyle}>Rows open the live invitation detail panel. Available resend and revoke actions use the canonical support lifecycle API.</p>}
          columns={[
            { key: "contact", header: "Contact", render: (item) => <>{item.contactName || item.contactEmail || "Unknown contact"}<small>{item.contactEmail || "No email recorded"}</small></> },
            { key: "owner", header: "Owner", render: (item) => item.ownerName },
            { key: "role", header: "Role", render: (item) => labelise(item.assignedRole) },
            { key: "status", header: "Access state", render: (item) => <><AdminStatusBadge status={item.activationStatus ?? "invited"} /><small>Invitation: {labelise(item.invitationStatus ?? "unknown")}</small></> },
            { key: "issue", header: "Issue", render: (item) => item.issueLabel },
            { key: "case", header: "Case", render: (item) => <><AdminStatusBadge status={item.caseStatus ?? "not opened"} /><small>{item.casePriority ? `Priority: ${item.casePriority}` : "No operational case"}</small></> },
            { key: "next", header: "Next step", render: (item) => getSupportNextStep(item.invitationStatus ?? "", item.activationStatus ?? "") },
            { key: "actions", header: "Actions", render: (item) => (
              <div style={actionsCellStyle}>
                <button type="button" onClick={() => void loadDetail(item.invitationId)} disabled={detailLoading}>View case</button>
                {getSupportOperationalState(item.invitationStatus ?? "", item.activationStatus ?? "") === "verification_required" ? <Link href="/admin/verification" prefetch={false}>Verification queue</Link> : null}
                {canManageSupport && item.invitationStatus !== "revoked" && item.invitationStatus !== "accepted" ? (
                  <button type="button" onClick={() => void runAction(item.invitationId, "resend")} disabled={actionLoading === `${item.invitationId}:resend`}>
                    {actionLoading === `${item.invitationId}:resend` ? "Sending..." : item.sentAt ? "Resend" : "Send"}
                  </button>
                ) : null}
              </div>
            ) },
          ]}
          rows={support?.issues ?? []}
          getRowKey={(item) => item.invitationId}
          emptyState={support ? <AdminEmptyState title="No support issues">No support issues match this queue.</AdminEmptyState> : <AdminEmptyState title="Support unavailable">Support snapshot is unavailable for this role or environment.</AdminEmptyState>}
        />
      </section>
      {detail || detailLoading ? (
        <section style={panelStyle} aria-live="polite">
          {detailLoading ? <p style={mutedStyle}>Loading invitation detail...</p> : null}
          {detail ? renderSupportInvitationDetail(detail, canManageSupport, actionLoading, runAction, createCase, runCaseAction, addCaseNote) : null}
        </section>
      ) : null}
    </div>
  );
}

function renderSupportInvitationDetail(
  detail: SupportInvitationDetail,
  canManageSupport: boolean,
  actionLoading: string,
  runAction: (invitationId: string, action: "resend" | "revoke") => Promise<void>,
  createCase: (invitationId: string) => Promise<void>,
  runCaseAction: (invitationId: string, action: "assign_to_me" | "escalate" | "resolve" | "close" | "reopen", resolutionCode?: string) => Promise<void>,
  addCaseNote: (invitationId: string, note: string) => Promise<void>,
) {
  const invitation = detail.invitation;
  const operationsCase = detail.case;
  return (
    <div style={stackStyle}>
      <div style={caseHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>Access Operations</p>
          <h2 style={h2Style}>{operationsCase ? `Case ${operationsCase.id.slice(0, 8)}` : "Access issue"}</h2>
          <p style={mutedStyle}>{invitation.contactName || invitation.contactEmail || "Contact invitation"} · {invitation.ownerName}</p>
        </div>
        <div style={actionRowStyle}>
          {operationsCase ? <AdminStatusBadge status={operationsCase.status} /> : <AdminStatusBadge status={invitation.invitationStatus} />}
          {operationsCase ? <AdminStatusBadge status={operationsCase.priority} /> : null}
        </div>
      </div>
      {operationsCase ? <div style={caseActionBarStyle}>
        {canManageSupport && operationsCase.status !== "closed" ? <button type="button" style={secondaryButtonStyle} onClick={() => void runCaseAction(invitation.id, "assign_to_me")} disabled={actionLoading === `${invitation.id}:assign_to_me`}>{actionLoading === `${invitation.id}:assign_to_me` ? "Assigning..." : "Assign to me"}</button> : null}
        {canManageSupport && (operationsCase.status === "open" || operationsCase.status === "needs_attention" || operationsCase.status === "escalated") ? <ResolveCaseDialog loading={actionLoading === `${invitation.id}:resolve`} onResolve={(value) => void runCaseAction(invitation.id, "resolve", value)} /> : null}
        {canManageSupport && operationsCase.status !== "closed" && operationsCase.status !== "escalated" ? <button type="button" style={secondaryButtonStyle} onClick={() => void runCaseAction(invitation.id, "escalate")} disabled={actionLoading === `${invitation.id}:escalate`}>More actions: Escalate</button> : null}
        {canManageSupport && operationsCase.status === "resolved" ? <button type="button" style={secondaryButtonStyle} onClick={() => void runCaseAction(invitation.id, "close")} disabled={actionLoading === `${invitation.id}:close`}>Close case</button> : null}
        {canManageSupport && operationsCase.status === "closed" ? <button type="button" style={secondaryButtonStyle} onClick={() => void runCaseAction(invitation.id, "reopen")} disabled={actionLoading === `${invitation.id}:reopen`}>Reopen case</button> : null}
      </div> : null}
      {!operationsCase ? <section style={emptyCaseStyle}>
        <div><h3 style={h3Style}>No operations case opened</h3><p style={mutedStyle}>Open a support case to assign ownership and record the next step. This does not alter access, verification or invitation security state.</p></div>
        {canManageSupport ? <button type="button" style={primaryButtonStyle} onClick={() => void createCase(invitation.id)} disabled={actionLoading === `${invitation.id}:create_case`}>{actionLoading === `${invitation.id}:create_case` ? "Opening..." : "Open operations case"}</button> : <span style={mutedInlineStyle}>Read-only for this administrator role.</span>}
      </section> : null}
      <div style={twoColumnDetailStyle}>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Security state <InfoTip label="Access state information" tone="security" message="This is the security decision and cannot be manually edited by Platform administrators." /></h3>
        <p style={mutedStyle}>Read only. Support-case actions never grant or remove vault authority.</p>
        <div style={compactDetailGridStyle}>
          <Detail label="Recipient" value={invitation.contactEmail || "No email recorded"} />
          <Detail label="Owner" value={invitation.ownerEmail ? `${invitation.ownerName} (${invitation.ownerEmail})` : invitation.ownerName} />
          <Detail label="Role" value={invitation.assignedRole.replace(/_/g, " ")} />
          <Detail label="Invitation" value={labelise(invitation.invitationStatus)} />
          <Detail label="Access" value={labelise(invitation.activationStatus)} />
          <Detail label="Verification" value={invitation.linkedAccountUserId ? "Linked account" : "Not linked"} />
          <Detail label="Accepted" value={formatDate(invitation.acceptedAt)} />
          <Detail label="Revoked" value={formatDate(invitation.revokedAt)} />
        </div>
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Operations case <InfoTip label="Operations case information" message="This tracks support activity. It does not grant or remove vault authority." /></h3>
        {operationsCase ? <>
          <div style={compactDetailGridStyle}>
            <Detail label="Status" value={labelise(operationsCase.status)} />
            <Detail label="Priority" value={labelise(operationsCase.priority)} />
            <Detail label="Assigned to" value={operationsCase.assignedAdminUserId ? "Assigned administrator" : "Unassigned"} />
            <Detail label="Created" value={formatDate(operationsCase.createdAt)} />
            <Detail label="Updated" value={formatDate(operationsCase.updatedAt)} />
            <Detail label="Resolved" value={formatDate(operationsCase.resolvedAt)} />
            <Detail label="Closed" value={formatDate(operationsCase.closedAt)} />
          </div>
          <p style={mutedStyle}>{operationsCase.resolutionCode ? `Outcome: ${operationsCase.resolutionCode}` : "Choose an outcome after reviewing the issue."}</p>
        </> : <p style={mutedStyle}>Open the case to begin operational follow-up.</p>}
      </section>
      </div>
      {operationsCase ? <section style={contextPanelStyle}>
        <SupportNotes notes={operationsCase.notes} canManage={canManageSupport} loading={actionLoading === `${invitation.id}:add_note`} onSave={(note) => addCaseNote(invitation.id, note)} />
      </section> : null}
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Issue and next step</h3>
        <p><strong>Reason</strong><br />{invitation.issueLabel || "Reason unavailable - review lifecycle events."}</p>
        <p><strong>Operational status</strong><br />{labelise(getSupportOperationalState(invitation.invitationStatus, invitation.activationStatus))}</p>
        <p style={mutedStyle}>{getSupportNextStep(invitation.invitationStatus, invitation.activationStatus)}</p>
        {getSupportOperationalState(invitation.invitationStatus, invitation.activationStatus) === "verification_required" ? <Link href="/admin/verification" prefetch={false}>Open verification review queue</Link> : null}
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Permitted invitation actions</h3>
        <div style={rowStyle}>
          {canManageSupport && invitation.availableActions.includes("resend") ? (
            <button type="button" onClick={() => void runAction(invitation.id, "resend")} disabled={actionLoading === `${invitation.id}:resend`} style={primaryButtonStyle}>
              {actionLoading === `${invitation.id}:resend` ? "Sending..." : invitation.sentAt ? "Resend invitation" : "Send invitation"}
            </button>
          ) : null}
          {canManageSupport && invitation.availableActions.includes("revoke") ? (
            <button type="button" onClick={() => void runAction(invitation.id, "revoke")} disabled={actionLoading === `${invitation.id}:revoke`} style={dangerButtonStyle}>
              {actionLoading === `${invitation.id}:revoke` ? "Revoking..." : "Revoke invitation"}
            </button>
          ) : null}
          {!canManageSupport ? <span style={mutedInlineStyle}>You can inspect this invitation but cannot mutate it.</span> : null}
          {canManageSupport && invitation.availableActions.length === 0 ? <span style={mutedInlineStyle}>This access record is terminal or has no invitation mutation available. Its security history cannot be reopened or manually activated. Use the lifecycle above and the canonical Contacts or verification workflow for the next supported step.</span> : null}
        </div>
      </section>
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Lifecycle events</h3>
        {detail.events.length ? (
          <ul style={eventListStyle}>
            {detail.events.map((event) => (
              <li key={event.id}>
                <strong>{event.eventType.replace(/_/g, " ")}</strong>
                <span>{formatDate(event.createdAt)}</span>
                <small>{formatEventPayload(event.payload)}</small>
              </li>
            ))}
          </ul>
        ) : <p style={mutedStyle}>No invitation events have been recorded.</p>}
      </section>
    </div>
  );
}

function ResolveCaseDialog({ loading, onResolve }: { loading: boolean; onResolve: (resolutionCode: string) => void }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("Security denial confirmed");
  const [note, setNote] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onResolve(note.trim() ? `${outcome}: ${note.trim()}` : outcome);
    setOpen(false);
    setNote("");
  }

  return <>
    <button type="button" style={primaryButtonStyle} onClick={() => setOpen(true)} disabled={loading}>{loading ? "Resolving..." : "Resolve case"}</button>
    {open ? <div style={modalBackdropStyle} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="resolve-case-title" tabIndex={-1} style={modalStyle}>
        <h2 id="resolve-case-title" style={h2Style}>Resolve case</h2>
        <p style={mutedStyle}>Resolving this support case does not change the underlying access decision.</p>
        <form onSubmit={submit} style={formGridStyle}>
          <label style={labelStyle}>Outcome
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option>Security denial confirmed</option>
              <option>Verification completed</option>
              <option>Replacement workflow required</option>
              <option>User no longer requires access</option>
              <option>Duplicate request</option>
            </select>
          </label>
          <label style={labelStyle}>Resolution note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add operational context (optional)" />
          </label>
          <div style={actionRowStyle}><button type="button" style={secondaryButtonStyle} onClick={() => setOpen(false)}>Cancel</button><button type="submit" style={primaryButtonStyle} disabled={loading}>Resolve case</button></div>
        </form>
      </div>
    </div> : null}
  </>;
}

function SupportNotes({ notes, canManage, loading, onSave }: { notes: Array<{ id: string; note: string; createdAt: string }>; canManage: boolean; loading: boolean; onSave: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setNote("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return <>
    <div style={sectionHeaderStyle}><div><h3 style={h3Style}>Notes</h3><p style={mutedStyle}>Compact operational history. Previous notes cannot be edited.</p></div>{canManage ? <button type="button" style={secondaryButtonStyle} onClick={() => setOpen(true)}>Add note</button> : null}</div>
    {open ? <div style={noteComposerStyle} role="dialog" aria-label="Add support note">
      <p style={mutedStyle}>Do not enter Personal Vault contents, financial information, identity-document details or biometric information.</p>
      <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a support note" maxLength={4000} rows={3} aria-label="Support note" />
      <div style={actionRowStyle}><button type="button" style={secondaryButtonStyle} onClick={() => { setOpen(false); setNote(""); }}>Cancel</button><button type="button" style={primaryButtonStyle} onClick={() => { onSave(note.trim()); setOpen(false); setNote(""); }} disabled={!note.trim() || loading}>{loading ? "Saving..." : "Save note"}</button></div>
    </div> : null}
    {notes.length ? <ul style={eventListStyle}>{notes.map((item) => <li key={item.id}><strong>{formatDate(item.createdAt)}</strong><span>Platform administrator</span><small>{item.note}</small></li>)}</ul> : <p style={mutedStyle}>No notes yet.</p>}
  </>;
}

function renderVerification(
  queue: VerificationItem[],
  resourceId: string | null,
  capabilities: string[],
  actionLoading: string,
  reviewNote: string,
  setReviewNote: (value: string) => void,
  runAction: (requestId: string, action: "retry" | "assign_to_me" | "add_note") => Promise<void>,
) {
  const selected = resourceId ? queue.find((item) => item.id === resourceId) : null;
  const canReview = capabilities.includes("verification:review");
  return (
    <div style={stackStyle}>
      {selected ? (
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div><p style={eyebrowStyle}>Platform identity review</p><h2 style={h2Style}>{selected.ownerName}</h2><p style={mutedStyle}>Verification reference {selected.id.slice(0, 8)} · {labelise(selected.purpose ?? selected.requestType)}</p></div>
            <AdminStatusBadge status={selected.requestStatus} />
          </div>
          <p style={mutedStyle}>Status metadata only. Raw identity documents, selfies, biometric templates and unrestricted provider payloads are not available here.</p>
          <div style={compactDetailGridStyle}>
            <Detail label="Subject" value={selected.ownerName} />
            <Detail label="Purpose" value={labelise(selected.purpose ?? selected.requestType)} />
            <Detail label="Provider" value={selected.providerKey ?? "Unavailable"} />
            <Detail label="Document" value={selected.documentType ? labelise(selected.documentType) : "Not processed"} />
            <Detail label="Liveness" value={selected.livenessStatus ? labelise(selected.livenessStatus) : "Not processed"} />
            <Detail label="Review reason" value={selected.reasonCode ? labelise(selected.reasonCode) : "Not recorded"} />
            <Detail label="Assigned reviewer" value={selected.assignedReviewerName ?? "Unassigned"} />
            <Detail label="Started" value={formatDate(selected.submittedAt)} />
          </div>
          {canReview ? <section style={contextPanelStyle}>
            <h3 style={h3Style}>Review actions</h3>
            <p style={mutedStyle}>These actions manage the verification workflow only. They cannot activate access or override identity policy.</p>
            <label style={labelStyle}>Operational note or retry reason
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} placeholder="Do not enter document numbers, vault contents or biometric evidence." />
            </label>
            <div style={rowStyle}>
              {!selected.assignedReviewerUserId ? <button type="button" style={secondaryButtonStyle} onClick={() => void runAction(selected.id, "assign_to_me")} disabled={actionLoading === `${selected.id}:assign_to_me`}>{actionLoading === `${selected.id}:assign_to_me` ? "Assigning..." : "Assign to me"}</button> : null}
              {selected.requestStatus === "failed" || selected.requestStatus === "expired" || selected.requestStatus === "review_required" ? <button type="button" style={secondaryButtonStyle} onClick={() => void runAction(selected.id, "retry")} disabled={!reviewNote.trim() || actionLoading === `${selected.id}:retry`}>{actionLoading === `${selected.id}:retry` ? "Requesting..." : "Request retry"}</button> : null}
              <button type="button" style={secondaryButtonStyle} onClick={() => void runAction(selected.id, "add_note")} disabled={!reviewNote.trim() || actionLoading === `${selected.id}:add_note`}>{actionLoading === `${selected.id}:add_note` ? "Saving..." : "Add review note"}</button>
            </div>
          </section> : null}
        </section>
      ) : null}
      <section style={panelStyle}>
        <h2 style={h2Style}>Verification queue</h2>
        <AdminDataTable
          caption="Verification queue"
          description={<p style={mutedStyle}>Identity verification requests are shown as status metadata only. Raw documents and biometric evidence are excluded.</p>}
          columns={[
            { key: "case", header: "Case", render: (item) => <>{item.ownerName}<small>{item.contactName} · {formatDate(item.submittedAt)}</small></> },
            { key: "role", header: "Role", render: (item) => labelise(item.assignedRole) },
            { key: "status", header: "Status", render: (item) => <><AdminStatusBadge status={item.requestStatus} /><small>{item.manualReviewRequired ? "Review required" : labelise(item.activationStatus)}</small></> },
            { key: "checks", header: "Checks", render: (item) => <><small>Document: {item.documentType ? labelise(item.documentType) : "Pending"}</small><small>Liveness: {item.livenessStatus ? labelise(item.livenessStatus) : "Pending"}</small></> },
            { key: "assigned", header: "Reviewer", render: (item) => item.assignedReviewerName ?? "Unassigned" },
            { key: "detail", header: "Detail", render: (item) => <Link href={`/admin/verification/${item.id}`}>Inspect</Link> },
          ]}
          rows={queue}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No verification requests">No verification requests are waiting.</AdminEmptyState>}
        />
      </section>
    </div>
  );
}

function renderProbate(
  cases: ProbateCase[],
  resourceId: string | null,
  capabilities: string[],
  decisionNotes: Record<string, string>,
  setDecisionNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void,
  actionLoading: string,
  runAction: (caseId: string, action: ProbateAction) => Promise<void>,
) {
  const selected = resourceId ? cases.find((item) => item.id === resourceId) : null;
  const canDecide = capabilities.includes("verification:decide");
  if (resourceId) {
    return (
      <div style={stackStyle}>
        <section style={panelStyle}>
          <Link href="/admin/probate" style={secondaryLinkStyle}>Back to probate queue</Link>
          {selected ? renderProbateDetail(selected, canDecide, decisionNotes, setDecisionNotes, actionLoading, runAction) : <AdminEmptyState title="Probate case unavailable">The selected probate case was not found or is outside your authorised scope.</AdminEmptyState>}
        </section>
      </div>
    );
  }
  return (
    <div style={stackStyle}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Probate queue</h2>
        <AdminDataTable
          caption="Probate review queue"
          description={<p style={mutedStyle}>Open a case before making a terminal decision. Review actions are enforced by the canonical probate case API.</p>}
          columns={[
            { key: "case", header: "Case", render: (item) => <><Link href={`/admin/probate/${item.id}`}>{item.ownerName}</Link><small>{item.contactName} · {formatDate(item.submittedAt)}</small></> },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
            { key: "role", header: "Role", render: (item) => labelise(item.assignedRole) },
            { key: "evidence", header: "Evidence", render: (item) => `${item.evidence.length} file${item.evidence.length === 1 ? "" : "s"}` },
            { key: "next", header: "Next action", render: (item) => getAllowedProbateActions(item.status).terminal ? "Terminal: inspect only" : "Open case to review" },
            { key: "actions", header: "Actions", render: (item) => <Link href={`/admin/probate/${item.id}`}>Review case</Link> },
          ]}
          rows={cases}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState title="No probate cases">No probate cases are available.</AdminEmptyState>}
        />
      </section>
    </div>
  );
}

function renderProbateDetail(
  item: ProbateCase,
  canDecide: boolean,
  decisionNotes: Record<string, string>,
  setDecisionNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void,
  actionLoading: string,
  runAction: (caseId: string, action: ProbateAction) => Promise<void>,
) {
  const actions = getAllowedProbateActions(item.status);
  const notes = decisionNotes[item.id] ?? "";
  const updateNotes = (value: string) => setDecisionNotes((current) => ({ ...current, [item.id]: value }));
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{item.ownerName} / {item.contactName}</h2>
      <dl style={definitionGridStyle}>
        <div><dt>Status</dt><dd><AdminStatusBadge status={item.status} /></dd></div>
        <div><dt>Applicant</dt><dd>{item.contactEmail ?? "No email"}</dd></div>
        <div><dt>Role</dt><dd>{item.assignedRole.replace(/_/g, " ")}</dd></div>
        <div><dt>Evidence count</dt><dd>{item.evidence.length}</dd></div>
      </dl>
      {actions.terminal ? <p style={mutedStyle}>This case is terminal. Approve/reject actions are unavailable; decision history remains inspectable.</p> : null}
      {!actions.terminal ? (
        <section style={contextPanelStyle}>
          <h3 style={h3Style}>Decision controls</h3>
          {canDecide ? (
            <>
              <label style={labelStyle}>Decision notes
                <textarea value={notes} onChange={(event) => updateNotes(event.target.value)} placeholder="Record the operational reason for this probate case action." rows={3} />
              </label>
              <div style={rowStyle}>
                {actions.canReview ? <button type="button" style={secondaryButtonStyle} onClick={() => void runAction(item.id, "review")} disabled={actionLoading === `${item.id}:review`}>{actionLoading === `${item.id}:review` ? "Saving..." : "Mark under review"}</button> : null}
                {actions.canRequestInformation ? <button type="button" style={secondaryButtonStyle} onClick={() => void runAction(item.id, "request_information")} disabled={actionLoading === `${item.id}:request_information`}>{actionLoading === `${item.id}:request_information` ? "Saving..." : "Request information"}</button> : null}
                {actions.canApprove ? <button type="button" style={primaryButtonStyle} onClick={() => void runAction(item.id, "approve")} disabled={actionLoading === `${item.id}:approve`}>{actionLoading === `${item.id}:approve` ? "Approving..." : "Approve"}</button> : null}
                {actions.canReject ? <button type="button" style={dangerButtonStyle} onClick={() => void runAction(item.id, "reject")} disabled={actionLoading === `${item.id}:reject`}>{actionLoading === `${item.id}:reject` ? "Rejecting..." : "Reject"}</button> : null}
              </div>
            </>
          ) : <p style={mutedStyle}>You can inspect this case but do not have permission to change probate state.</p>}
        </section>
      ) : null}
      <h3 style={h3Style}>Evidence metadata</h3>
      <AdminDataTable
        caption="Probate evidence metadata"
        columns={[
          { key: "file", header: "File", render: (evidence) => <>{evidence.fileName}<small>{labelise(evidence.evidenceType)}</small></> },
          { key: "type", header: "MIME type", render: (evidence) => evidence.mimeType },
          { key: "created", header: "Submitted", render: (evidence) => formatDate(evidence.createdAt) },
        ]}
        rows={item.evidence}
        getRowKey={(evidence) => evidence.id}
        emptyState={<AdminEmptyState title="No evidence metadata">No evidence metadata is linked to this case.</AdminEmptyState>}
      />
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
      <AdminDataTable
        caption="Admin audit history"
        description={<p style={mutedStyle}>Read-only audit events. Actor, result, target and route are separated so long labels do not run together.</p>}
        columns={[
          { key: "action", header: "Action", render: (item) => <>{item.action}<small>{labelise(item.category)}</small></> },
          { key: "result", header: "Result", render: (item) => <AdminStatusBadge status={item.result} /> },
          { key: "actor", header: "Actor", render: (item) => <>{item.actorEmail ?? "Unknown"}<small>{item.actorRole ?? "unknown role"}</small></> },
          { key: "target", header: "Target", render: (item) => <>{labelise(item.resourceType)}<small>{item.resourceLabel ?? "No label"}</small></> },
          { key: "route", header: "Route", render: (item) => <code>{item.route}</code> },
          { key: "time", header: "Time", render: (item) => formatDate(item.createdAt) },
        ]}
        rows={filtered}
        getRowKey={(item) => item.id}
        emptyState={<AdminEmptyState title="No audit events">No audit events match this filter.</AdminEmptyState>}
      />
    </section>
  );
}

function renderSystemHealth(health: HealthState, metrics: DashboardMetric[], support: SupportSnapshot | null) {
  const counts = {
    warning: health.checks.filter((check) => check.status === "warning").length,
    unavailable: health.checks.filter((check) => check.status === "unavailable").length,
  };
  return (
    <div style={stackStyle}>
      <section style={gridStyle}>
        <AdminMetricCard label="Subsystem checks" value={health.checks.length ? health.checks.length.toLocaleString() : "Unavailable"} detail={health.status ? `Overall: ${labelise(health.status)}` : "Awaiting health response"} />
        <Metric label="Warnings" value={counts.warning} />
        <Metric label="Unavailable checks" value={counts.unavailable} />
        <Metric label="Support backlog" value={support?.counts.invitationIssues ?? null} />
      </section>
      <section style={panelStyle}>
        <h2 style={h2Style}>Environment</h2>
        <dl style={definitionGridStyle}>
          <div><dt>Build ID</dt><dd>{health.deployment?.buildId ?? "Unavailable"}</dd></div>
          <div><dt>Commit SHA</dt><dd>{health.deployment?.commitSha ?? "Unavailable"}</dd></div>
          <div><dt>Runtime environment</dt><dd>{health.deployment?.environment ?? "Unavailable"}</dd></div>
          <div><dt>Last checked</dt><dd>{formatDate(health.generatedAt)}</dd></div>
          <div><dt>Metric count</dt><dd>{metrics.length}</dd></div>
          <div><dt>Secret exposure</dt><dd>Connection strings, tokens, and passwords are not displayed.</dd></div>
        </dl>
      </section>
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={h2Style}>Subsystem checks</h2>
            <p style={mutedStyle}>Read-only health signals from canonical admin storage and runtime configuration. Counts are aggregate metadata only.</p>
          </div>
        </div>
        <AdminDataTable
          caption="Subsystem checks"
          columns={[
            { key: "subsystem", header: "Subsystem", render: (check) => check.label },
            { key: "status", header: "Status", render: (check) => <AdminStatusBadge status={check.status} /> },
            { key: "count", header: "Count", render: (check) => typeof check.count === "number" ? check.count.toLocaleString() : "Not counted" },
            { key: "detail", header: "Detail", render: (check) => check.detail },
          ]}
          rows={health.checks}
          getRowKey={(check) => check.key}
          emptyState={<AdminEmptyState title="Health unavailable">System health checks are unavailable.</AdminEmptyState>}
        />
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
  return <AdminMetricCard label={label} value={value === null ? "Unavailable" : value.toLocaleString()} detail={suffix || undefined} />;
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailItemStyle}>
      <span style={mutedInlineStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatEventPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 4)
    .map(([key, value]) => `${labelise(key)}: ${String(value)}`);
  return entries.length ? entries.join(" · ") : "No additional metadata";
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
const definitionGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 } satisfies CSSProperties;
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
const dangerButtonStyle = { ...primaryButtonStyle, background: "#991b1b" } satisfies CSSProperties;
const checkboxLineStyle = { display: "flex", gap: 8, alignItems: "center", fontWeight: 700 } satisfies CSSProperties;
const permissionSummaryStyle = { border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, background: "#eff6ff", color: "#1e3a8a", display: "grid", gap: 4 } satisfies CSSProperties;
const sectionHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" } satisfies CSSProperties;
const caseHeaderStyle = { ...sectionHeaderStyle, padding: "4px 0 10px", borderBottom: "1px solid #e2e8f0" } satisfies CSSProperties;
const caseActionBarStyle = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "0 0 4px" } satisfies CSSProperties;
const twoColumnDetailStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 } satisfies CSSProperties;
const compactDetailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 } satisfies CSSProperties;
const emptyCaseStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", border: "1px dashed #94a3b8", borderRadius: 8, padding: 14, background: "#f8fafc" } satisfies CSSProperties;
const noteComposerStyle = { display: "grid", gap: 10, padding: 12, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff" } satisfies CSSProperties;
const modalBackdropStyle = { position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 20, background: "rgba(15, 23, 42, 0.52)" } satisfies CSSProperties;
const modalStyle = { width: "min(100%, 520px)", maxHeight: "calc(100dvh - 40px)", overflowY: "auto", display: "grid", gap: 14, padding: 20, borderRadius: 10, background: "#fff", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)" } satisfies CSSProperties;
const contextPanelStyle = { border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, display: "grid", gap: 12, background: "#f8fafc" } satisfies CSSProperties;
const actionsCellStyle = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties;
const actionRowStyle = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties;
const detailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 } satisfies CSSProperties;
const detailItemStyle = { display: "grid", gap: 4, border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#fff", minWidth: 0 } satisfies CSSProperties;
const eventListStyle = { margin: 0, paddingLeft: 18, display: "grid", gap: 8 } satisfies CSSProperties;
const compactFilterStyle = { ...panelStyle, display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(4, minmax(150px, 1fr)) auto", gap: 10, alignItems: "end" } satisfies CSSProperties;
const contextNavStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 } satisfies CSSProperties;
const labelStyle = { display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 700 } satisfies CSSProperties;
