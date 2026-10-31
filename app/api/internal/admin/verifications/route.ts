import { NextResponse } from "next/server";
import { applyVerificationAction, loadVerificationQueue, type VerificationAction } from "@/lib/admin/operations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { INHOUSE_REVIEW_PROVIDER_KEY } from "@/lib/identity-verification/inhouseReviewProvider";
import { recordReviewerDecision } from "@/lib/identity-verification/service";

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
  if (!requestId || !action || !["approve", "reject", "review", "retry", "assign_to_me", "add_note"].includes(action)) {
    return NextResponse.json({ ok: false, message: "A valid verification action is required." }, { status: 400 });
  }
  const capability = ["review", "retry", "assign_to_me", "add_note"].includes(action) ? "verification:review" : "verification:decide";
  const denied = requireAdminCapability(admin.access, capability);
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  if (["approve", "reject"].includes(action) && !String(body.reviewNotes ?? "").trim()) {
    return NextResponse.json({ ok: false, message: "Decision notes are required before approving or rejecting verification." }, { status: 400 });
  }
  if (action === "add_note" && !String(body.reviewNotes ?? "").trim()) {
    return NextResponse.json({ ok: false, message: "A review note is required." }, { status: 400 });
  }

  // Reviewer check (document photo + live selfie compared by a person): decided here, server only.
  const identityRequest = ["approve", "reject"].includes(action)
    ? await admin.adminClient.from("identity_verification_requests").select("id,provider_key").eq("id", requestId).maybeSingle()
    : { data: null };
  if (identityRequest.data && identityRequest.data.provider_key === INHOUSE_REVIEW_PROVIDER_KEY) {
    try {
      await recordReviewerDecision(admin.adminClient, { requestId, reviewerUserId: admin.access.user.id, approve: action === "approve", reasonCode: "reviewer_notes_recorded" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "identity_review_failed";
      const message = code === "identity_self_review_not_permitted" ? "You can’t review your own ID check." : code === "identity_review_not_pending" ? "This check has already been decided." : "The decision didn’t save.";
      return NextResponse.json({ ok: false, message }, { status: 409 });
    }
    const note = String(body.reviewNotes ?? "").trim().slice(0, 4000);
    if (note) await admin.adminClient.from("identity_verification_review_notes").insert({ request_id: requestId, note, created_by: admin.access.user.id });
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: action === "approve" ? "admin_approval" : "admin_review",
      action: `Identity check ${action === "approve" ? "approved" : "rejected"}`,
      result: action === "approve" ? "success" : "rejected",
      resourceType: "verification",
      resourceId: requestId,
      resourceLabel: "Reviewer identity check",
      route: "/api/internal/admin/verifications",
      metadata: { action, review_notes_present: true, evidence_deleted: true },
    });
    const queue = await loadVerificationQueue(admin.adminClient);
    return NextResponse.json({ ok: true, queue });
  }

  await applyVerificationAction(admin.adminClient, {
    requestId,
    action,
    reviewNotes: body.reviewNotes ?? null,
    reviewedByUserId: admin.access.user.id,
    note: body.reviewNotes ?? null,
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
