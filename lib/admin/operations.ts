import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUserRow } from "./access.ts";
import { MASTER_ADMIN_EMAIL, normalizeAdminEmail } from "./access.ts";
import { normalizeAdminRole } from "./capabilities.ts";
import { adminLifecycleError } from "./lifecycleSecurity.ts";
import { buildVerificationActionKey, deriveBlockingState } from "../workflow/blockingModel.ts";
import { ROLE_RULES, type CollaboratorRole } from "../access-control/roles.ts";

type AnySupabaseClient = SupabaseClient;
type AdminRowsResponse = {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
};
type AdminRowResponse = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type AuthListUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: { display_name?: string | null; full_name?: string | null } | null;
};

type UserProfileRow = {
  user_id: string;
  display_name?: string | null;
};

type VerificationQueueRow = {
  id: string;
  owner_user_id: string;
  role_assignment_id: string;
  request_type: string;
  request_status: string;
  evidence_document_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
};

type RoleAssignmentRow = {
  id: string;
  invitation_id: string;
  owner_user_id: string;
  assigned_role: string;
  activation_status: string;
  updated_at?: string | null;
};

type ContactInvitationRow = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  invitation_status: string;
  sent_at?: string | null;
  last_sent_at?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  revoked_at?: string | null;
  accepted_user_id?: string | null;
  assigned_role?: string | null;
  permissions_override?: Record<string, unknown> | null;
  owner_user_id: string;
};

type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  relationship: string | null;
};

type BillingProfileRow = {
  user_id: string;
  account_plan?: string | null;
  plan_status?: string | null;
  monthly_charge?: number | null;
  billing_currency?: string | null;
};

export type AdminLookupResult = {
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

export type AdminUserOperationalDetail = AdminLookupResult & {
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

export type AdminVerificationItem = {
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

export type AdminSupportSnapshot = {
  counts: {
    pendingInvitations: number;
    readyToSendInvitations: number;
    verificationAwaitingReview: number;
    linkedAccountsActive: number;
    invitationIssues: number;
  };
  issues: Array<{
    invitationId: string;
    ownerUserId: string;
    ownerName: string;
    contactName: string;
    contactEmail: string;
    assignedRole: string;
    invitationStatus: string;
    sentAt: string | null;
    activationStatus: string;
    issueLabel: string;
  }>;
};

export type AdminSupportInvitationDetail = {
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

export type AdminAuditHistoryItem = {
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

export type VerificationAction = "approve" | "reject" | "review";
export type AdminUserLifecycleAction = "activate" | "deactivate" | "change_role";
export type AdminUserLifecyclePlan = {
  adminUserId: string;
  action: AdminUserLifecycleAction;
  before: AdminUserRow;
  after: AdminUserRow;
  patch: Record<string, unknown>;
  reason: string | null;
};

export function normalizeAuditHistoryLimit(value: string | number | null | undefined) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

export function buildVerificationMutation(action: VerificationAction) {
  if (action === "approve") {
    return {
      requestStatus: "approved",
      roleActivationStatus: "verified",
      grantActivationStatus: "verified",
    };
  }
  if (action === "reject") {
    return {
      requestStatus: "rejected",
      roleActivationStatus: "rejected",
      grantActivationStatus: "rejected",
    };
  }
  return {
    requestStatus: null,
    roleActivationStatus: null,
    grantActivationStatus: null,
  };
}

export function buildSupportIssueLabel(invitationStatus: string, activationStatus: string) {
  const invite = String(invitationStatus ?? "").trim().toLowerCase();
  const activation = String(activationStatus ?? "").trim().toLowerCase();
  if (invite === "pending") return "Invitation still pending";
  if (invite === "failed" || invite === "delivery_failed") return "Invitation delivery failed";
  if (activation === "verification_submitted") return "Awaiting verification review";
  if (activation === "pending_verification") return "Verification still pending";
  if (activation === "accepted") return "Accepted access awaiting activation";
  if (activation === "rejected") return "Rejected access requires follow-up";
  return "Needs support review";
}

export async function listAdminUsers(client: AnySupabaseClient) {
  let res = await client
    .from("admin_users")
    .select("id,email_normalized,user_id,display_name,status,is_master,role,granted_by_user_id,created_at,updated_at")
    .order("is_master", { ascending: false })
    .order("created_at", { ascending: true }) as AdminRowsResponse;

  if (res.error && /role/i.test(res.error.message)) {
    res = await client
      .from("admin_users")
      .select("id,email_normalized,user_id,display_name,status,is_master,granted_by_user_id,created_at,updated_at")
      .order("is_master", { ascending: false })
      .order("created_at", { ascending: true }) as AdminRowsResponse;
    if (res.data) {
      res.data = res.data.map((row) => ({ ...row, role: null }));
    }
  }

  if (res.error) {
    throw new Error(res.error.message);
  }

  const rows = (res.data ?? []) as AdminUserRow[];
  return rows.sort((a, b) => Number(b.is_master) - Number(a.is_master) || a.email_normalized.localeCompare(b.email_normalized));
}

export async function loadAuditHistory(client: AnySupabaseClient, limit: number) {
  const boundedLimit = normalizeAuditHistoryLimit(limit);
  const res = await client
    .from("audit_events")
    .select("id,category,action,result,actor_email_normalized,actor_role,resource_type,resource_label,route,policy_decision,created_at")
    .order("created_at", { ascending: false })
    .limit(boundedLimit) as AdminRowsResponse;

  if (res.error) {
    throw new Error(res.error.message);
  }

  return (res.data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    category: String(row.category ?? ""),
    action: String(row.action ?? ""),
    result: String(row.result ?? ""),
    actorEmail: typeof row.actor_email_normalized === "string" ? row.actor_email_normalized : null,
    actorRole: typeof row.actor_role === "string" ? row.actor_role : null,
    resourceType: String(row.resource_type ?? ""),
    resourceLabel: typeof row.resource_label === "string" ? row.resource_label : null,
    route: String(row.route ?? ""),
    policyDecision: String(row.policy_decision ?? ""),
    createdAt: String(row.created_at ?? ""),
  })) satisfies AdminAuditHistoryItem[];
}

export async function addAdminUser(
  client: AnySupabaseClient,
  {
    email,
    grantedByUserId,
  }: {
    email: string;
    grantedByUserId: string;
  },
) {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) {
    throw new Error("Admin email is required.");
  }
  if (normalized === MASTER_ADMIN_EMAIL) {
    return upsertAdminUser(client, {
      emailNormalized: normalized,
      displayName: "Master Admin",
      grantedByUserId,
      isMaster: true,
    });
  }
  return upsertAdminUser(client, {
    emailNormalized: normalized,
    displayName: null,
    grantedByUserId,
    isMaster: false,
  });
}

export function normalizeAdminUserLifecycleAction(value: string | null | undefined): AdminUserLifecycleAction | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "activate" || normalized === "deactivate" || normalized === "change_role") return normalized;
  return null;
}

