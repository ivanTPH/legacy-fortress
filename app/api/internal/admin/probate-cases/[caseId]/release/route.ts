import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { EstateReleaseError, loadReleaseReadiness, releaseNominations } from "@/lib/admin/estateRelease";
import { getProbateCase } from "@/lib/admin/probateCases";

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) return NextResponse.json({ ok: false, message: denied.message }, { status: denied.status });
  const { caseId } = await params;
  const probateCase = await getProbateCase(admin.adminClient, caseId);
  const readiness = await loadReleaseReadiness(admin.adminClient, probateCase.ownerUserId);
  const hasGrantOfProbate = probateCase.evidence.some((item) => item.evidenceType === "probate_grant");
  return NextResponse.json({ ok: true, readiness, hasGrantOfProbate });
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "verification:decide");
  if (denied) return NextResponse.json({ ok: false, message: denied.message }, { status: denied.status });
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  if (!String(body.reason ?? "").trim()) return NextResponse.json({ ok: false, message: "Add decision notes before releasing." }, { status: 400 });
  const { caseId } = await params;
  const probateCase = await getProbateCase(admin.adminClient, caseId);
  try {
    const result = await releaseNominations(admin.adminClient, { ownerUserId: probateCase.ownerUserId, reviewerUserId: admin.access.user.id, probateCaseId: caseId });
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_approval",
      action: "Nominations released",
      result: "success",
      resourceType: "verification",
      resourceId: caseId,
      resourceLabel: probateCase.ownerName,
      route: "/api/internal/admin/probate-cases/[caseId]/release",
      metadata: { case_id: caseId, owner_user_id: probateCase.ownerUserId, released: result.released, waiting_for_id: result.waitingForId, not_joined: result.notJoined, decision_reason_present: true },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof EstateReleaseError) {
      await recordAdminAuditEvent(admin.adminClient, admin.access, {
        category: "admin_review", action: "Nominations release refused", result: "blocked", resourceType: "verification", resourceId: caseId,
        route: "/api/internal/admin/probate-cases/[caseId]/release", metadata: { case_id: caseId, blocked_reason: error.message },
      });
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
