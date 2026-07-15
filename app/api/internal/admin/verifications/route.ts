import { NextResponse } from "next/server";
import { applyVerificationAction, loadVerificationQueue, type VerificationAction } from "@/lib/admin/operations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const queue = await loadVerificationQueue(admin.adminClient);
  return NextResponse.json({ ok: true, queue });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    requestId?: string;
    action?: VerificationAction;
    reviewNotes?: string | null;
  };

  const requestId = String(body.requestId ?? "").trim();
  const action = body.action;
  if (!requestId || !action || !["approve", "reject", "review"].includes(action)) {
    return NextResponse.json({ ok: false, message: "A valid verification action is required." }, { status: 400 });
  }
  const capability = action === "review" ? "verification:review" : "verification:decide";
  const denied = requireAdminCapability(admin.access, capability);
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  if (["approve", "reject"].includes(action) && !String(body.reviewNotes ?? "").trim()) {
    return NextResponse.json({ ok: false, message: "Decision notes are required before approving or rejecting verification." }, { status: 400 });
  }

  await applyVerificationAction(admin.adminClient, {
    requestId,
    action,
    reviewNotes: body.reviewNotes ?? null,
    reviewedByUserId: admin.access.user.id,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: action === "approve" ? "admin_approval" : "admin_review",
    action: `Verification ${action}`,
    result: action === "reject" ? "rejected" : "success",
    resourceType: "verification",
    resourceId: requestId,
    resourceLabel: "Executor verification request",
    route: "/api/internal/admin/verifications",
    metadata: { action, review_notes_present: Boolean(String(body.reviewNotes ?? "").trim()) },
  });

  const queue = await loadVerificationQueue(admin.adminClient);
  return NextResponse.json({ ok: true, queue });
}
