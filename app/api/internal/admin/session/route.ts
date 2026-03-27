import { NextResponse } from "next/server";
import { listAdminUsers } from "@/lib/admin/operations";
import { requireAdminAccess } from "@/lib/admin/access";

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

  const admins = await listAdminUsers(admin.adminClient);
  return NextResponse.json({
    ok: true,
    admin: {
      email: admin.access.emailNormalized,
      isMasterAdmin: admin.access.isMasterAdmin,
      displayName: admin.access.adminRow.display_name || admin.access.user.email || "Admin",
    },
    admins,
  });
}

