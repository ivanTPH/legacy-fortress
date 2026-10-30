"use client";

import Link from "next/link";
import BrandMark from "@/components/ui/BrandMark";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDataTable, { AdminContextHelp, AdminEmptyState, AdminFilterChips, AdminMetricCard, AdminNote, AdminStatStrip, AdminStatusBadge, sentenceCaseStatus } from "@/components/admin/AdminPrimitives";
import AdminWorkspaceShell from "@/components/admin/AdminWorkspaceShell";
import InfoTip from "@/components/ui/InfoTip";
import Icon from "@/components/ui/Icon";
import { filterAdminNavigation, PLATFORM_ADMIN_NAVIGATION } from "@/components/admin/adminNavigation";
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

type AdminConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

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
  sentAt?: string | null;
  createdAt?: string;
  failedAt?: string | null;
  failureReason?: string | null;
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
    source?: string;
    mimeType: string;
    sizeBytes?: number;
    reviewStatus?: string;
    createdAt: string;
  }>;
};

type EstateOperations = {
  deathReports: Array<{
    id: string;
    ownerUserId: string;
    claimantUserId: string;
    claimantRole: string;
    status: string;
    dateOfDeath: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    vaultStateAtReport: string;
  }>;
  estateClaims: Array<{
    id: string;
    deathReportId: string | null;
    ownerUserId: string;
    claimantUserId: string;
    roleClaimed: string;
    status: string;
    authorityEvidenceStatus: string;
    approvedAt: string | null;
    suspendedAt: string | null;
    revokedAt: string | null;
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
  organisations: Array<{ id: string; name: string; role: string; status: string }>;
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
    title: "Overview",
    eyebrow: "Platform Admin",
    description: "What needs a decision today. Customer Vault contents and documents are never shown in admin.",
  },
  users: {
    title: "Customer users",
    eyebrow: "Operations",
    description: "Find a customer to help with their account. Record names, values and documents are never shown.",
  },
  "user-detail": {
    title: "Customer user",
    eyebrow: "Operations",
    description: "Account details for support. Record names, values and documents are never shown.",
  },
  "admin-users": {
    title: "Admin users",
    eyebrow: "Oversight",
    description: "Legacy Fortress staff who can sign in to Platform Admin, and what each one can do.",
  },
  "admin-user-detail": {
    title: "Administrator",
    eyebrow: "Oversight",
    description: "Role, status and recent changes for this administrator.",
  },
  invitations: {
    title: "Invitations",
    eyebrow: "Operations",
    description: "Every invitation on the platform: customers inviting trusted people, organisations and administrators.",
  },
  organisations: {
    title: "Organisations",
    eyebrow: "Commercial",
    description: "Partner organisations, their licences and administrators. Members’ Vaults are never shown.",
  },
  "organisation-detail": {
    title: "Organisation",
    eyebrow: "Commercial",
    description: "Licence, seats, people and invitations for this organisation.",
  },
  "organisation-users": {
    title: "Users & seats",
    eyebrow: "Commercial",
    description: "People using this organisation’s seats.",
  },
  "organisation-invitations": {
    title: "Invitations",
    eyebrow: "Commercial",
    description: "Invitations sent by or for this organisation.",
  },
  "organisation-licences": {
    title: "Licences",
    eyebrow: "Commercial",
    description: "Licences held by this organisation.",
  },
  licences: {
    title: "Licences",
    eyebrow: "Commercial",
    description: "Seats each organisation has bought, and when they renew.",
  },
  "licence-detail": {
    title: "Licence",
    eyebrow: "Commercial",
    description: "Seats, renewal and the organisation this licence belongs to.",
  },
  access: {
    title: "Access requests",
    eyebrow: "Operations",
    description: "Requests to see more of someone’s Vault, and executor requests after a death. Admins route cases; Vault owners decide on access.",
  },
  verification: {
    title: "Identity verification",
    eyebrow: "Probate & verification",
    description: "Check people who failed an automatic identity check. Approving confirms who someone is; it doesn’t give them access to anything.",
  },
  "verification-detail": {
    title: "Identity check",
    eyebrow: "Probate & verification",
    description: "Approving confirms who someone is. It never gives access to records.",
  },
  probate: {
    title: "Probate cases",
    eyebrow: "Probate & verification",
    description: "Review death reports and executor authority. Identity, authority, evidence and access are separate decisions, and each one is recorded.",
  },
  "probate-detail": {
    title: "Probate case",
    eyebrow: "Probate & verification",
    description: "Evidence, decisions and the next step for this case.",
  },
  support: {
    title: "Support",
    eyebrow: "Operations",
    description: "Problems with invitations, linked access and identity checks that need someone to follow up.",
  },
  audit: {
    title: "Audit",
    eyebrow: "Oversight",
    description: "Every admin, commercial and probate action in one read-only log.",
  },
  "system-health": {
    title: "System health",
    eyebrow: "Oversight",
    description: "Whether each part of the platform is working. Secrets, tokens and passwords are never displayed.",
  },
  settings: {
    title: "Settings",
    eyebrow: "Oversight",
    description: "How the platform is configured.",
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
  const [estateOperations, setEstateOperations] = useState<EstateOperations | null>(null);
  const [probateActionLoading, setProbateActionLoading] = useState("");
  const [probateEvidenceLoading, setProbateEvidenceLoading] = useState("");
  const [probateDecisionNotes, setProbateDecisionNotes] = useState<Record<string, string>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [enterprisePortfolio, setEnterprisePortfolio] = useState<EnterprisePortfolio | null>(null);
  const [enterpriseInvitationActionLoading, setEnterpriseInvitationActionLoading] = useState("");
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
    expectedUpdatedAt: "",
  });
  const [adminLifecycleActionLoading, setAdminLifecycleActionLoading] = useState(false);
  const [health, setHealth] = useState<HealthState>({
    status: null,
    generatedAt: null,
    deployment: null,
    checks: [],
  });
  const [confirmation, setConfirmation] = useState<AdminConfirmation | null>(null);

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const capabilities = useMemo(() => admin?.capabilities ?? [], [admin?.capabilities]);

  function requestConfirmation(input: Omit<AdminConfirmation, "onConfirm">, onConfirm: AdminConfirmation["onConfirm"]) {
    setConfirmation({ ...input, onConfirm });
  }

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
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage("Sign out could not be completed. Please try again.");
      return;
    }
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
    setEstateOperations(null);
    setProbateDecisionNotes({});
    setAuditEvents([]);
    setEnterprisePortfolio(null);
    setLookupResults([]);
    setUserDetail(null);
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

  async function runAdminLifecycleRequest() {
    setMessage("");
    if (!adminLifecycleForm.adminUserId) {
      setMessage("Select an administrator before confirming a lifecycle action.");
      return;
    }
    if (!adminLifecycleForm.reason.trim()) {
      setMessage("Reason is required before confirming an administrator lifecycle action.");
      return;
    }
    setAdminLifecycleActionLoading(true);
    try {
      const res = await authFetch("/api/internal/admin/admin-users", {
        method: "PATCH",
        body: JSON.stringify(adminLifecycleForm),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; admins?: AdminUser[]; invitations?: AdminInvitation[]; message?: string; code?: string };
      if (!res.ok || !json.ok) {
        setMessage(json.message || json.code || "Admin lifecycle action was blocked.");
        return;
      }
      setAdmins(json.admins ?? []);
      if (json.invitations) setAdminInvitations(json.invitations);
      setAdminLifecycleForm({ adminUserId: "", action: "activate", role: "support_agent", reason: "", expectedUpdatedAt: "" });
      setMessage("Admin lifecycle action completed and audit recorded.");
    } finally {
      setAdminLifecycleActionLoading(false);
    }
  }

  function runAdminLifecycle() {
    const action = adminLifecycleForm.action;
    if (action === "deactivate" || action === "change_role") {
      requestConfirmation({
        title: action === "deactivate" ? "Suspend administrator access" : "Change administrator role",
        message: action === "deactivate"
          ? "This removes platform administrator access without deleting the authentication account or Personal Vault. A reason is required and the action is audited."
          : "This changes platform capabilities for the selected administrator. Confirm the selected role and reason before continuing.",
        confirmLabel: action === "deactivate" ? "Suspend access" : "Change role",
      }, () => runAdminLifecycleRequest());
      return;
    }
    void runAdminLifecycleRequest();
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

  async function runEnterpriseInvitationAction(invitationId: string, action: "resend" | "revoke") {
    if (action === "revoke") {
      requestConfirmation({
        title: "Revoke organisation invitation",
        message: "The invitation will become unusable and any reserved organisation seat will be released by the canonical service.",
        confirmLabel: "Revoke invitation",
      }, () => runEnterpriseInvitationActionConfirmed(invitationId, action));
      return;
    }
    await runEnterpriseInvitationActionConfirmed(invitationId, action);
  }

  async function runEnterpriseInvitationActionConfirmed(invitationId: string, action: "resend" | "revoke") {
    setMessage("");
    setEnterpriseInvitationActionLoading(`${invitationId}:${action}`);
    const res = await authFetch("/api/internal/admin/enterprise", {
      method: "POST",
      body: JSON.stringify({
        action: "update_invitation",
        invitationId,
        status: action === "revoke" ? "revoked" : "sent",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; portfolio?: EnterprisePortfolio; message?: string; capability?: string };
    setEnterpriseInvitationActionLoading("");
    if (!res.ok || !json.ok || !json.portfolio) {
      setMessage(json.message || json.capability || "Organisation invitation action was blocked.");
      return;
    }
    setEnterprisePortfolio(json.portfolio);
    setMessage(action === "revoke" ? "Organisation invitation revoked and audit recorded." : "Organisation invitation marked for resend and audit recorded.");
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
    if (action === "revoke") {
      requestConfirmation({
        title: "Revoke invitation",
        message: "The recipient will not gain access from this invitation after it is revoked.",
        confirmLabel: "Revoke invitation",
      }, () => runSupportInvitationActionConfirmed(invitationId, action));
      return;
    }
    await runSupportInvitationActionConfirmed(invitationId, action);
  }

  async function runSupportInvitationActionConfirmed(invitationId: string, action: "resend" | "revoke") {
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

  async function runSupportCaseAction(invitationId: string, action: "assign_to_me" | "escalate" | "resolve" | "close" | "reopen", resolutionCode?: string) {
    const caseDetail = supportDetail?.case;
    if (!caseDetail) return;
    if (action === "resolve" && !resolutionCode) return;
    if (action === "close") {
      requestConfirmation({
        title: "Close operations case",
        message: "Only close this case after its resolution has been reviewed.",
        confirmLabel: "Close case",
      }, () => runSupportCaseActionConfirmed(invitationId, action, resolutionCode));
      return;
    }
    await runSupportCaseActionConfirmed(invitationId, action, resolutionCode);
  }

  async function runSupportCaseActionConfirmed(invitationId: string, action: "assign_to_me" | "escalate" | "resolve" | "close" | "reopen", resolutionCode?: string) {
    const caseDetail = supportDetail?.case;
    if (!caseDetail) return;
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
    if (["approve", "reject", "revoke"].includes(action)) {
      requestConfirmation({
        title: `Confirm ${action.replace(/_/g, " ")}`,
        message: "This decision is recorded in the probate audit trail and does not override identity verification or access policy.",
        confirmLabel: labelise(action),
      }, () => runProbateCaseActionConfirmed(caseId, action, reason));
      return;
    }
    await runProbateCaseActionConfirmed(caseId, action, reason);
  }

  async function runProbateCaseActionConfirmed(caseId: string, action: ProbateAction, reason: string) {

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

  async function openProbateEvidence(caseId: string, evidenceId: string) {
    setMessage("");
    setProbateEvidenceLoading(`${caseId}:${evidenceId}`);
    try {
      const res = await authFetch(`/api/internal/admin/probate-cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}/signed-url`);
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; signedUrl?: string; message?: string; code?: string };
      if (!res.ok || !json.ok || !json.signedUrl) {
        setMessage(json.message || json.code || "Evidence link could not be created.");
        return;
      }
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      setMessage("Evidence opened with a short-lived case-scoped link and audit recorded.");
    } catch {
      setMessage("Evidence link could not be created.");
    } finally {
      setProbateEvidenceLoading("");
    }
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
      workspaceLabel={section === "probate" || section === "probate-detail" ? "Platform Probate Review" : "Platform Administration"}
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
      currentPathname={currentPathname}
      navigation={visibleNav}
      onSignOut={signOut}
      identityLabel={admin?.displayName || admin?.email || "Admin user"}
      identityDetail={admin ? `${admin.role.replace(/_/g, " ")} · ${admin.email}` : undefined}
      adminRole={admin?.role}
      breadcrumbs={buildPlatformBreadcrumbs(section, resourceId, enterprisePortfolio, page.title)}
      primaryAction={section === "admin-users" ? <button type="button" style={primaryButtonStyle} onClick={() => setAdminInviteOpen(true)}><Icon name="person_add" size={18} /> Invite administrator</button> : undefined}
    >
        {message ? <section style={alertStyle}>{message}</section> : null}
        {confirmation ? <AdminConfirmationDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.onConfirm; setConfirmation(null); void action(); }} /> : null}

        {section === "overview" ? renderOverview(metrics, support, verificationQueue, probateCases, enterprisePortfolio, capabilities) : null}
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
        {section === "admin-users" || section === "admin-user-detail" ? renderAdminUsers(admins, adminInvitations, adminFilter, setAdminFilter, adminInviteForm, setAdminInviteForm, sendAdminInvitation, adminInviteOpen, setAdminInviteOpen, adminLifecycleForm, setAdminLifecycleForm, runAdminLifecycle, runAdminInvitationLifecycle, (input, onConfirm) => requestConfirmation(input, onConfirm), resourceId, adminLifecycleActionLoading) : null}
        {section === "users" || section === "user-detail" ? renderUsers(lookupQuery, setLookupQuery, lookupResults, runLookup, resourceId, userDetail, userDetailLoading) : null}
        {section === "support" || section === "invitations" ? renderSupport(section, support, supportDetail, supportDetailLoading, supportActionLoading, loadSupportInvitationDetail, runSupportInvitationAction, createSupportCase, runSupportCaseAction, addSupportCaseNote, capabilities, enterprisePortfolio, enterpriseInvitationActionLoading, runEnterpriseInvitationAction) : null}
        {section === "verification" || section === "verification-detail" ? renderVerification(verificationQueue, resourceId, capabilities, verificationActionLoading, verificationReviewNote, setVerificationReviewNote, runVerificationAction) : null}
        {section === "access" || section === "probate" || section === "probate-detail" ? renderProbate(probateCases, estateOperations, resourceId, capabilities, probateDecisionNotes, setProbateDecisionNotes, probateActionLoading, probateEvidenceLoading, runProbateCaseAction, openProbateEvidence, section === "access" ? "Access and estate cases" : "Probate queue") : null}
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
  if (["access", "probate", "probate-detail", "overview"].includes(section) && capabilities.includes("verification:read")) {
    requests.push({ key: "estate", url: "/api/internal/admin/estate-cases" });
  }
  if (["audit", "admin-user-detail"].includes(section) && capabilities.includes("audit:read")) {
    requests.push({ key: "audit", url: "/api/internal/admin/audit-history?limit=50" });
  }
  if (["organisations", "organisation-detail", "organisation-users", "organisation-invitations", "organisation-licences", "licences", "licence-detail", "overview", "invitations"].includes(section) && capabilities.includes("organisation:view")) {
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
  const group = PAGE_COPY[section]?.eyebrow ?? "Platform Admin";
  const crumbs: Array<{ label: string; href?: string }> = [{ label: group, href: section === "overview" ? undefined : undefined }];
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

const MEASURE_STATUS_LABEL: Record<string, string> = { ok: "Healthy", warning: "Attention", error: "Problem", unavailable: "Not measured" };

function renderOverview(metrics: DashboardMetric[], support: SupportSnapshot | null, verification: VerificationItem[], probate: ProbateCase[], _portfolio: EnterprisePortfolio | null, capabilities: string[]) {
  const canVerify = capabilities.includes("verification:read");
  const canViewInvitations = capabilities.includes("support:read");
  const pending = support?.counts.verificationAwaitingReview ?? verification.length;
  const decisions = [
    canVerify && pending > 0 ? { icon: "verified_user", label: "Identity checks to review", detail: "Waiting for a reviewer", count: pending, href: "/admin/verification" } : null,
    canVerify && probate.length > 0 ? { icon: "gavel", label: "Probate evidence to review", detail: `${probate.length === 1 ? "1 case" : `${probate.length} cases`} awaiting a decision`, count: probate.length, href: "/admin/probate" } : null,
    canViewInvitations && (support?.counts.readyToSendInvitations ?? 0) > 0 ? { icon: "schedule_send", label: "Invitations saved but not sent", detail: "Customers added people without sending", count: support?.counts.readyToSendInvitations ?? 0, href: "/admin/invitations?status=ready" } : null,
    canViewInvitations && (support?.counts.invitationIssues ?? 0) > 0 ? { icon: "forward_to_inbox", label: "Invitation issues", detail: "Delivery or acceptance problems", count: support?.counts.invitationIssues ?? 0, href: "/admin/access" } : null,
  ].filter((item): item is { icon: string; label: string; detail: string; count: number; href: string } => item !== null);
  return (
    <div style={stackStyle} className="lf-admin-overview">
      <section className="lf-admin-overview-decisions" aria-labelledby="admin-decisions-title">
        <h2 id="admin-decisions-title">Needs a decision</h2>
        {decisions.map((item) => (
          <Link key={item.href} href={item.href} className="lf-admin-decision-row">
            <span className="lf-admin-decision-icon" aria-hidden="true"><Icon name={item.icon} size={20} /></span>
            <span className="lf-admin-decision-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
            <span className="lf-admin-decision-count" aria-label={`${item.count} waiting`}>{item.count}</span>
            <Icon name="chevron_right" size={20} />
          </Link>
        ))}
        {!decisions.length ? <p className="lf-admin-decision-empty">Nothing needs a decision right now.</p> : null}
      </section>
      <section className="lf-admin-overview-measures" aria-labelledby="admin-measures-title">
        <h2 id="admin-measures-title">Across all Vaults</h2>
        <p className="lf-admin-measures-note">Counts only. Customer vault contents and private documents are not shown here.</p>
        <AdminDataTable
          caption="Across all Vaults"
          columns={[
            { key: "metric", header: "Measure", render: (metric) => <Link href={metricDestination(metric.key)} className="lf-admin-measure-link">{metric.label}<small>{metric.definition}</small></Link> },
            { key: "value", header: "Count", render: (metric) => metric.available ? metric.value?.toLocaleString() : "–" },
            { key: "status", header: "Status", render: (metric) => <AdminStatusBadge status={metric.status} label={MEASURE_STATUS_LABEL[String(metric.status).toLowerCase()]} /> },
          ]}
          rows={metrics}
          getRowKey={(metric) => metric.key}
          emptyState={<AdminEmptyState title="No measures">No summary metrics are available for this role.</AdminEmptyState>}
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
            { key: "organisation", header: "Organisation", render: (org) => <div className="lf-v52-organisation-identity"><BrandMark name={org.name} /><span><Link href={`/admin/organisations/${org.id}`}>{org.name}</Link><small>{org.registrationNumber ?? org.legalName}</small></span></div> },
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
    <section className="lf-admin-organisation-filters" style={compactFilterStyle} aria-label="Organisation filters">
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
  return <PlatformLicences views={views} />;
}

const LICENCE_FILTERS: Array<{ key: "all" | "approval" | "active" | "renewing"; label: string; matches: (licence: EnterpriseLicence) => boolean }> = [
  { key: "all", label: "All", matches: () => true },
  { key: "approval", label: "Waiting for approval", matches: (licence) => /pending|draft|approval/i.test(licence.status) },
  { key: "active", label: "Active", matches: (licence) => licence.status === "active" },
  { key: "renewing", label: "Renewing soon", matches: (licence) => /due|soon|high|at_risk/i.test(String(licence.renewalRisk ?? "")) },
];

function PlatformLicences({ views }: { views: { organisations: EnterpriseOrganisation[]; licences: EnterpriseLicence[] } }) {
  const [filter, setFilter] = useState<"all" | "approval" | "active" | "renewing">("all");
  const portfolio = { organisations: views.organisations, licences: views.licences };
  const active = LICENCE_FILTERS.find((option) => option.key === filter) ?? LICENCE_FILTERS[0];
  return (
    <div style={stackStyle}>
      <AdminFilterChips label="Filter licences" value={filter} onChange={setFilter} options={LICENCE_FILTERS.map((option) => ({ key: option.key, label: option.label, count: views.licences.filter(option.matches).length }))} />
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Licences"
          columns={[
            { key: "organisation", header: "Organisation", render: (licence) => orgLink(licence.organisationId, views.organisations) },
            { key: "plan", header: "Plan", render: (licence) => <><Link href={`/admin/licences/${licence.id}`}>{licenceLabel(licence)}</Link><small>{sentenceCaseStatus(licence.billingStatus)}</small></> },
            { key: "seats", header: "Seats", render: (licence) => <>{licence.activeSeats} of {licence.purchasedSeats}<small>{licence.availableSeats} available</small></> },
            { key: "renewal", header: "Renews", render: (licence) => formatDate(licence.renewalDate) },
            { key: "status", header: "Status", render: (licence) => <AdminStatusBadge status={licence.status} /> },
            { key: "actions", header: "", render: (licence) => renderLicenceActions(licence, portfolio) },
          ]}
          rows={views.licences.filter(active.matches)}
          getRowKey={(licence) => licence.id}
          emptyState={<AdminEmptyState icon="workspace_premium" title="No licences here">Licences appear here when an organisation buys seats.</AdminEmptyState>}
        />
      </div>
    </div>
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
    expectedUpdatedAt: string;
  },
  setLifecycleForm: (value: {
    adminUserId: string;
    action: string;
    role: string;
    reason: string;
    expectedUpdatedAt: string;
  }) => void,
  runAdminLifecycle: () => void,
  runAdminInvitationLifecycle: (invitationId: string, action: "resend_invitation" | "revoke_invitation") => Promise<void>,
  requestConfirmation: (input: Omit<AdminConfirmation, "onConfirm">, onConfirm: AdminConfirmation["onConfirm"]) => void,
  resourceId: string | null,
  lifecycleActionLoading: boolean,
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
                <select value={lifecycleForm.adminUserId === selected.id ? lifecycleForm.action : ""} onChange={(event) => setLifecycleForm({ ...lifecycleForm, adminUserId: selected.id, action: event.target.value, role: selected.role ?? lifecycleForm.role, expectedUpdatedAt: selected.updated_at })}>
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
            <section style={permissionSummaryStyle}>
              <strong>Stale-update protection</strong>
              <span>This action will only apply if the administrator row still matches the currently loaded version from {formatDate(selected.updated_at)}.</span>
            </section>
            <button type="button" onClick={() => void runAdminLifecycle()} disabled={lifecycleActionLoading || lifecycleForm.adminUserId !== selected.id || !lifecycleForm.action || !lifecycleForm.reason.trim()} style={primaryButtonStyle}>{lifecycleActionLoading ? "Applying..." : "Confirm lifecycle action"}</button>
          </section>
        ) : null}
      </div>
    );
  }
  const adminFilters: Array<{ key: "real-active" | "inactive" | "synthetic" | "all"; label: string; count: number }> = [
    { key: "real-active", label: "Active", count: admins.filter((item) => !isSyntheticAdmin(item) && item.status === "active").length },
    { key: "inactive", label: "Suspended", count: admins.filter((item) => item.status !== "active").length },
    { key: "synthetic", label: "Test accounts", count: admins.filter(isSyntheticAdmin).length },
    { key: "all", label: "All", count: admins.length },
  ];
  return (
    <div style={stackStyle}>
      <AdminNote icon="shield_person">You can’t remove the last master admin or suspend your own account. Every role change needs a reason.</AdminNote>
      {inviteOpen ? (
        <section className="lf-admin-table-card lf-admin-form-card" aria-label="Invite administrator form">
          <h2>Invite administrator</h2>
          <div style={formGridStyle}>
            <label>Email address
              <input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} required />
            </label>
            <label>Full name (optional)
              <input value={inviteForm.fullName} onChange={(event) => setInviteForm({ ...inviteForm, fullName: event.target.value })} />
            </label>
            <label>Role
              <select value={inviteForm.roleTemplate} onChange={(event) => setInviteForm({ ...inviteForm, roleTemplate: event.target.value })}>
                <option value="super_admin">Super administrator</option>
                <option value="support_agent">Support agent</option>
                <option value="probate_reviewer">Probate reviewer</option>
                <option value="auditor">Auditor</option>
                <option value="enterprise_admin">Enterprise administrator</option>
                <option value="read_only_operations">Read-only operations user</option>
              </select>
            </label>
            <label>What they can reach
              <select value={inviteForm.scopeType} onChange={(event) => setInviteForm({ ...inviteForm, scopeType: event.target.value })}>
                <option value="platform">Whole platform</option>
                <option value="organisation">One organisation</option>
                <option value="support_only">Support only</option>
                <option value="probate_only">Probate only</option>
                <option value="read_only">Read-only</option>
                <option value="time_limited">For a limited time</option>
              </select>
            </label>
            <label>Invitation lasts (days)
              <input type="number" min={1} max={90} value={inviteForm.expiryDays} onChange={(event) => setInviteForm({ ...inviteForm, expiryDays: Number(event.target.value) })} />
            </label>
            <label style={checkboxLineStyle}>
              <input type="checkbox" checked={inviteForm.requireMfa} onChange={(event) => setInviteForm({ ...inviteForm, requireMfa: event.target.checked })} />
              Require two-step verification
            </label>
          </div>
          <AdminNote><strong>Permission summary.</strong> {permissionSummaryForRole(inviteForm.roleTemplate)}</AdminNote>
          <div style={actionRowStyle}>
            <button type="button" onClick={() => void sendAdminInvitation()} style={primaryButtonStyle}>Review and send invitation</button>
            <button type="button" onClick={() => setInviteOpen(false)} className="lf-admin-row-button">Cancel</button>
          </div>
        </section>
      ) : null}
      <AdminFilterChips label="Filter administrators" value={filter as "real-active" | "inactive" | "synthetic" | "all"} onChange={setFilter} options={adminFilters} />
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Admin users"
          columns={[
            { key: "name", header: "Name", render: (item) => <><span className="lf-admin-cell-title">{item.display_name || item.email_normalized}</span><small>{item.email_normalized}{isSyntheticAdmin(item) ? " · Synthetic staging admin" : ""}</small></> },
            { key: "role", header: "Role", render: (item) => formatRoleLabel(item.role, item.is_master) },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
            { key: "created", header: "Added", render: (item) => formatDate(item.created_at) },
            { key: "open", header: "", render: (item) => <Link className="lf-admin-row-chevron" href={`/admin/admin-users/${item.id}`} aria-label={`Open ${item.display_name || item.email_normalized}`}><Icon name="chevron_right" size={20} /></Link> },
          ]}
          rows={filtered}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState icon="admin_panel_settings" title="No administrators here">No administrators match this filter.</AdminEmptyState>}
        />
      </div>
      <div className="lf-admin-table-card">
        <h2>Administrator invitations</h2>
        <AdminDataTable
          caption="Administrator invitations"
          columns={[
            { key: "recipient", header: "Recipient", render: (item) => <><span className="lf-admin-cell-title">{item.full_name || item.email_normalized}</span><small>{item.email_normalized}</small></> },
            { key: "role", header: "Role", render: (item) => formatRoleLabel(item.role_template, item.role_template === "super_admin") },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
            { key: "mfa", header: "Two-step verification", render: (item) => item.require_mfa ? "Required" : "Not required" },
            { key: "expires", header: "Expires", render: (item) => formatDate(item.expires_at) },
            { key: "actions", header: "", render: (item) => ["draft", "pending", "sent", "delivered", "failed"].includes(item.status) ? (
              <div style={actionsCellStyle}>
                <button type="button" className="lf-admin-row-button" onClick={() => void runAdminInvitationLifecycle(item.id, "resend_invitation")}>Resend</button>
                <button type="button" className="lf-admin-row-button" onClick={() => requestConfirmation({ title: "Revoke admin invitation", message: "The recipient will not become active and no authentication account will be deleted.", confirmLabel: "Revoke invitation" }, () => runAdminInvitationLifecycle(item.id, "revoke_invitation"))}>Revoke</button>
              </div>
            ) : null },
          ]}
          rows={invitations}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState icon="forward_to_inbox" title="No administrator invitations">Invitations you send appear here until they’re accepted.</AdminEmptyState>}
        />
      </div>
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
      <form className="lf-admin-toolbar" role="search" onSubmit={(event) => { event.preventDefault(); void runLookup(); }}>
        <label className="lf-admin-search"><Icon name="search" size={18} /><span className="lf-visually-hidden">Search customers</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by email or name" />
        </label>
        <button type="submit" className="lf-admin-row-button">Search</button>
      </form>
      {resourceId ? renderUserOperationalDetail(detail, detailLoading, resourceId) : null}
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Customer users"
          columns={[
            { key: "user", header: "Customer", render: (item) => <><span className="lf-admin-cell-title">{item.displayName}</span><small>{item.email ?? "No email"}</small></> },
            { key: "organisations", header: "Organisation", render: (item) => item.organisations.length ? <>{item.organisations.map((organisation) => <Link key={organisation.id} href={`/admin/organisations/${organisation.id}`} prefetch={false}>{organisation.name}</Link>)}</> : "Personal" },
            { key: "last-sign-in", header: "Last sign-in", render: (item) => item.lastSignInAt ? formatDate(item.lastSignInAt) : "Never" },
            { key: "plan", header: "Plan", render: (item) => <AdminStatusBadge status={item.commercial.planStatus} label={sentenceCaseStatus(item.commercial.accountPlan)} /> },
            { key: "open", header: "", render: (item) => <Link className="lf-admin-row-chevron" href={`/admin/users/${encodeURIComponent(item.userId)}`} prefetch={false} aria-label={`Open ${item.displayName}`}><Icon name="chevron_right" size={20} /></Link> },
          ]}
          rows={results}
          getRowKey={(item) => item.userId}
          emptyState={<AdminEmptyState icon="person_search" title="Search for a customer">Enter an email address or name. Results show account details only.</AdminEmptyState>}
        />
      </div>
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
        <h3 style={h3Style}>Organisation context</h3>
        <p style={mutedStyle}>Membership context is operational metadata only. Opening an organisation remains inside Platform Administration.</p>
        {detail.organisations.length ? <div style={eventListStyle}>{detail.organisations.map((organisation) => <div key={organisation.id}><Link href={`/admin/organisations/${organisation.id}`} prefetch={false}>{organisation.name}</Link><small>{labelise(organisation.role)} · {labelise(organisation.status)}</small></div>)}</div> : <AdminEmptyState title="No organisation membership">This user is not linked to an enterprise organisation.</AdminEmptyState>}
      </section>
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
  enterprisePortfolio: EnterprisePortfolio | null,
  enterpriseInvitationActionLoading: string,
  runEnterpriseInvitationAction: (invitationId: string, action: "resend" | "revoke") => Promise<void>,
) {
  const title = section === "invitations" ? "Invitation issues" : section === "access" ? "Linked-access issues" : "Support issues";
  const canManageSupport = capabilities.includes("support:manage");
  const counts = support?.counts;
  const statItems = section === "invitations"
    ? [
      { label: "Waiting for recipient", value: counts?.pendingInvitations ?? "–" },
      { label: "Saved, not sent", value: counts?.readyToSendInvitations ?? "–" },
      { label: "Organisation invitations", value: enterprisePortfolio?.invitations.length ?? "–" },
      { label: "Need follow-up", value: counts?.invitationIssues ?? "–" },
    ]
    : [
      { label: "Invitation problems", value: counts?.invitationIssues ?? "–" },
      { label: "Saved, not sent", value: counts?.readyToSendInvitations ?? "–" },
      { label: "Verification hand-offs", value: counts?.verificationAwaitingReview ?? "–" },
      { label: "Active linked accounts", value: counts?.linkedAccountsActive ?? "–" },
    ];
  return (
    <div style={stackStyle}>
      <AdminStatStrip label={title} items={statItems} />
      <div className="lf-admin-table-card">
        {section === "invitations" ? <h2>Trusted people</h2> : null}
        <AdminDataTable
          caption={`${title} table`}
          columns={[
            { key: "contact", header: "Person", render: (item) => <><span className="lf-admin-cell-title">{item.contactName || item.contactEmail || "Unknown person"}</span><small>{item.contactEmail || "No email recorded"} · {labelise(item.assignedRole)}</small></> },
            { key: "owner", header: "Vault owner", render: (item) => item.ownerName },
            { key: "issue", header: "Problem", render: (item) => <>{item.issueLabel}<small>{getSupportNextStep(item.invitationStatus ?? "", item.activationStatus ?? "")}</small></> },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.invitationStatus ?? item.activationStatus ?? "invited"} /> },
            { key: "actions", header: "", render: (item) => (
              <div style={actionsCellStyle}>
                {canManageSupport && item.invitationStatus !== "revoked" && item.invitationStatus !== "accepted" ? (
                  <button type="button" className="lf-admin-row-button" onClick={() => void runAction(item.invitationId, "resend")} disabled={actionLoading === `${item.invitationId}:resend`}>
                    {actionLoading === `${item.invitationId}:resend` ? "Sending…" : item.sentAt ? "Resend" : "Send"}
                  </button>
                ) : null}
                <button type="button" className="lf-admin-row-chevron" onClick={() => void loadDetail(item.invitationId)} disabled={detailLoading} aria-label={`Open case for ${item.contactName || item.contactEmail || "this person"}`}><Icon name="chevron_right" size={20} /></button>
              </div>
            ) },
          ]}
          rows={support?.issues ?? []}
          getRowKey={(item) => item.invitationId}
          emptyState={support ? <AdminEmptyState icon={section === "invitations" ? "forward_to_inbox" : "support_agent"} title={section === "invitations" ? "No invitation problems" : "No support issues"}>Each issue appears here with a suggested next step, such as resending an invitation or restarting an identity check.</AdminEmptyState> : <AdminEmptyState title="Support unavailable">Support isn’t available for your role.</AdminEmptyState>}
        />
      </div>
      {section === "invitations" ? renderPlatformInvitationRegister(enterprisePortfolio, capabilities, enterpriseInvitationActionLoading, runEnterpriseInvitationAction) : null}
      {detail || detailLoading ? (
        <section style={panelStyle} aria-live="polite">
          {detailLoading ? <p style={mutedStyle}>Loading invitation…</p> : null}
          {detail ? renderSupportInvitationDetail(detail, canManageSupport, actionLoading, runAction, createCase, runCaseAction, addCaseNote) : null}
        </section>
      ) : null}
    </div>
  );
}

