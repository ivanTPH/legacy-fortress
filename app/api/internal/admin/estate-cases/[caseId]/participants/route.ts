import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { addEstateParticipant } from "@/lib/estate-administration/service";
import type { EstatePermission } from "@/lib/estate-administration/types";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "estate_access_manage");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const { caseId } = await params;
  const body = (await request.json().catch(() => ({}))) as { userId?: string; role?: string; permissions?: string[]; estateClaimId?: string; personType?: string; reason?: string };
  const reason = String(body.reason ?? "").trim();
  if (!body.userId || !reason) return NextResponse.json({ ok: false, message: "userId and reason are required." }, { status: 400 });
  const participant = await addEstateParticipant(admin.adminClient, {
    estateCaseId: caseId,
    userId: body.userId,
    role: body.role ?? "other",
    permissions: (Array.isArray(body.permissions) ? body.permissions : []) as EstatePermission[],
    addedByUserId: admin.access.user.id,
    estateClaimId: body.estateClaimId ?? null,
    personType: body.personType ?? "individual",
    reason,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_approval",
    action: "Estate participant added",
    result: "success",
    resourceType: "verification",
    resourceId: participant.id,
    resourceLabel: participant.participant_role,
    route: "/api/internal/admin/estate-cases/[caseId]/participants",
    metadata: { estate_case_id: caseId, participant_id: participant.id, permission_count: body.permissions?.length ?? 0 },
  });
  return NextResponse.json({ ok: true, participant }, { status: 201 });
}
