import { NextResponse } from "next/server";
import { listAdminUsers } from "@/lib/admin/operations";
import { listAdminInvitations } from "@/lib/admin/adminInvitations";
import { adminHasCapability, requireAdminAccess } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: admin.message,
        issue: admin.issue ?? null,
      },
      { status: admin.status },
    );
  }

  const canManageAdmins = adminHasCapability(admin.access, "admin_users:manage");
  const admins = canManageAdmins ? await listAdminUsers(admin.adminClient) : [];
  const invitations = canManageAdmins ? await listAdminInvitations(admin.adminClient).catch(() => []) : [];
  return NextResponse.json({
    ok: true,
    admin: {
      email: admin.access.emailNormalized,
      isMasterAdmin: admin.access.isMasterAdmin,
      role: admin.access.adminRole,
      capabilities: admin.access.capabilities,
      displayName: admin.access.adminRow.display_name || admin.access.user.email || "Admin",
    },
    admins,
    invitations,
  });
}