function renderPlatformInvitationRegister(
  portfolio: EnterprisePortfolio | null,
  capabilities: string[],
  actionLoading: string,
  runAction: (invitationId: string, action: "resend" | "revoke") => Promise<void>,
) {
  const invitations = portfolio?.invitations ?? [];
  const organisations = portfolio?.organisations ?? [];
  const canManage = capabilities.includes("enterprise.invitation.manage");
  return (
    <div className="lf-admin-table-card" aria-labelledby="platform-invitation-register-title">
      <h2 id="platform-invitation-register-title">Organisations and administrators</h2>
      <p className="lf-admin-table-card-note">Invitation links and identity evidence are never shown.</p>
      <AdminDataTable
        caption="Organisation invitations"
        columns={[
          { key: "recipient", header: "Recipient", render: (item) => <><span className="lf-admin-cell-title">{item.fullName || item.email}</span><small>{item.email}</small></> },
          { key: "type", header: "Type", render: (item) => sentenceCaseStatus(item.roleTemplate) },
          { key: "organisation", header: "Organisation", render: (item) => { const organisation = organisations.find((candidate) => candidate.id === item.organisationId); return organisation ? <Link href={`/admin/organisations/${organisation.id}`} prefetch={false}>{organisation.name}</Link> : "–"; } },
          { key: "status", header: "Status", render: (item) => <><AdminStatusBadge status={item.status} />{item.acceptedAt ? <small>Accepted {formatDate(item.acceptedAt)}</small> : item.sentAt ? <small>Sent {formatDate(item.sentAt)}</small> : null}</> },
          { key: "created", header: "Created", render: (item) => formatDate(item.createdAt ?? "") },
          { key: "actions", header: "", render: (item) => {
            const terminal = ["accepted", "expired", "revoked"].includes(item.status);
            if (!canManage || terminal) return null;
            return (
              <div style={actionsCellStyle}>
                <button type="button" className="lf-admin-row-button" aria-label={`Resend invitation to ${item.email}`} onClick={() => void runAction(item.id, "resend")} disabled={actionLoading === `${item.id}:resend`}>
                  {actionLoading === `${item.id}:resend` ? "Sending…" : "Resend"}
                </button>
                <button type="button" className="lf-admin-row-button" aria-label={`Revoke invitation for ${item.email}`} onClick={() => void runAction(item.id, "revoke")} disabled={actionLoading === `${item.id}:revoke`}>
                  {actionLoading === `${item.id}:revoke` ? "Revoking…" : "Revoke"}
                </button>
              </div>
            );
          } },
        ]}
        rows={invitations}
        getRowKey={(item) => item.id}
        emptyState={<AdminEmptyState icon="forward_to_inbox" title="No organisation invitations">Invitations to organisation admins and team members appear here.</AdminEmptyState>}
      />
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

function AdminConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: AdminConfirmation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div style={modalBackdropStyle} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="admin-confirmation-title" tabIndex={-1} style={modalStyle}>
        <h2 id="admin-confirmation-title" style={h2Style}>{confirmation.title}</h2>
        <p style={mutedStyle}>{confirmation.message}</p>
        <div style={actionRowStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={onCancel}>Cancel</button>
          <button type="button" style={confirmation.confirmLabel.toLowerCase().includes("revoke") ? dangerButtonStyle : primaryButtonStyle} onClick={onConfirm}>{confirmation.confirmLabel}</button>
        </div>
      </div>
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
            <Detail label="Face match" value={selected.faceMatchResult ? labelise(selected.faceMatchResult) : "Not processed"} />
            <Detail label="Review reason" value={selected.reasonCode ? labelise(selected.reasonCode) : "Not recorded"} />
            <Detail label="Assigned reviewer" value={selected.assignedReviewerName ?? "Unassigned"} />
            <Detail label="Started" value={formatDate(selected.submittedAt)} />
          </div>
          <p className="lf-admin-verification-boundary"><Icon name="lock" size={20} />Approving identity confirms who someone is. It never gives access to records.</p>
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
      {resourceId && !selected ? <AdminEmptyState title="Case unavailable">This case is not available to your role.</AdminEmptyState> : null}
      {!resourceId ? <section className="lf-admin-verification-queue">
        <VerificationMobileQueue queue={queue} />
        <VerificationDesktopQueue queue={queue} />
      </section> : null}
    </div>
  );
}

const VERIFICATION_FILTERS: Array<{ key: "review" | "waiting" | "verified" | "all"; label: string; matches: (item: VerificationItem) => boolean }> = [
  { key: "review", label: "Needs review", matches: (item) => item.manualReviewRequired || item.requestStatus === "review_required" },
  { key: "waiting", label: "Waiting on claimant", matches: (item) => ["pending", "requires_input", "retry_requested", "document_required", "camera_required"].includes(item.requestStatus) },
  { key: "verified", label: "Verified", matches: (item) => item.requestStatus === "verified" },
  { key: "all", label: "All", matches: () => true },
];

function verificationChecks(item: VerificationItem) {
  const parts = [item.documentType ? labelise(item.documentType) : "Document not checked", item.livenessStatus ? `liveness ${labelise(item.livenessStatus).toLowerCase()}` : null, item.faceMatchResult ? labelise(item.faceMatchResult).toLowerCase() : null].filter(Boolean);
  return parts.join(" · ");
}

function VerificationDesktopQueue({ queue }: { queue: VerificationItem[] }) {
  const [filter, setFilter] = useState<"review" | "waiting" | "verified" | "all">("review");
  const active = VERIFICATION_FILTERS.find((option) => option.key === filter) ?? VERIFICATION_FILTERS[0];
  const rows = queue.filter(active.matches);
  return (
    <div className="lf-admin-verification-desktop" style={stackStyle}>
      <AdminFilterChips label="Filter identity checks" value={filter} onChange={setFilter} options={VERIFICATION_FILTERS.map((option) => ({ key: option.key, label: option.label, count: queue.filter(option.matches).length }))} />
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Identity verification queue"
          columns={[
            { key: "claimant", header: "Claimant", render: (item) => <><span className="lf-admin-cell-title">{item.ownerName || <code>{item.id.slice(0, 8)}</code>}</span><small>{formatDate(item.submittedAt)}</small></> },
            { key: "type", header: "Linked to", render: (item) => labelise(item.purpose ?? item.requestType) },
            { key: "checks", header: "Checks", render: (item) => verificationChecks(item) },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.requestStatus} /> },
            { key: "assigned", header: "Reviewer", render: (item) => item.assignedReviewerName ?? "Unassigned" },
            { key: "detail", header: "", render: (item) => item.manualReviewRequired || item.requestStatus === "review_required"
              ? <Link className="lf-admin-row-button" href={`/admin/verification/${item.id}`}>Review</Link>
              : <Link className="lf-admin-row-chevron" href={`/admin/verification/${item.id}`} aria-label={`Open check for ${item.ownerName}`}><Icon name="chevron_right" size={20} /></Link> },
          ]}
          rows={rows}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState icon="verified_user" title="Nothing to review">Identity checks that need a person to look at them appear here.</AdminEmptyState>}
        />
      </div>
    </div>
  );
}