export async function planAdminUserLifecycleUpdate(
  client: AnySupabaseClient,
  {
    adminUserId,
    action,
    role,
    actorUserId,
    reason,
    expectedUpdatedAt,
  }: {
    adminUserId: string;
    action: AdminUserLifecycleAction;
    role?: string | null;
    actorUserId: string;
    reason?: string | null;
    expectedUpdatedAt?: string | null;
  },
) {
  const targetRes = await client
    .from("admin_users")
    .select("id,email_normalized,user_id,display_name,status,is_master,role,granted_by_user_id,created_at,updated_at")
    .eq("id", adminUserId)
    .single() as AdminRowResponse;

  if (targetRes.error || !targetRes.data) {
    throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", targetRes.error?.message || "admin_user_not_found");
  }

  const target = targetRes.data as AdminUserRow;
  const expected = String(expectedUpdatedAt ?? "").trim();
  if (expected && expected !== target.updated_at) {
    throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", "stale_admin_lifecycle_target");
  }
  const normalizedReason = String(reason ?? "").trim();
  if ((action === "deactivate" || action === "change_role") && !normalizedReason) {
    throw adminLifecycleError("ADMIN_INVALID_STATUS", "missing_lifecycle_reason");
  }

  const nextRole = action === "change_role" ? normalizeAdminRole(role) : null;
  if (action === "change_role" && !nextRole) {
    throw adminLifecycleError("ADMIN_INVALID_ROLE", "invalid_lifecycle_role");
  }

  if (isProtectedMasterAdminRow(target) && (action === "deactivate" || (action === "change_role" && nextRole !== "super_admin"))) {
    throw adminLifecycleError("ADMIN_PROTECTED_ACCOUNT", "protected_master_identity_change_blocked");
  }

  if (target.user_id && target.user_id === actorUserId && (action === "deactivate" || (action === "change_role" && nextRole !== "super_admin"))) {
    throw adminLifecycleError("ADMIN_SELF_ACTION_BLOCKED", "self_lifecycle_change_blocked");
  }

  if (removesActiveSuperAdmin(target, action, nextRole)) {
    await assertAnotherActiveMasterAdminExists(client, target.id);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (action === "activate") {
    patch.status = "active";
  } else if (action === "deactivate") {
    patch.status = "inactive";
    patch.is_master = false;
    if (target.role === "super_admin") patch.role = "support_agent";
  } else {
    patch.role = nextRole;
    patch.is_master = nextRole === "super_admin";
    if (nextRole === "super_admin") patch.status = "active";
  }

  return {
    adminUserId,
    action,
    before: target,
    after: { ...target, ...patch } as AdminUserRow,
    patch,
    reason: normalizedReason || null,
  } satisfies AdminUserLifecyclePlan;
}

export async function applyAdminUserLifecycleUpdate(
  client: AnySupabaseClient,
  plan: AdminUserLifecyclePlan,
  {
    auditEventId,
  }: {
    auditEventId: string;
  },
) {
  if (!auditEventId) {
    throw adminLifecycleError("ADMIN_AUDIT_FAILED", "missing_lifecycle_audit_event_id");
  }

  const updateRes = await client
    .from("admin_users")
    .update(plan.patch)
    .eq("id", plan.adminUserId)
    .eq("updated_at", plan.before.updated_at)
    .select("id,email_normalized,user_id,display_name,status,is_master,role,granted_by_user_id,created_at,updated_at")
    .single() as AdminRowResponse;

  if (updateRes.error || !updateRes.data) {
    throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", updateRes.error?.message || "admin_lifecycle_update_failed");
  }

  return {
    before: plan.before,
    after: updateRes.data as AdminUserRow,
    reason: plan.reason,
    auditEventId,
  };
}

export async function updateAdminUserLifecycle(
  client: AnySupabaseClient,
  input: {
    adminUserId: string;
    action: AdminUserLifecycleAction;
    role?: string | null;
    actorUserId: string;
    reason?: string | null;
    expectedUpdatedAt?: string | null;
    auditEventId: string;
  },
) {
  const plan = await planAdminUserLifecycleUpdate(client, input);
  return applyAdminUserLifecycleUpdate(client, plan, { auditEventId: input.auditEventId });
}

async function assertAnotherActiveMasterAdminExists(client: AnySupabaseClient, excludedAdminUserId: string) {
  const res = await client
    .from("admin_users")
    .select("id,is_master,role")
    .eq("status", "active")
    .neq("id", excludedAdminUserId)
    .limit(10);
  if (res.error) {
    throw adminLifecycleError("ADMIN_INTERNAL_ERROR", res.error.message);
  }
  const rows = (res.data ?? []) as Pick<AdminUserRow, "is_master" | "role">[];
  if (!rows.some(isActiveSuperAdminMarker)) {
    throw adminLifecycleError("ADMIN_LAST_SUPER_ADMIN", "last_active_super_admin_blocked");
  }
}

export function isProtectedMasterAdminRow(row: Pick<AdminUserRow, "email_normalized" | "is_master">) {
  return normalizeAdminEmail(row.email_normalized) === MASTER_ADMIN_EMAIL;
}

function isActiveSuperAdminMarker(row: Pick<AdminUserRow, "is_master" | "role">) {
  return Boolean(row.is_master) || normalizeAdminRole(row.role) === "super_admin";
}

function removesActiveSuperAdmin(row: AdminUserRow, action: AdminUserLifecycleAction, nextRole: ReturnType<typeof normalizeAdminRole>) {
  if (row.status !== "active" || !isActiveSuperAdminMarker(row)) return false;
  if (action === "deactivate") return true;
  return action === "change_role" && nextRole !== "super_admin";
}

async function upsertAdminUser(
  client: AnySupabaseClient,
  {
    emailNormalized,
    displayName,
    grantedByUserId,
    isMaster,
  }: {
    emailNormalized: string;
    displayName: string | null;
    grantedByUserId: string;
    isMaster: boolean;
  },
) {
  const now = new Date().toISOString();
  let res = await client
    .from("admin_users")
    .upsert(
      {
        email_normalized: emailNormalized,
        display_name: displayName,
        status: "active",
        is_master: isMaster,
        role: isMaster ? "super_admin" : "support_agent",
        granted_by_user_id: grantedByUserId,
        updated_at: now,
      },
      { onConflict: "email_normalized" },
    )
    .select("id,email_normalized,user_id,display_name,status,is_master,role,granted_by_user_id,created_at,updated_at")
    .single() as AdminRowResponse;

  if (res.error && /role/i.test(res.error.message)) {
    res = await client
      .from("admin_users")
      .upsert(
        {
          email_normalized: emailNormalized,
          display_name: displayName,
          status: "active",
          is_master: isMaster,
          granted_by_user_id: grantedByUserId,
          updated_at: now,
        },
        { onConflict: "email_normalized" },
      )
      .select("id,email_normalized,user_id,display_name,status,is_master,granted_by_user_id,created_at,updated_at")
      .single() as AdminRowResponse;
    if (res.data) {
      res.data = { ...res.data, role: null };
    }
  }

  if (res.error || !res.data) {
    throw new Error(res.error?.message || "Could not store admin user.");
  }

  return res.data as AdminUserRow;
}

export async function lookupUsers(client: AnySupabaseClient, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const authList = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authList.error) {
    throw new Error(authList.error.message);
  }

  const users = ((authList.data?.users ?? []) as AuthListUser[]).filter((user) => {
    if (!normalizedQuery) return true;
    const email = String(user.email ?? "").toLowerCase();
    const displayName = String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "").toLowerCase();
    return email.includes(normalizedQuery) || displayName.includes(normalizedQuery);
  }).slice(0, 20);

  const userIds = users.map((user) => user.id);
  const profileRes = userIds.length
    ? await client.from("user_profiles").select("user_id,display_name").in("user_id", userIds)
    : { data: [], error: null };
  if (profileRes.error) {
    throw new Error(profileRes.error.message);
  }
  const profiles = new Map(((profileRes.data ?? []) as UserProfileRow[]).map((row) => [row.user_id, row]));
  const billingRes = userIds.length
    ? await client.from("billing_profiles").select("user_id,account_plan,plan_status,monthly_charge,billing_currency").in("user_id", userIds)
    : { data: [], error: null };
  if (billingRes.error) {
    throw new Error(billingRes.error.message);
  }
  const billingByUserId = new Map(((billingRes.data ?? []) as BillingProfileRow[]).map((row) => [row.user_id, row]));

  const results = await Promise.all(
    users.map(async (user) => {
      const [assets, documents, contacts, invitations, grants, verifications] = await Promise.all([
        countRows(client, "assets", "owner_user_id", user.id),
        countRows(client, "documents", "owner_user_id", user.id),
        countRows(client, "contacts", "owner_user_id", user.id),
        countRows(client, "contact_invitations", "owner_user_id", user.id),
        countRows(client, "account_access_grants", "owner_user_id", user.id),
        countRows(client, "verification_requests", "owner_user_id", user.id),
      ]);

      const profile = profiles.get(user.id);
      const billing = billingByUserId.get(user.id);
      return {
        userId: user.id,
        email: String(user.email ?? ""),
        displayName:
          String(profile?.display_name ?? "").trim()
          || String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "").trim()
          || "Unnamed user",
        createdAt: String(user.created_at ?? ""),
        lastSignInAt: String(user.last_sign_in_at ?? ""),
        hasProfile: Boolean(profile?.display_name),
        counts: {
          assets,
          documents,
          contacts,
          invitations,
          linkedAccessGrants: grants,
          verificationRequests: verifications,
        },
        commercial: {
          accountPlan: String(billing?.account_plan ?? "starter"),
          planStatus: String(billing?.plan_status ?? "active"),
          monthlyCharge: Number(billing?.monthly_charge ?? 0),
          billingCurrency: String(billing?.billing_currency ?? "GBP"),
        },
      } satisfies AdminLookupResult;
    }),
  );

  return results;
}

