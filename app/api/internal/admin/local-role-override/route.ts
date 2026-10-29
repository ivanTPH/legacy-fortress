import { NextResponse } from "next/server";
import {
  ADMIN_ROLE_OVERRIDE_COOKIE,
  isLocalAdminRoleHarnessEnabled,
  requireAdminAccess,
  requireAdminCapability,
} from "@/lib/admin/access";
import { ADMIN_ROLES, normalizeAdminRole } from "@/lib/admin/capabilities";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

const LOCAL_TEST_ROLES = [...ADMIN_ROLES, "standard_user", "revoked_admin"] as const;

export async function POST(request: Request) {
  if (!isLocalAdminRoleHarnessEnabled()) {
    return NextResponse.json({ ok: false, message: "Local admin role testing is not available in this environment." }, { status: 404 });
  }

  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "admin.roles.test");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const body = (await request.json().catch(() => ({}))) as { role?: string };
  const requested = String(body.role ?? "").trim();
  const role = requested === "standard_user" || requested === "revoked_admin" ? requested : normalizeAdminRole(requested);
  if (!role || !LOCAL_TEST_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, message: "A valid local test role is required." }, { status: 400 });
  }

  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Local admin role override started",
    result: "success",
    resourceType: "access_policy",
    resourceLabel: role,
    route: "/api/internal/admin/local-role-override",
    metadata: { local_uat_only: true, role },
  }).catch(() => null);

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(ADMIN_ROLE_OVERRIDE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}

export async function DELETE(request: Request) {
  if (!isLocalAdminRoleHarnessEnabled()) {
    return NextResponse.json({ ok: false, message: "Local admin role testing is not available in this environment." }, { status: 404 });
  }

  const admin = await requireAdminAccess(request);
  if (admin.ok) {
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_review",
      action: "Local admin role override ended",
      result: "success",
      resourceType: "access_policy",
      resourceLabel: "reset",
      route: "/api/internal/admin/local-role-override",
      metadata: { local_uat_only: true },
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ROLE_OVERRIDE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