function VerificationMobileQueue({ queue }: { queue: VerificationItem[] }) {
  const [filter, setFilter] = useState("all");
  const filters = [
    { key: "all", label: "All", matches: () => true },
    { key: "review", label: "Needs review", matches: (item: VerificationItem) => item.manualReviewRequired || item.requestStatus === "review_required" },
    { key: "progress", label: "In review", matches: (item: VerificationItem) => Boolean(item.assignedReviewerUserId) && item.requestStatus !== "review_required" },
    { key: "waiting", label: "Waiting", matches: (item: VerificationItem) => ["pending", "requires_input", "retry_requested"].includes(item.requestStatus) },
  ];
  const visible = queue.filter(filters.find((option) => option.key === filter)?.matches ?? filters[0].matches);
  return <div className="lf-admin-verification-mobile">
    <div className="lf-admin-verification-filters" aria-label="Filter verification requests">{filters.map((option) => <button key={option.key} type="button" onClick={() => setFilter(option.key)} aria-pressed={filter === option.key}>{option.label} {queue.filter(option.matches).length}</button>)}</div>
    <div className="lf-admin-verification-list">{visible.length ? visible.map((item) => <Link key={item.id} href={`/admin/verification/${item.id}`} className="lf-admin-verification-row">
      <span><strong><code>{item.id.slice(0, 8)}</code></strong> <small>{labelise(item.purpose ?? item.requestType)}</small></span>
      <span>{item.manualReviewRequired ? "Manual review required" : labelise(item.requestStatus)}</span>
      <span><AdminStatusBadge status={item.requestStatus} /> <small>{item.assignedReviewerName ?? "Unassigned"} · {formatDate(item.submittedAt)}</small></span>
      <Icon name="chevron_right" size={20} />
    </Link>) : <p>No requests match this filter.</p>}</div>
  </div>;
}

