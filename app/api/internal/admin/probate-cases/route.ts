import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { loadProbateCases, submitProbateCaseFromVerification } from "@/lib/admin/probateCases";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const cases = await loadProbateCases(admin.adminClient);
  return NextResponse.json({ ok: true, cases });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:review");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const body = (await request.json().catch(() => ({}))) as { verificationRequestId?: string };
  const verificationRequestId = String(body.verificationRequestId ?? "").trim();
  if (!verificationRequestId) {
    return NextResponse.json({ ok: false, message: "Verification request id is required." }, { status: 400 });
  }

  const probateCase = await submitProbateCaseFromVerification(admin.adminClient, {
    verificationRequestId,
    reviewerUserId: admin.access.user.id,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Probate case submitted",
    result: "success",
    resourceType: "verification",
    resourceId: probateCase.id,
    resourceLabel: probateCase.contactName,
    route: "/api/internal/admin/probate-cases",
    metadata: {
      case_id: probateCase.id,
      verification_request_id: verificationRequestId,
      owner_user_id: probateCase.ownerUserId,
      applicant_user_id_present: Boolean(probateCase.applicantUserId),
    },
  });

  return NextResponse.json({ ok: true, case: probateCase });
}
