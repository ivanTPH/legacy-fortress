import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { applyEstateClaimAction, normalizeEstateClaimAction } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:decide");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });

  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string; estateDocumentIds?: string[] };
  const action = normalizeEstateClaimAction(body.action);
  if (!action) return NextResponse.json({ ok: false, message: "A valid estate claim action is required." }, { status: 400 });
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ ok: false, message: "A reason is required for estate claim actions." }, { status: 400 });
  const { claimId } = await params;
  const claim = await applyEstateClaimAction(admin.adminClient, {
    claimId,
    action,
    actorUserId: admin.access.user.id,
    reason,
    estateDocumentIds: Array.isArray(body.estateDocumentIds) ? body.estateDocumentIds.map(String) : [],
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: action === "approve" ? "admin_approval" : "admin_review",
    action: `Estate claim ${action.replace(/_/g, " ")}`,
    result: action === "reject" ? "rejected" : action === "suspend" || action === "revoke" ? "blocked" : "success",
    resourceType: "verification",
    resourceId: claim.id,
    resourceLabel: claim.status,
    route: "/api/internal/admin/estate-cases/claims/[claimId]/actions",
    metadata: {
      estate_claim_id: claim.id,
      death_report_id: claim.death_report_id,
      owner_user_id: claim.owner_user_id,
      action,
      reason_present: true,
    },
  });
  return NextResponse.json({ ok: true, claim: { id: claim.id, status: claim.status } });
}