function renderProbate(
  cases: ProbateCase[],
  estate: EstateOperations | null,
  resourceId: string | null,
  capabilities: string[],
  decisionNotes: Record<string, string>,
  setDecisionNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void,
  actionLoading: string,
  evidenceLoading: string,
  runAction: (caseId: string, action: ProbateAction) => Promise<void>,
  openEvidence: (caseId: string, evidenceId: string) => Promise<void>,
  heading = "Probate queue",
) {
  const selected = resourceId ? cases.find((item) => item.id === resourceId) : null;
  const canDecide = capabilities.includes("verification:decide");
  if (resourceId) {
    return (
      <div style={stackStyle}>
        <section style={panelStyle}>
          <Link href="/admin/probate" style={secondaryLinkStyle}>Back to probate queue</Link>
          {selected ? renderProbateDetail(selected, canDecide, decisionNotes, setDecisionNotes, actionLoading, evidenceLoading, runAction, openEvidence) : <AdminEmptyState title="Case unavailable">The selected case was not found or is outside your authorised scope.</AdminEmptyState>}
        </section>
      </div>
    );
  }
  return <ProbateQueue cases={cases} estate={estate} />;
}

const PROBATE_FILTERS: Array<{ key: "review" | "waiting" | "closed"; label: string; matches: (item: ProbateCase) => boolean }> = [
  { key: "review", label: "Needs review", matches: (item) => !getAllowedProbateActions(item.status).terminal && !/waiting|requested_more|awaiting_executor/i.test(item.status) },
  { key: "waiting", label: "Waiting on executor", matches: (item) => /waiting|requested_more|awaiting_executor/i.test(item.status) },
  { key: "closed", label: "Closed", matches: (item) => getAllowedProbateActions(item.status).terminal },
];