export async function loadUserOperationalDetail(client: AnySupabaseClient, userId: string) {
  const id = String(userId ?? "").trim();
  if (!id) throw adminLifecycleError("ADMIN_INVALID_STATUS", "missing_user_id");

  const authRes = await client.auth.admin.getUserById(id);
  if (authRes.error || !authRes.data?.user) {
    throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", "user_not_found");
  }
  const user = authRes.data.user as AuthListUser;

  const [
    profileRes,
    billingRes,
    contactsRes,
    invitationsRes,
    grantsRes,
    verificationRes,
    assets,
    documents,
  ] = await Promise.all([
    client.from("user_profiles").select("user_id,display_name").eq("user_id", id).maybeSingle(),
    client.from("billing_profiles").select("user_id,account_plan,plan_status,monthly_charge,billing_currency").eq("user_id", id).maybeSingle(),
    client
      .from("contacts")
      .select("id,full_name,email,relationship,invite_status,verification_status")
      .eq("owner_user_id", id)
      .order("updated_at", { ascending: false })
      .limit(20),
    client
      .from("contact_invitations")
      .select("id,contact_name,contact_email,assigned_role,invitation_status,sent_at,accepted_at,revoked_at")
      .eq("owner_user_id", id)
      .order("updated_at", { ascending: false })
      .limit(20),
    client
      .from("account_access_grants")
      .select("id,invitation_id,activation_status,updated_at")
      .eq("owner_user_id", id)
      .order("updated_at", { ascending: false })
      .limit(20),
    client
      .from("verification_requests")
      .select("id,request_type,request_status,submitted_at,reviewed_at")
      .eq("owner_user_id", id)
      .order("submitted_at", { ascending: false })
      .limit(20),
    countRows(client, "assets", "owner_user_id", id),
    countRows(client, "documents", "owner_user_id", id),
  ]);

  if (profileRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", profileRes.error.message);
  if (billingRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", billingRes.error.message);
  if (contactsRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", contactsRes.error.message);
  if (invitationsRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", invitationsRes.error.message);
  if (grantsRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", grantsRes.error.message);
  if (verificationRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", verificationRes.error.message);

  const profile = profileRes.data as UserProfileRow | null;
  const billing = billingRes.data as BillingProfileRow | null;
  const contacts = (contactsRes.data ?? []) as Array<ContactRow & { invite_status?: string | null; verification_status?: string | null }>;
  const invitations = (invitationsRes.data ?? []) as ContactInvitationRow[];
  const grants = (grantsRes.data ?? []) as Array<Record<string, unknown>>;
  const verifications = (verificationRes.data ?? []) as Array<Record<string, unknown>>;
  const displayName =
    String(profile?.display_name ?? "").trim()
    || String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "").trim()
    || "Unnamed user";

  return {
    userId: id,
    email: String(user.email ?? ""),
    displayName,
    createdAt: String(user.created_at ?? ""),
    lastSignInAt: String(user.last_sign_in_at ?? ""),
    hasProfile: Boolean(profile?.display_name),
    profile: {
      displayName: profile?.display_name ?? null,
      hasProfile: Boolean(profile?.display_name),
    },
    counts: {
      assets,
      documents,
      contacts: contacts.length,
      invitations: invitations.length,
      linkedAccessGrants: grants.length,
      verificationRequests: verifications.length,
    },
    commercial: {
      accountPlan: String(billing?.account_plan ?? "starter"),
      planStatus: String(billing?.plan_status ?? "active"),
      monthlyCharge: Number(billing?.monthly_charge ?? 0),
      billingCurrency: String(billing?.billing_currency ?? "GBP"),
    },
    contacts: contacts.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      relationship: row.relationship,
      inviteStatus: row.invite_status ?? null,
      verificationStatus: row.verification_status ?? null,
    })),
    invitations: invitations.map((row) => ({
      id: row.id,
      contactName: row.contact_name ?? "Unknown contact",
      contactEmail: row.contact_email ?? null,
      assignedRole: row.assigned_role ?? "professional_advisor",
      invitationStatus: row.invitation_status,
      sentAt: row.sent_at ?? null,
      acceptedAt: row.accepted_at ?? null,
      revokedAt: row.revoked_at ?? null,
    })),
    accessGrants: grants.map((row) => ({
      id: String(row.id ?? ""),
      invitationId: typeof row.invitation_id === "string" ? row.invitation_id : null,
      activationStatus: String(row.activation_status ?? ""),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })),
    verificationRequests: verifications.map((row) => ({
      id: String(row.id ?? ""),
      requestType: String(row.request_type ?? ""),
      requestStatus: String(row.request_status ?? ""),
      submittedAt: String(row.submitted_at ?? ""),
      reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    })),
    unavailableActions: [
      {
        action: "Inline user audit timeline",
        reason: "Use the canonical Audit history page; the user detail service does not duplicate audit retrieval.",
      },
      {
        action: "Suspend or restrict account",
        reason: "No canonical customer account suspension mutation is implemented for Platform Administration yet.",
      },
      {
        action: "Impersonate user",
        reason: "Impersonation is intentionally unavailable; administrators must not enter private vault contexts.",
      },
    ],
  } satisfies AdminUserOperationalDetail;
}

export async function loadVerificationQueue(client: AnySupabaseClient) {
  const verificationRes = await client
    .from("verification_requests")
    .select("id,owner_user_id,role_assignment_id,request_type,request_status,evidence_document_path,submitted_at,reviewed_at,reviewed_by,review_notes")
    .in("request_status", ["pending", "submitted"])
    .order("submitted_at", { ascending: true });

  if (verificationRes.error) {
    throw new Error(verificationRes.error.message);
  }

  const verificationRows = (verificationRes.data ?? []) as VerificationQueueRow[];
  if (!verificationRows.length) return [];

  const roleIds = [...new Set(verificationRows.map((row) => row.role_assignment_id))];
  const rolesRes = await client
    .from("role_assignments")
    .select("id,invitation_id,owner_user_id,assigned_role,activation_status,updated_at")
    .in("id", roleIds);
  if (rolesRes.error) {
    throw new Error(rolesRes.error.message);
  }
  const roleMap = new Map(((rolesRes.data ?? []) as RoleAssignmentRow[]).map((row) => [row.id, row]));

  const invitationIds = [...new Set(((rolesRes.data ?? []) as RoleAssignmentRow[]).map((row) => row.invitation_id).filter(Boolean))];
  const invitationsRes = invitationIds.length
    ? await client
        .from("contact_invitations")
        .select("id,contact_id,contact_name,contact_email,invitation_status,owner_user_id")
        .in("id", invitationIds)
    : { data: [], error: null };
  if (invitationsRes.error) {
    throw new Error(invitationsRes.error.message);
  }
  const invitations = (invitationsRes.data ?? []) as ContactInvitationRow[];
  const invitationMap = new Map(invitations.map((row) => [row.id, row]));

  const contactIds = [...new Set(invitations.map((row) => String(row.contact_id ?? "").trim()).filter(Boolean))];
  const contactsRes = contactIds.length
    ? await client.from("contacts").select("id,full_name,email,relationship").in("id", contactIds)
    : { data: [], error: null };
  if (contactsRes.error) {
    throw new Error(contactsRes.error.message);
  }
  const contactMap = new Map(((contactsRes.data ?? []) as ContactRow[]).map((row) => [row.id, row]));

  const ownerIds = [...new Set(verificationRows.map((row) => row.owner_user_id))];
  const profilesRes = ownerIds.length
    ? await client.from("user_profiles").select("user_id,display_name").in("user_id", ownerIds)
    : { data: [], error: null };
  if (profilesRes.error) {
    throw new Error(profilesRes.error.message);
  }
  const profileMap = new Map((((profilesRes.data ?? []) as UserProfileRow[])).map((row) => [row.user_id, row.display_name ?? "Secure Account"]));

  const queue = verificationRows.map((row) => {
    const role = roleMap.get(row.role_assignment_id);
    const invitation = role ? invitationMap.get(role.invitation_id) : null;
    const contact = invitation?.contact_id ? contactMap.get(invitation.contact_id) : null;
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      ownerName: String(profileMap.get(row.owner_user_id) ?? "Secure Account"),
      assignedRole: role?.assigned_role ?? "executor",
      activationStatus: role?.activation_status ?? "invited",
      requestType: row.request_type,
      requestStatus: row.request_status,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      contactName: contact?.full_name ?? invitation?.contact_name ?? "Unknown contact",
      contactEmail: contact?.email ?? invitation?.contact_email ?? "",
      evidencePath: row.evidence_document_path,
    } satisfies AdminVerificationItem;
  });

  const blockingItems = deriveBlockingState(
    {
      profile: {
        hasProfile: true,
        hasAddress: true,
        hasContact: true,
      },
    },
    {
      personal: { total: 1 },
      financial: { total: 1 },
      legal: { total: 1 },
      property: { total: 1 },
      business: { total: 1 },
      digital: { total: 1 },
      verificationRequests: verificationRows.map((row) => ({
        id: row.id,
        requestType: row.request_type,
        requestStatus: row.request_status,
        contactName:
          contactMap.get(String(invitationMap.get(roleMap.get(row.role_assignment_id)?.invitation_id ?? "")?.contact_id ?? ""))?.full_name
          ?? invitationMap.get(roleMap.get(row.role_assignment_id)?.invitation_id ?? "")?.contact_name
          ?? "Unknown contact",
      })),
    },
  );
  const priorityByActionKey = new Map(blockingItems.map((item) => [item.actionKey, item.priority]));

  return queue.sort((left, right) => {
    const leftPriority = priorityByActionKey.get(buildVerificationActionKey(left.id)) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priorityByActionKey.get(buildVerificationActionKey(right.id)) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.submittedAt.localeCompare(right.submittedAt);
  });
}

export async function applyVerificationAction(
  client: AnySupabaseClient,
  {
    requestId,
    action,
    reviewNotes,
    reviewedByUserId,
  }: {
    requestId: string;
    action: VerificationAction;
    reviewNotes?: string | null;
    reviewedByUserId: string;
  },
) {
  const requestRes = await client
    .from("verification_requests")
    .select("id,role_assignment_id,request_status")
    .eq("id", requestId)
    .single();

  if (requestRes.error || !requestRes.data) {
    throw new Error(requestRes.error?.message || "Verification request not found.");
  }

  const roleRes = await client
    .from("role_assignments")
    .select("id,invitation_id")
    .eq("id", requestRes.data.role_assignment_id)
    .single();

  if (roleRes.error || !roleRes.data) {
    throw new Error(roleRes.error?.message || "Role assignment not found.");
  }

  const mutation = buildVerificationMutation(action);
  const now = new Date().toISOString();

  const requestUpdate: Record<string, unknown> = {
    reviewed_at: now,
    reviewed_by: reviewedByUserId,
    review_notes: String(reviewNotes ?? "").trim() || null,
    updated_at: now,
  };
  if (mutation.requestStatus) {
    requestUpdate.request_status = mutation.requestStatus;
  }

  const requestUpdateRes = await client
    .from("verification_requests")
    .update(requestUpdate)
    .eq("id", requestId);
  if (requestUpdateRes.error) {
    throw new Error(requestUpdateRes.error.message);
  }

  if (mutation.roleActivationStatus) {
    const roleUpdateRes = await client
      .from("role_assignments")
      .update({ activation_status: mutation.roleActivationStatus, updated_at: now })
      .eq("id", roleRes.data.id);
    if (roleUpdateRes.error) {
      throw new Error(roleUpdateRes.error.message);
    }
  }

  if (mutation.grantActivationStatus) {
    const grantUpdateRes = await client
      .from("account_access_grants")
      .update({ activation_status: mutation.grantActivationStatus, updated_at: now })
      .eq("invitation_id", roleRes.data.invitation_id);
    if (grantUpdateRes.error) {
      throw new Error(grantUpdateRes.error.message);
    }
  }
}

export async function loadSupportSnapshot(client: AnySupabaseClient) {
  const [pendingInvitations, readyToSendInvitations, verificationAwaitingReview, linkedAccountsActive, invitationRowsRes, roleRowsRes, ownerProfilesRes] = await Promise.all([
    countSentPendingContactInvitations(client),
    countReadyToSendContactInvitations(client),
    countRowsIn(client, "verification_requests", "request_status", ["pending", "submitted"]),
    countRowsIn(client, "account_access_grants", "activation_status", ["accepted", "verified", "active"]),
    client
      .from("contact_invitations")
      .select("id,contact_id,contact_name,contact_email,invitation_status,sent_at,owner_user_id")
      .order("updated_at", { ascending: false })
      .limit(40),
    client
      .from("role_assignments")
      .select("id,invitation_id,owner_user_id,assigned_role,activation_status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(40),
    client.from("user_profiles").select("user_id,display_name"),
  ]);

  if (invitationRowsRes.error) throw new Error(invitationRowsRes.error.message);
  if (roleRowsRes.error) throw new Error(roleRowsRes.error.message);
  if (ownerProfilesRes.error) throw new Error(ownerProfilesRes.error.message);

  const roleMap = new Map(((roleRowsRes.data ?? []) as RoleAssignmentRow[]).map((row) => [row.invitation_id, row]));
  const profileMap = new Map((((ownerProfilesRes.data ?? []) as UserProfileRow[])).map((row) => [row.user_id, row.display_name ?? "Secure Account"]));

  const issues = ((invitationRowsRes.data ?? []) as ContactInvitationRow[])
    .map((invitation) => {
      const role = roleMap.get(invitation.id);
      const issueLabel = buildSupportIssueLabel(invitation.invitation_status, role?.activation_status ?? "invited");
      return {
        invitationId: invitation.id,
        ownerUserId: invitation.owner_user_id,
        ownerName: String(profileMap.get(invitation.owner_user_id) ?? "Secure Account"),
        contactName: invitation.contact_name ?? "Unknown contact",
        contactEmail: invitation.contact_email ?? "",
        assignedRole: role?.assigned_role ?? "professional_advisor",
        invitationStatus: invitation.invitation_status,
        sentAt: invitation.sent_at ?? null,
        activationStatus: role?.activation_status ?? "invited",
        issueLabel,
      };
    })
    .filter((item) =>
      (item.invitationStatus === "pending" && Boolean(item.sentAt))
      || ["failed", "delivery_failed"].includes(item.invitationStatus)
      || ["accepted", "pending_verification", "verification_submitted", "rejected"].includes(item.activationStatus)
    )
    .slice(0, 12);

  return {
    counts: {
      pendingInvitations,
      readyToSendInvitations,
      verificationAwaitingReview,
      linkedAccountsActive,
      invitationIssues: issues.length,
    },
    issues,
  } satisfies AdminSupportSnapshot;
}

export async function loadSupportInvitationDetail(client: AnySupabaseClient, invitationId: string) {
  const id = String(invitationId ?? "").trim();
  if (!id) throw adminLifecycleError("ADMIN_INVALID_STATUS", "missing_invitation_id");

  const invitationRes = await client
    .from("contact_invitations")
    .select("id,contact_id,contact_name,contact_email,assigned_role,invitation_status,owner_user_id,invited_at,sent_at,last_sent_at,accepted_at,rejected_at,revoked_at,accepted_user_id,permissions_override")
    .eq("id", id)
    .maybeSingle() as AdminRowResponse;
  if (invitationRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", invitationRes.error.message);
  if (!invitationRes.data) throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", "contact_invitation_not_found");

  const invitation = invitationRes.data as ContactInvitationRow;
  const [ownerProfileRes, contactRes, roleRes, grantRes, eventsRes, ownerAuthRes] = await Promise.all([
    client.from("user_profiles").select("user_id,display_name").eq("user_id", invitation.owner_user_id).maybeSingle(),
    invitation.contact_id
      ? client.from("contacts").select("id,full_name,email,relationship").eq("id", invitation.contact_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.from("role_assignments").select("id,assigned_role,activation_status,updated_at").eq("invitation_id", id).maybeSingle(),
    client.from("account_access_grants").select("id,activation_status,updated_at").eq("invitation_id", id).maybeSingle(),
    client.from("invitation_events").select("id,event_type,created_at,payload").eq("invitation_id", id).order("created_at", { ascending: false }).limit(20),
    client.auth.admin.getUserById(invitation.owner_user_id).catch((error: unknown) => ({ data: { user: null }, error })),
  ]);

  if (ownerProfileRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", ownerProfileRes.error.message);
  if (contactRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", contactRes.error.message);
  if (roleRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", roleRes.error.message);
  if (grantRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", grantRes.error.message);
  if (eventsRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", eventsRes.error.message);

  const role = roleRes.data as Record<string, unknown> | null;
  const grant = grantRes.data as Record<string, unknown> | null;
  const contact = contactRes.data as ContactRow | null;
  const ownerUser = "data" in ownerAuthRes ? ownerAuthRes.data.user : null;
  const activationStatus = String(role?.activation_status ?? "invited");

  return {
    invitation: {
      id: invitation.id,
      ownerUserId: invitation.owner_user_id,
      ownerName: String((ownerProfileRes.data as UserProfileRow | null)?.display_name ?? ownerUser?.email ?? "Secure Account"),
      ownerEmail: typeof ownerUser?.email === "string" ? ownerUser.email : null,
      contactId: invitation.contact_id,
      contactName: invitation.contact_name ?? contact?.full_name ?? "Unknown contact",
      contactEmail: invitation.contact_email ?? contact?.email ?? "",
      assignedRole: invitation.assigned_role ?? String(role?.assigned_role ?? "professional_advisor"),
      invitationStatus: invitation.invitation_status,
      activationStatus,
      sentAt: invitation.sent_at ?? null,
      lastSentAt: invitation.last_sent_at ?? null,
      invitedAt: invitation.invited_at ?? null,
      acceptedAt: invitation.accepted_at ?? null,
      rejectedAt: invitation.rejected_at ?? null,
      revokedAt: invitation.revoked_at ?? null,
      linkedAccountUserId: invitation.accepted_user_id ?? null,
      issueLabel: buildSupportIssueLabel(invitation.invitation_status, activationStatus),
      availableActions: getSupportInvitationActions(invitation.invitation_status),
    },
    contact: contact
      ? {
          id: contact.id,
          fullName: contact.full_name,
          email: contact.email,
          relationship: contact.relationship,
        }
      : null,
    roleAssignment: role
      ? {
          id: String(role.id ?? ""),
          assignedRole: String(role.assigned_role ?? ""),
          activationStatus: String(role.activation_status ?? ""),
          updatedAt: typeof role.updated_at === "string" ? role.updated_at : null,
        }
      : null,
    accessGrant: grant
      ? {
          id: String(grant.id ?? ""),
          activationStatus: String(grant.activation_status ?? ""),
          updatedAt: typeof grant.updated_at === "string" ? grant.updated_at : null,
        }
      : null,
    events: ((eventsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ""),
      eventType: String(row.event_type ?? ""),
      createdAt: String(row.created_at ?? ""),
      payload: sanitizeInvitationEventPayload(row.payload),
    })),
  } satisfies AdminSupportInvitationDetail;
}

export async function resendSupportInvitation(client: AnySupabaseClient, invitationId: string, origin: string | null) {
  const detail = await loadSupportInvitationDetail(client, invitationId);
  const invitation = detail.invitation;
  if (!getSupportInvitationActions(invitation.invitationStatus).includes("resend")) {
    throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", "contact_invitation_terminal_state");
  }
  if (!invitation.contactEmail) {
    throw adminLifecycleError("ADMIN_INVALID_EMAIL", "missing_contact_invitation_email");
  }
  const role = normalizeCollaboratorRole(invitation.assignedRole);
  if (!role) {
    throw adminLifecycleError("ADMIN_INVALID_ROLE", "invalid_contact_invitation_role");
  }

  const { sendContactInvite } = await import("../contacts/sendContactInvite.ts");
  await sendContactInvite(client, {
    ownerUserId: invitation.ownerUserId,
    ownerEmail: detail.invitation.ownerEmail,
    contactId: invitation.contactId,
    contactName: invitation.contactName,
    contactEmail: invitation.contactEmail,
    contactRelationship: detail.contact?.relationship ?? null,
    assignedRole: role,
    invitationId,
    invitedAt: invitation.invitedAt,
    activationStatus: normalizeActivationStatus(invitation.activationStatus),
    resend: Boolean(invitation.sentAt),
    origin,
  });

  return loadSupportInvitationDetail(client, invitationId);
}

export async function revokeSupportInvitation(client: AnySupabaseClient, invitationId: string, reason: string | null = null) {
  const detail = await loadSupportInvitationDetail(client, invitationId);
  const invitation = detail.invitation;
  if (!getSupportInvitationActions(invitation.invitationStatus).includes("revoke")) {
    throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", "contact_invitation_terminal_state");
  }

  const now = new Date().toISOString();
  const [invitationRes, roleRes, grantRes, contactRes, eventRes] = await Promise.all([
    client.from("contact_invitations").update({ invitation_status: "revoked", revoked_at: now, updated_at: now }).eq("id", invitationId),
    client.from("role_assignments").update({ activation_status: "revoked", updated_at: now }).eq("invitation_id", invitationId),
    client.from("account_access_grants").update({ activation_status: "revoked", updated_at: now }).eq("invitation_id", invitationId),
    invitation.contactId
      ? client.from("contacts").update({ invite_status: "revoked", verification_status: "revoked", updated_at: now }).eq("id", invitation.contactId).eq("owner_user_id", invitation.ownerUserId)
      : Promise.resolve({ error: null }),
    client.from("invitation_events").insert({
      owner_user_id: invitation.ownerUserId,
      invitation_id: invitationId,
      event_type: "revoked",
      payload: {
        reason_present: Boolean(String(reason ?? "").trim()),
        actor: "platform_admin",
      },
    }),
  ]);

  if (invitationRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", invitationRes.error.message);
  if (roleRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", roleRes.error.message);
  if (grantRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", grantRes.error.message);
  if (contactRes.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", contactRes.error.message);
  if (eventRes.error) throw adminLifecycleError("ADMIN_AUDIT_FAILED", eventRes.error.message);

  return loadSupportInvitationDetail(client, invitationId);
}

function getSupportInvitationActions(status: string) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (["accepted", "revoked", "expired"].includes(normalized)) return [];
  if (["pending", "failed", "delivery_failed"].includes(normalized)) return ["resend", "revoke"] as Array<"resend" | "revoke">;
  return [];
}

function normalizeCollaboratorRole(value: string): CollaboratorRole | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/-/g, "_");
  return normalized in ROLE_RULES ? normalized as CollaboratorRole : null;
}

function normalizeActivationStatus(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["invited", "accepted", "pending_verification", "verification_submitted", "verified", "active", "rejected", "revoked"].includes(normalized)) {
    return normalized as "invited" | "accepted" | "pending_verification" | "verification_submitted" | "verified" | "active" | "rejected" | "revoked";
  }
  return "invited";
}

function sanitizeInvitationEventPayload(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(input)) {
    if (/token|accept_path|body_text|password|secret|key/i.test(key)) continue;
    safe[key] = entry;
  }
  return safe;
}

async function countRows(client: AnySupabaseClient, table: string, column: string, value: string) {
  const res = await client.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (res.error) return 0;
  return res.count ?? 0;
}

async function countRowsIn(client: AnySupabaseClient, table: string, column: string, values: string[]) {
  const res = await client.from(table).select("id", { count: "exact", head: true }).in(column, values);
  if (res.error) return 0;
  return res.count ?? 0;
}

async function countSentPendingContactInvitations(client: AnySupabaseClient) {
  const res = await client
    .from("contact_invitations")
    .select("id", { count: "exact", head: true })
    .eq("invitation_status", "pending")
    .not("sent_at", "is", null);
  if (res.error) return 0;
  return res.count ?? 0;
}

async function countReadyToSendContactInvitations(client: AnySupabaseClient) {
  const res = await client
    .from("contact_invitations")
    .select("id", { count: "exact", head: true })
    .eq("invitation_status", "pending")
    .is("sent_at", null);
  if (res.error) return 0;
  return res.count ?? 0;
}
