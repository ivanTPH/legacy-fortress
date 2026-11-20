import { NextResponse } from "next/server";
import { includeTestsFrom, loadAccounts, withoutTests } from "@/lib/admin/testAccounts";
import { loadAdminDashboardSummary, loadAdminFunnel } from "@/lib/admin/dashboardSummary";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const denied = requireAdminCapability(admin.access, "admin.dashboard.read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  // ?part=funnel: the sign-up funnel alone, fetched after the Overview has shown (counts only).
  if (new URL(request.url).searchParams.get("part") === "funnel") {
    return NextResponse.json({ ok: true, funnel: await loadAdminFunnel(admin.adminClient, { includeTests: includeTestsFrom(request) }) });
  }
  const summary = await loadAdminDashboardSummary(admin.adminClient, admin.access, { includeTests: includeTestsFrom(request) });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Admin dashboard summary opened",
    result: "success",
    resourceType: "access_policy",
    resourceLabel: "Admin dashboard summary",
    route: "/api/internal/admin/dashboard-summary",
    metadata: {
      metric_count: summary.metrics.length,
      unavailable_count: summary.metrics.filter((metric) => !metric.available).length,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, summary });
}