function ProbateQueue({ cases, estate }: { cases: ProbateCase[]; estate: EstateOperations | null }) {
  const [filter, setFilter] = useState<"review" | "waiting" | "closed">("review");
  const active = PROBATE_FILTERS.find((option) => option.key === filter) ?? PROBATE_FILTERS[0];
  const rows = cases.filter(active.matches);
  return (
    <div style={stackStyle}>
      <AdminFilterChips label="Filter probate cases" value={filter} onChange={setFilter} options={PROBATE_FILTERS.map((option) => ({ key: option.key, label: option.label, count: cases.filter(option.matches).length }))} />
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Probate review queue"
          columns={[
            { key: "case", header: "Case", render: (item) => <><Link className="lf-admin-cell-title" href={`/admin/probate/${item.id}`}>{item.ownerName}</Link><small>Case {item.id.slice(0, 8)}</small></> },
            { key: "reporter", header: "Reported by", render: (item) => <>{item.contactName}<small>{labelise(item.assignedRole)}</small></> },
            { key: "evidence", header: "Evidence", render: (item) => `${item.evidence.length} file${item.evidence.length === 1 ? "" : "s"}` },
            { key: "status", header: "Stage", render: (item) => <AdminStatusBadge status={item.status} /> },
            { key: "updated", header: "Updated", render: (item) => formatDate(item.submittedAt) },
            { key: "actions", header: "", render: (item) => getAllowedProbateActions(item.status).terminal
              ? <Link className="lf-admin-row-chevron" href={`/admin/probate/${item.id}`} aria-label={`Open case for ${item.ownerName}`}><Icon name="chevron_right" size={20} /></Link>
              : <Link className="lf-admin-row-button" href={`/admin/probate/${item.id}`}>Review</Link> },
          ]}
          rows={rows}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState icon="gavel" title="No cases here">Death reports and executor requests appear here when someone starts the process.</AdminEmptyState>}
        />
      </div>
      {estate ? renderEstateOperations(estate) : null}
    </div>
  );
}

