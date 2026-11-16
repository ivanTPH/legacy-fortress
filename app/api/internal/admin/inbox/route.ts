import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { loadAdminInbox } from "@/lib/admin/inbox";

export const dynamic = "force-dynamic";

/** GET — the Admin Inbox (16 Nov 2026). Account details and counts only; same permission as finding customers. */
export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "users:lookup");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  const url = new URL(request.url);
  const includeTests = url.searchParams.get("tests") === "1";
  const items = await loadAdminInbox(admin.adminClient, { days: 30, includeTests });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Admin inbox viewed",
    result: "success",
    resourceType: "access_policy",
    resourceId: null,
    resourceLabel: "Admin inbox",
    route: "/api/internal/admin/inbox",
    metadata: { item_count: items.length, include_tests: includeTests },
  });
  return NextResponse.json({ ok: true, items, generatedAt: new Date().toISOString() });
}
