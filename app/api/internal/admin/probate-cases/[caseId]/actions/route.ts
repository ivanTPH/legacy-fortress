import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { applyProbateCaseAction, normalizeProbateCaseAction, ProbateCaseTransitionError } from "@/lib/admin/probateCases";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
  const action = normalizeProbateCaseAction(body.action);
  if (!action) {
    return NextResponse.json({ ok: false, message: "A valid probate case action is required." }, { status: 400 });
  }
  const capability = ["approve", "reject", "revoke"].includes(action) ? "verification:decide" : "verification:review";
  const denied = requireAdminCapability(admin.access, capability);
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json({ ok: false, message: "Decision notes are required before changing a probate case." }, { status: 400 });
  }

  const { caseId } = await params;
  let probateCase;
  try {
    probateCase = await applyProbateCaseAction(admin.adminClient, {
      caseId,
      action,
      reason,
      reviewerUserId: admin.access.user.id,
    });
  } catch (error) {
    if (error instanceof ProbateCaseTransitionError) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code },
        { status: error.status },
      );
    }
    throw error;
  }
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: action === "approve" ? "admin_approval" : "admin_review",
    action: `Probate case ${action.replace(/_/g, " ")}`,
    result: action === "reject" ? "rejected" : action === "revoke" ? "blocked" : "success",
    resourceType: "verification",
    resourceId: probateCase.id,
    resourceLabel: probateCase.contactName,
    route: "/api/internal/admin/probate-cases/[caseId]/actions",
    metadata: {
      case_id: probateCase.id,
      action,
      owner_user_id: probateCase.ownerUserId,
      applicant_user_id_present: Boolean(probateCase.applicantUserId),
      access_grant_id_present: Boolean(probateCase.accessGrantId),
      decision_reason_present: true,
    },
  });

  return NextResponse.json({ ok: true, case: probateCase });
}