function renderEstateOperations(estate: EstateOperations) {
  return (
    <section style={panelStyle} aria-labelledby="estate-operations-title">
      <h2 id="estate-operations-title" style={h2Style}>Death and estate-state queue</h2>
      <p style={mutedStyle}>Death reports and estate claims are operational signals only. A report, certificate, or verified identity does not establish authority or activate access.</p>
      <AdminDataTable
        caption="Death report operations"
        columns={[
          { key: "report", header: "Report", render: (item) => <><code>{item.id.slice(0, 8)}</code><small>Owner {item.ownerUserId.slice(0, 8)}</small></> },
          { key: "status", header: "Report status", render: (item) => <AdminStatusBadge status={item.status} /> },
          { key: "estate", header: "Estate state", render: (item) => <AdminStatusBadge status={item.vaultStateAtReport} /> },
          { key: "evidence", header: "Evidence / next action", render: (item) => item.status === "submitted" || item.status === "under_review" ? "Review evidence and consider protective lock" : item.status === "protective_lock_applied" ? "Review evidence before confirming death" : "No automatic authority or access" },
        ]}
        rows={estate.deathReports}
        getRowKey={(item) => item.id}
        emptyState={<AdminEmptyState title="No death reports">No death reports are recorded.</AdminEmptyState>}
      />
      <AdminDataTable
        caption="Estate authority claims"
        columns={[
          { key: "claim", header: "Claim", render: (item) => <><code>{item.id.slice(0, 8)}</code><small>Owner {item.ownerUserId.slice(0, 8)}</small></> },
          { key: "role", header: "Role", render: (item) => labelise(item.roleClaimed) },
          { key: "authority", header: "Authority", render: (item) => <AdminStatusBadge status={item.status} /> },
          { key: "evidence", header: "Evidence", render: (item) => labelise(item.authorityEvidenceStatus) },
          { key: "access", header: "Access", render: (item) => item.status === "active" ? "Policy-gated active claim" : "Unavailable / pending" },
        ]}
        rows={estate.estateClaims}
        getRowKey={(item) => item.id}
        emptyState={<AdminEmptyState title="No estate claims">No estate authority claims are recorded.</AdminEmptyState>}
      />
    </section>
  );
}

