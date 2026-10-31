import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  applyLegalAuthorityAction,
  isDecisionAction,
  LegalAuthorityActionError,
  normalizeLegalAuthorityAction,
} from "@/lib/admin/legalAuthorities";

export async function POST(request: Request, { params }: { params: Promise<{ authorityId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string; messageToOwner?: string };
  const action = normalizeLegalAuthorityAction(body.action);
  if (!action) return NextResponse.json({ ok: false, message: "Choose a valid step." }, { status: 400 });
  const denied = requireAdminCapability(admin.access, isDecisionAction(action) ? "verification:decide" : "verification:review");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ ok: false, message: "Add decision notes before changing an authority." }, { status: 400 });

  const { authorityId } = await params;
  let authority;
  try {
    authority = await applyLegalAuthorityAction(admin.adminClient, {
      authorityId,
      action,
      messageToOwner: String(body.messageToOwner ?? ""),
      reviewerUserId: admin.access.user.id,
    });
  } catch (error) {
    if (error instanceof LegalAuthorityActionError) {
      await recordAdminAuditEvent(admin.adminClient, admin.access, {
        category: "admin_review",
        action: `Power of Attorney ${action.replace(/_/g, " ")}`,
        result: "blocked",
        resourceType: "verification",
        resourceId: authorityId,
        route: "/api/internal/admin/legal-authorities/[authorityId]/actions",
        metadata: { authority_id: authorityId, action, blocked_reason: error.message },
      });
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    throw error;
  }
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: action === "activate" || action === "confirm" ? "admin_approval" : "admin_review",
    action: `Power of Attorney ${action.replace(/_/g, " ")}`,
    result: action === "reject" ? "rejected" : "success",
    resourceType: "verification",
    resourceId: authorityId,
    resourceLabel: authority?.attorneyName,
    route: "/api/internal/admin/legal-authorities/[authorityId]/actions",
    metadata: {
      authority_id: authorityId,
      action,
      owner_user_id: authority?.ownerUserId,
      decision_reason_present: true,
      access_started: action === "activate",
      access_stopped: action === "end",
    },
  });
  return NextResponse.json({ ok: true, authority });
}
