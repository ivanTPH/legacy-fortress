import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUserRow } from "./access";
import { MASTER_ADMIN_EMAIL, normalizeAdminEmail } from "./access";
import { buildVerificationActionKey, deriveBlockingState } from "../workflow/blockingModel";

type AnySupabaseClient = SupabaseClient;

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
    activationStatus: string;
    issueLabel: string;
  }>;
};

export type VerificationAction = "approve" | "reject" | "review";

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
  if (activation === "verification_submitted") return "Awaiting verification review";
  if (activation === "pending_verification") return "Verification still pending";
  if (activation === "accepted") return "Accepted access awaiting activation";
  if (activation === "rejected") return "Rejected access requires follow-up";
  return "Needs support review";
}

export async function listAdminUsers(client: AnySupabaseClient) {
  const res = await client
    .from("admin_users")
    .select("id,email_normalized,user_id,display_name,status,is_master,granted_by_user_id,created_at,updated_at")
    .order("is_master", { ascending: false })
    .order("created_at", { ascending: true });

  if (res.error) {
    throw new Error(res.error.message);
  }

  const rows = (res.data ?? []) as AdminUserRow[];
  return rows.sort((a, b) => Number(b.is_master) - Number(a.is_master) || a.email_normalized.localeCompare(b.email_normalized));
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
  const res = await client
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
    .single();

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
  const [pendingInvitations, verificationAwaitingReview, linkedAccountsActive, invitationRowsRes, roleRowsRes, ownerProfilesRes] = await Promise.all([
    countRows(client, "contact_invitations", "invitation_status", "pending"),
    countRowsIn(client, "verification_requests", "request_status", ["pending", "submitted"]),
    countRowsIn(client, "account_access_grants", "activation_status", ["accepted", "verified", "active"]),
    client
      .from("contact_invitations")
      .select("id,contact_id,contact_name,contact_email,invitation_status,owner_user_id")
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
        activationStatus: role?.activation_status ?? "invited",
        issueLabel,
      };
    })
    .filter((item) => item.invitationStatus === "pending" || ["accepted", "pending_verification", "verification_submitted", "rejected"].includes(item.activationStatus))
    .slice(0, 12);

  return {
    counts: {
      pendingInvitations,
      verificationAwaitingReview,
      linkedAccountsActive,
      invitationIssues: issues.length,
    },
    issues,
  } satisfies AdminSupportSnapshot;
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
