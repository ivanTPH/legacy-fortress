import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { revokeSensitiveEstateApproval } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "estate_recovery_approve");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ ok: false, message: "A reason is required to revoke an approval." }, { status: 400 });
  const { approvalId } = await params;
  try {
    const approval = await revokeSensitiveEstateApproval(admin.adminClient, { approvalId, actorUserId: admin.access.user.id, reason });
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_approval",
      action: "Sensitive estate approval revoked",
      result: "blocked",
      resourceType: "verification",
      resourceId: approval.request_id,
      resourceLabel: "approval revoked",
      route: "/api/internal/admin/estate-cases/sensitive-actions/approvals/[approvalId]/revoke",
      metadata: { approval_id: approval.id, reason_present: true },
    });
    return NextResponse.json({ ok: true, approval });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Approval revocation failed." }, { status: 409 });
  }
}
