import { NextResponse } from "next/server";
import { addAdminUser, listAdminUsers, normalizeAdminUserLifecycleAction, updateAdminUserLifecycle } from "@/lib/admin/operations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin_users:manage");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const admins = await listAdminUsers(admin.adminClient);
  return NextResponse.json({ ok: true, admins });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin_users:manage");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, message: "Admin email is required." }, { status: 400 });
  }

  const saved = await addAdminUser(admin.adminClient, {
    email,
    grantedByUserId: admin.access.user.id,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_approval",
    action: "Admin user granted",
    result: "success",
    resourceType: "access_policy",
    resourceId: saved.id,
    resourceLabel: saved.email_normalized,
    route: "/api/internal/admin/admin-users",
    metadata: { granted_role: saved.role, target_email: saved.email_normalized },
  });
  const admins = await listAdminUsers(admin.adminClient);
  return NextResponse.json({ ok: true, admin: saved, admins });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin_users:manage");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
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
    return NextResponse.json({ ok: false, message: "A valid admin user action is required." }, { status: 400 });
  }

  let result;
  try {
    result = await updateAdminUserLifecycle(admin.adminClient, {
      adminUserId,
      action,
      role: body.role ?? null,
      reason: body.reason ?? null,
      actorUserId: admin.access.user.id,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not update admin user." },
      { status: 400 },
    );
  }

  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_approval",
    action: `Admin user ${action.replace(/_/g, " ")}`,
    result: "success",
    resourceType: "access_policy",
    resourceId: result.after.id,
    resourceLabel: result.after.email_normalized,
    route: "/api/internal/admin/admin-users",
    metadata: {
      action,
      previous_role: result.before.role,
      next_role: result.after.role,
      previous_status: result.before.status,
      next_status: result.after.status,
      reason_present: Boolean(result.reason),
      target_email: result.after.email_normalized,
    },
  });

  const admins = await listAdminUsers(admin.adminClient);
  return NextResponse.json({ ok: true, admin: result.after, admins });
}
