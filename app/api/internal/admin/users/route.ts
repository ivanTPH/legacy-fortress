import { NextResponse } from "next/server";
import { includeTestsFrom } from "@/lib/admin/testAccounts";
import { countNewAccounts, lookupUsers } from "@/lib/admin/operations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

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
  const query = url.searchParams.get("q") ?? "";
  const includeTests = includeTestsFrom(request);
  const users = await lookupUsers(admin.adminClient, query, includeTests);
  const newThisWeek = query.trim() ? null : await countNewAccounts(admin.adminClient, 7, Date.now(), includeTests);
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Admin user lookup",
    result: "success",
    resourceType: "access_policy",
    resourceId: null,
    resourceLabel: "User lookup",
    route: "/api/internal/admin/users",
    metadata: { query_present: Boolean(query.trim()), result_count: users.length, include_tests: includeTests },
  });
  return NextResponse.json({ ok: true, users, newThisWeek });
}
