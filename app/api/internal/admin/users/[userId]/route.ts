import { NextResponse } from "next/server";
import { loadUserOperationalDetail } from "@/lib/admin/operations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { safeAdminErrorResponse } from "@/lib/admin/lifecycleSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const request = _request;
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, message: admin.message, issue: admin.issue ?? null }, admin.status);
  }
  const denied = requireAdminCapability(admin.access, "users:lookup");
  if (denied) {
    return noStoreJson({ ok: false, message: denied.message, capability: denied.capability }, denied.status);
  }

  const { userId } = await params;
  try {
    const detail = await loadUserOperationalDetail(admin.adminClient, userId);
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_review",
      action: "Admin customer user detail inspected",
      result: "success",
      resourceType: "access_policy",
      resourceId: detail.userId,
      resourceLabel: detail.email || detail.displayName,
      route: `/api/internal/admin/users/${detail.userId}`,
      metadata: {
        contacts: detail.counts.contacts,
        invitations: detail.counts.invitations,
        linked_access_grants: detail.counts.linkedAccessGrants,
        private_vault_contents_exposed: false,
      },
    });
    return noStoreJson({ ok: true, detail });
  } catch (error) {
    return safeAdminErrorResponse(error);
  }
}

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