function renderProbateDetail(
  item: ProbateCase,
  canDecide: boolean,
  decisionNotes: Record<string, string>,
  setDecisionNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void,
  actionLoading: string,
  evidenceLoading: string,
  runAction: (caseId: string, action: ProbateAction) => Promise<void>,
  openEvidence: (caseId: string, evidenceId: string) => Promise<void>,
) {
  const actions = getAllowedProbateActions(item.status);
  const notes = decisionNotes[item.id] ?? "";
  const updateNotes = (value: string) => setDecisionNotes((current) => ({ ...current, [item.id]: value }));
  const history = buildProbateHistory(item);
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{item.ownerName} / {item.contactName}</h2>
      <dl style={definitionGridStyle}>
        <div><dt>Status</dt><dd><AdminStatusBadge status={item.status} /></dd></div>
        <div><dt>Applicant</dt><dd>{item.contactEmail ?? "No email"}</dd></div>
        <div><dt>Role</dt><dd>{item.assignedRole.replace(/_/g, " ")}</dd></div>
        <div><dt>Evidence count</dt><dd>{item.evidence.length}</dd></div>
        <div><dt>Case type</dt><dd>{labelise(item.caseType)}</dd></div>
        <div><dt>Applicant message</dt><dd>{item.applicantStatusMessage || "Not available"}</dd></div>
      </dl>
      {actions.terminal ? (
        <section style={contextPanelStyle}>
          <h3 style={h3Style}>Terminal state</h3>
          <p style={mutedStyle}>This case is {labelise(item.status)}. Terminal approve/reject actions are unavailable; evidence and history remain inspectable.</p>
          {actions.canRevoke && canDecide ? (
            <>
              <label style={labelStyle}>Revocation notes
                <textarea value={notes} onChange={(event) => updateNotes(event.target.value)} placeholder="Record the operational reason before revoking access." rows={3} />
              </label>
              <button type="button" style={dangerButtonStyle} onClick={() => void runAction(item.id, "revoke")} disabled={actionLoading === `${item.id}:revoke`}>
                {actionLoading === `${item.id}:revoke` ? "Revoking..." : "Revoke access"}
              </button>
            </>
          ) : null}
        </section>
      ) : null}
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
      <h3 style={h3Style}>Evidence review</h3>
      <AdminDataTable
        caption="Probate evidence review"
        description={<p style={mutedStyle}>Open files through audited, short-lived signed links. Evidence remains case-scoped and is never exposed as a public bucket URL.</p>}
        columns={[
          { key: "file", header: "File", render: (evidence) => <>{evidence.fileName}<small>{labelise(evidence.evidenceType)}</small></> },
          { key: "status", header: "Review status", render: (evidence) => <AdminStatusBadge status={evidence.reviewStatus ?? "submitted"} /> },
          { key: "type", header: "Type", render: (evidence) => <>{evidence.mimeType}<small>{formatFileSize(evidence.sizeBytes ?? 0)}</small></> },
          { key: "created", header: "Submitted", render: (evidence) => formatDate(evidence.createdAt) },
          {
            key: "open",
            header: "Action",
            render: (evidence) => canDecide ? (
              <button type="button" style={secondaryButtonStyle} onClick={() => void openEvidence(item.id, evidence.id)} disabled={evidenceLoading === `${item.id}:${evidence.id}`}>
                {evidenceLoading === `${item.id}:${evidence.id}` ? "Opening..." : "Open evidence"}
              </button>
            ) : <span style={mutedInlineStyle}>Review permission required</span>,
          },
        ]}
        rows={item.evidence}
        getRowKey={(evidence) => evidence.id}
        emptyState={<AdminEmptyState title="No evidence metadata">No evidence metadata is linked to this case.</AdminEmptyState>}
      />
      <section style={contextPanelStyle}>
        <h3 style={h3Style}>Case history</h3>
        <ol style={eventListStyle}>
          {history.map((entry) => (
            <li key={entry.key}>
              <strong>{entry.label}</strong>
              <span>{entry.detail}</span>
              <small>{formatDate(entry.at)}</small>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function renderAudit(events: AuditEvent[], filter: string, setFilter: (value: string) => void) {
  return <AuditLog events={events} filter={filter} setFilter={setFilter} />;
}

const AUDIT_SOURCES: Array<{ key: "all" | "admin" | "commercial" | "probate" | "failed"; label: string; matches: (item: AuditEvent) => boolean }> = [
  { key: "all", label: "All sources", matches: () => true },
  { key: "admin", label: "Admin", matches: (item) => /admin|security|support|system/i.test(item.category) },
  { key: "commercial", label: "Commercial", matches: (item) => /enterprise|commercial|organisation|licence/i.test(item.category) },
  { key: "probate", label: "Probate", matches: (item) => /probate|verification|estate/i.test(item.category) },
  { key: "failed", label: "Failed only", matches: (item) => !/success|allowed|ok/i.test(item.result) },
];

function AuditLog({ events, filter, setFilter }: { events: AuditEvent[]; filter: string; setFilter: (value: string) => void }) {
  const [source, setSource] = useState<"all" | "admin" | "commercial" | "probate" | "failed">("all");
  const normalized = filter.trim().toLowerCase();
  const sourceFilter = AUDIT_SOURCES.find((option) => option.key === source) ?? AUDIT_SOURCES[0];
  const filtered = events
    .filter(sourceFilter.matches)
    .filter((item) => !normalized || JSON.stringify(item).toLowerCase().includes(normalized));
  return (
    <div style={stackStyle}>
      <div className="lf-admin-toolbar">
        <label className="lf-admin-search"><Icon name="search" size={18} /><span className="lf-visually-hidden">Search audit</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search person, action or target" />
        </label>
        <AdminFilterChips label="Filter audit by source" value={source} onChange={setSource} options={AUDIT_SOURCES.map((option) => ({ key: option.key, label: option.label }))} />
      </div>
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Audit"
          columns={[
            { key: "action", header: "Event", render: (item) => <><span className="lf-admin-cell-title">{sentenceCaseStatus(item.action)}</span><small>{sentenceCaseStatus(item.category)}</small></> },
            { key: "result", header: "Result", render: (item) => <AdminStatusBadge status={item.result} /> },
            { key: "actor", header: "Who", render: (item) => <>{item.actorEmail ?? "Unknown"}<small>{item.actorRole ? sentenceCaseStatus(item.actorRole) : "–"}</small></> },
            { key: "target", header: "Target", render: (item) => <>{sentenceCaseStatus(item.resourceType)}<small>{item.resourceLabel ?? ""}</small></> },
            { key: "time", header: "Time", render: (item) => formatDate(item.createdAt) },
          ]}
          rows={filtered}
          getRowKey={(item) => item.id}
          emptyState={<AdminEmptyState icon="receipt_long" title="No audit events">No events match this search.</AdminEmptyState>}
        />
      </div>
    </div>
  );
}

function renderSystemHealth(health: HealthState, metrics: DashboardMetric[], support: SupportSnapshot | null) {
  const counts = {
    warning: health.checks.filter((check) => check.status === "warning").length,
    unavailable: health.checks.filter((check) => check.status === "unavailable").length,
  };
  return (
    <div style={stackStyle}>
      <AdminStatStrip label="System health summary" items={[
        { label: "Checks", value: health.checks.length || "–" },
        { label: "Warnings", value: counts.warning },
        { label: "Unavailable", value: counts.unavailable },
        { label: "Support backlog", value: support?.counts.invitationIssues ?? "–" },
      ]} />
      <section className="lf-admin-table-card" aria-labelledby="admin-environment-title">
        <h2 id="admin-environment-title">Environment</h2>
        <dl className="lf-admin-environment">
          <div><dt>Build</dt><dd><code>{health.deployment?.buildId ?? "–"}</code></dd></div>
          <div><dt>Commit</dt><dd><code>{health.deployment?.commitSha ?? "–"}</code></dd></div>
          <div><dt>Environment</dt><dd>{health.deployment?.environment ? sentenceCaseStatus(health.deployment.environment) : "–"}</dd></div>
          <div><dt>Last checked</dt><dd>{formatDate(health.generatedAt)}</dd></div>
        </dl>
      </section>
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Parts of the platform"
          columns={[
            { key: "subsystem", header: "Part of the platform", render: (check) => <span className="lf-admin-cell-title">{check.label}</span> },
            { key: "status", header: "Status", render: (check) => <AdminStatusBadge status={check.status} label={MEASURE_STATUS_LABEL[check.status]} /> },
            { key: "count", header: "Records", render: (check) => typeof check.count === "number" ? check.count.toLocaleString() : "–" },
            { key: "detail", header: "What it covers", render: (check) => check.detail },
          ]}
          rows={health.checks}
          getRowKey={(check) => check.key}
          emptyState={<AdminEmptyState icon="monitor_heart" title="Health unavailable">Health checks didn’t respond. Try again shortly.</AdminEmptyState>}
        />
      </div>
      <p className="lf-visually-hidden">{metrics.length} summary measures loaded.</p>
    </div>
  );
}

function renderSettings(capabilities: string[]) {
  const settings = [
    ["General", "Environment name and how the admin console looks"],
    ["Security", "Role changes, protecting the last master admin, reasons for changes"],
    ["Invitations", "How long invitations last, resending and cancelling"],
    ["Identity verification", "Rules reviewers follow when approving or rejecting"],
    ["Probate", "Which case decisions are allowed at each stage"],
    ["Documents", "Evidence opens through secure, time-limited links only"],
    ["Audit & retention", "How long audit history is kept; it can’t be edited"],
  ];
  return (
    <div style={stackStyle}>
      {/* This page intentionally avoids a generic key/value editor. */}
      <AdminNote icon="lock">Settings are read-only until each one has its own change screen with confirmation, a reason and an audit entry.</AdminNote>
      <div className="lf-admin-table-card">
        <AdminDataTable
          caption="Platform settings"
          columns={[
            { key: "area", header: "Area", render: (row) => <span className="lf-admin-cell-title">{row[0]}</span> },
            { key: "controls", header: "What it controls", render: (row) => row[1] },
            { key: "status", header: "Status", render: () => <span className="lf-admin-status-badge neutral"><Icon name="lock" size={14} />Read-only</span> },
          ]}
          rows={settings}
          getRowKey={(row) => row[0]}
          emptyState={null}
        />
      </div>
      <p className="lf-visually-hidden">Your role has {capabilities.length} permissions.</p>
    </div>
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

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size not recorded";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildProbateHistory(item: ProbateCase) {
  const history = [
    {
      key: "submitted",
      label: "Case submitted",
      detail: `${item.contactName} submitted ${labelise(item.caseType)} evidence for ${item.ownerName}.`,
      at: item.submittedAt,
    },
  ];
  if (item.evidence.length) {
    history.push({
      key: "evidence",
      label: "Evidence attached",
      detail: `${item.evidence.length} evidence file${item.evidence.length === 1 ? "" : "s"} available for review.`,
      at: item.evidence[0]?.createdAt ?? item.submittedAt,
    });
  }
  if (item.decisionReason || item.decidedAt) {
    history.push({
      key: "decision",
      label: `Case ${labelise(item.status)}`,
      detail: item.decisionReason || item.applicantStatusMessage || "Decision recorded.",
      at: item.decidedAt ?? item.submittedAt,
    });
  }
  return history;
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
  background: "var(--lf-surface-page)",
  padding: 24,
} satisfies CSSProperties;

const panelStyle = { background: "var(--lf-surface-card)", border: "1px solid var(--lf-border)", borderRadius: 12, padding: 20, display: "grid", gap: 14 } satisfies CSSProperties;
const alertStyle = { ...panelStyle, color: "var(--lf-status-rejected-text)", background: "var(--lf-status-pending-bg)" } satisfies CSSProperties;
const stackStyle = { display: "grid", gap: 16 } satisfies CSSProperties;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 154px), 1fr))", gap: 12 } satisfies CSSProperties;
const toolbarStyle = { ...panelStyle, display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" } satisfies CSSProperties;
const fieldStackStyle = { display: "grid", gap: 6, minWidth: 0, flex: "1 1 260px" } satisfies CSSProperties;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 12 } satisfies CSSProperties;
const definitionGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 } satisfies CSSProperties;
const settingsCardStyle = { ...panelStyle, gap: 8 } satisfies CSSProperties;
const rowStyle = { border: "1px solid var(--lf-border)", borderRadius: 10, padding: 12, display: "grid", gap: 4 } satisfies CSSProperties;
const eyebrowStyle = { margin: 0, color: "var(--lf-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, fontWeight: 800 } satisfies CSSProperties;
const h1Style = { margin: 0, fontSize: 28, lineHeight: 1.15 } satisfies CSSProperties;
const h2Style = { margin: 0, fontSize: 20 } satisfies CSSProperties;
const h3Style = { margin: 0, fontSize: 16 } satisfies CSSProperties;
const mutedStyle = { margin: 0, color: "var(--lf-text-secondary)", lineHeight: 1.45 } satisfies CSSProperties;
const mutedInlineStyle = { color: "var(--lf-text-secondary)", fontSize: 13 } satisfies CSSProperties;
const secondaryLinkStyle = { border: "1px solid var(--lf-border-input)", borderRadius: 8, padding: "10px 13px", color: "var(--lf-text)", textDecoration: "none", fontWeight: 700, background: "var(--lf-surface-card)", minHeight: 44 } satisfies CSSProperties;
const secondaryButtonStyle = { ...secondaryLinkStyle, cursor: "pointer" } satisfies CSSProperties;
const primaryButtonStyle = { border: 0, borderRadius: 8, padding: "10px 14px", color: "var(--lf-primary-text)", background: "var(--lf-primary-bg)", fontWeight: 700, cursor: "pointer", minHeight: 44 } satisfies CSSProperties;
const dangerButtonStyle = { ...primaryButtonStyle, background: "var(--lf-destructive)" } satisfies CSSProperties;
const checkboxLineStyle = { display: "flex", gap: 8, alignItems: "center", fontWeight: 700 } satisfies CSSProperties;
const permissionSummaryStyle = { border: "1px solid var(--lf-border)", borderRadius: 8, padding: 12, background: "var(--lf-surface-subtle)", color: "#1e3a8a", display: "grid", gap: 4 } satisfies CSSProperties;
const sectionHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" } satisfies CSSProperties;
const caseHeaderStyle = { ...sectionHeaderStyle, padding: "4px 0 10px", borderBottom: "1px solid var(--lf-border)" } satisfies CSSProperties;
const caseActionBarStyle = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "0 0 4px" } satisfies CSSProperties;
const twoColumnDetailStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14 } satisfies CSSProperties;
const compactDetailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 8 } satisfies CSSProperties;
const emptyCaseStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", border: "1px dashed var(--lf-border-input)", borderRadius: 8, padding: 14, background: "var(--lf-surface-page)" } satisfies CSSProperties;
const noteComposerStyle = { display: "grid", gap: 10, padding: 12, border: "1px solid var(--lf-border)", borderRadius: 8, background: "var(--lf-surface-subtle)" } satisfies CSSProperties;
const modalBackdropStyle = { position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 20, background: "rgba(15, 23, 42, 0.52)" } satisfies CSSProperties;
const modalStyle = { width: "min(100%, 520px)", maxHeight: "calc(100dvh - 40px)", overflowY: "auto", display: "grid", gap: 14, padding: 20, borderRadius: 10, background: "var(--lf-surface-card)", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)" } satisfies CSSProperties;
const contextPanelStyle = { border: "1px solid var(--lf-border-input)", borderRadius: 8, padding: 14, display: "grid", gap: 12, background: "var(--lf-surface-page)" } satisfies CSSProperties;
const actionsCellStyle = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties;
const actionRowStyle = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties;
const detailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 } satisfies CSSProperties;
const detailItemStyle = { display: "grid", gap: 4, border: "1px solid var(--lf-border)", borderRadius: 8, padding: 10, background: "var(--lf-surface-card)", minWidth: 0 } satisfies CSSProperties;
const eventListStyle = { margin: 0, paddingLeft: 18, display: "grid", gap: 8 } satisfies CSSProperties;
const compactFilterStyle = { ...panelStyle, display: "grid", gap: 10, alignItems: "end" } satisfies CSSProperties;
const contextNavStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 } satisfies CSSProperties;
const labelStyle = { display: "grid", gap: 5, color: "var(--lf-text)", fontSize: 13, fontWeight: 700 } satisfies CSSProperties;
