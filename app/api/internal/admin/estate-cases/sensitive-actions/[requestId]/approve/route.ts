import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { approveSensitiveEstateAction } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "estate_recovery_approve");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const { requestId } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ ok: false, message: "A reason is required." }, { status: 400 });
  const result = await approveSensitiveEstateAction(admin.adminClient, { requestId, approverUserId: admin.access.user.id, reason });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_approval",
    action: "Sensitive estate action approved",
    result: "success",
    resourceType: "verification",
    resourceId: requestId,
    resourceLabel: result.quorumMet ? "quorum met" : "approval recorded",
    route: "/api/internal/admin/estate-cases/sensitive-actions/[requestId]/approve",
    metadata: { request_id: requestId, quorum_met: result.quorumMet },
  });
  return NextResponse.json({ ok: true, result });
}
