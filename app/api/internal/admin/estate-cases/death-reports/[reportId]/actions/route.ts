import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { applyDeathReportAction, normalizeDeathReportAction } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:decide");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });

  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
  const action = normalizeDeathReportAction(body.action);
  if (!action) return NextResponse.json({ ok: false, message: "A valid death report action is required." }, { status: 400 });
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ ok: false, message: "A reason is required for estate security actions." }, { status: 400 });
  const { reportId } = await params;
  const report = await applyDeathReportAction(admin.adminClient, {
    reportId,
    action,
    actorUserId: admin.access.user.id,
    actorType: "admin",
    reason,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: `Estate death report ${action.replace(/_/g, " ")}`,
    result: action.includes("reject") ? "rejected" : "success",
    resourceType: "verification",
    resourceId: report.id,
    resourceLabel: report.status,
    route: "/api/internal/admin/estate-cases/death-reports/[reportId]/actions",
    metadata: {
      death_report_id: report.id,
      owner_user_id: report.owner_user_id,
      action,
      reason_present: true,
    },
  });
  return NextResponse.json({ ok: true, report: { id: report.id, status: report.status } });
}
