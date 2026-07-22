import {
  applyAdminUserLifecycleUpdate,
  listAdminUsers,
  normalizeAdminUserLifecycleAction,
  planAdminUserLifecycleUpdate,
} from "@/lib/admin/operations";
import { createAdminInvitation, listAdminInvitations } from "@/lib/admin/adminInvitations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  adminLifecycleError,
  checkAdminLifecycleRateLimit,
  getRequestSourceIp,
  isValidAdminEmail,
  noStoreJson,
  safeAdminErrorResponse,
} from "@/lib/admin/lifecycleSecurity";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, code: admin.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_PERMISSION_DENIED", message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin_users:manage");
  if (denied) {
    return noStoreJson({ ok: false, code: "ADMIN_PERMISSION_DENIED", message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const admins = await listAdminUsers(admin.adminClient);
  const invitations = await listAdminInvitations(admin.adminClient).catch(() => []);
  return noStoreJson({ ok: true, admins, invitations });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, code: admin.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_PERMISSION_DENIED", message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin_users:manage");
  if (denied) {
    return noStoreJson({ ok: false, code: "ADMIN_PERMISSION_DENIED", message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  const rate = checkAdminLifecycleRateLimit({
    actorId: admin.access.user.id,
    sourceIp: getRequestSourceIp(request),
    route: "/api/internal/admin/admin-users",
    action: "grant_admin",
  });
  if (!rate.ok) {
    return safeAdminErrorResponse(adminLifecycleError("ADMIN_RATE_LIMITED", "admin_grant_rate_limit"));
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    fullName?: string | null;
    roleTemplate?: string | null;
    scopeType?: string | null;
    organisationId?: string | null;
    requireMfa?: boolean | null;
    expiryDays?: number | null;
    accessExpiry?: string | null;
  };
  const email = String(body.email ?? "").trim();
  if (!email || !isValidAdminEmail(email)) {
    return safeAdminErrorResponse(adminLifecycleError("ADMIN_INVALID_EMAIL", "invalid_admin_email"));
  }

  try {
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_approval",
      action: "Admin invitation authorised",
      result: "pending",
      resourceType: "access_policy",
      route: "/api/internal/admin/admin-users",
      metadata: {
        requested_action: "admin_invitation",
        target_email: email.toLowerCase(),
        role_template: body.roleTemplate ?? "support_agent",
        scope_type: body.scopeType ?? "platform",
        require_mfa: body.requireMfa !== false,
      },
    });

    const invitation = await createAdminInvitation(admin.adminClient, admin.access, {
      email,
      fullName: body.fullName,
      roleTemplate: body.roleTemplate,
      scopeType: body.scopeType,
      organisationId: body.organisationId,
      requireMfa: body.requireMfa,
      expiryDays: body.expiryDays,
      accessExpiry: body.accessExpiry,
    });
    const admins = await listAdminUsers(admin.adminClient);
    const invitations = await listAdminInvitations(admin.adminClient).catch(() => []);
    return noStoreJson({ ok: true, invitation, admins, invitations });
  } catch (error) {
    return safeAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, code: admin.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_PERMISSION_DENIED", message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin_users:manage");
  if (denied) {
    return noStoreJson({ ok: false, code: "ADMIN_PERMISSION_DENIED", message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    adminUserId?: string;
    action?: string;
    role?: string | null;
    reason?: string | null;
  };
  const adminUserId = String(body.adminUserId ?? "").trim();
  const action = normalizeAdminUserLifecycleAction(body.action);
  if (!adminUserId || !action) {
    return safeAdminErrorResponse(adminLifecycleError("ADMIN_INVALID_STATUS", "invalid_lifecycle_action"));
  }

  const rate = checkAdminLifecycleRateLimit({
    actorId: admin.access.user.id,
    sourceIp: getRequestSourceIp(request),
    route: "/api/internal/admin/admin-users",
    action,
  });
  if (!rate.ok) {
    return safeAdminErrorResponse(adminLifecycleError("ADMIN_RATE_LIMITED", "admin_lifecycle_rate_limit"));
  }

  let result;
  try {
    const plan = await planAdminUserLifecycleUpdate(admin.adminClient, {
      adminUserId,
      action,
      role: body.role ?? null,
      reason: body.reason ?? null,
      actorUserId: admin.access.user.id,
    });

    const auditEventId = await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_approval",
      action: `Admin user ${action.replace(/_/g, " ")} authorised`,
      result: "pending",
      resourceType: "access_policy",
      resourceId: plan.before.id,
      resourceLabel: plan.before.email_normalized,
      route: "/api/internal/admin/admin-users",
      metadata: {
        action,
        previous_role: plan.before.role,
        next_role: plan.after.role,
        previous_status: plan.before.status,
        next_status: plan.after.status,
        reason_present: Boolean(plan.reason),
        target_email: plan.before.email_normalized,
      },
    });
    result = await applyAdminUserLifecycleUpdate(admin.adminClient, plan, { auditEventId });
  } catch (error) {
    return safeAdminErrorResponse(error);
  }

  const admins = await listAdminUsers(admin.adminClient);
  return noStoreJson({ ok: true, admin: result.after, admins });
}
