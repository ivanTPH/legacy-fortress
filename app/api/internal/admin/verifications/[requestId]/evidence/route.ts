import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { createReviewerEvidenceLinks } from "@/lib/identity-verification/service";

/**
 * Reviewer check evidence: the document photo and live selfie, as links that expire in 60 seconds.
 * Decide-level reviewers only; every view is recorded. Never written to logs or audit metadata.
 */
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "verification:decide");
  if (denied) return NextResponse.json({ ok: false, message: denied.message }, { status: denied.status });
  const { requestId } = await params;
  try {
    const links = await createReviewerEvidenceLinks(admin.adminClient, requestId);
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_review",
      action: "Identity evidence viewed",
      result: "success",
      resourceType: "verification",
      resourceId: requestId,
      route: "/api/internal/admin/verifications/[requestId]/evidence",
      metadata: { document_present: Boolean(links.documentUrl), selfie_present: Boolean(links.selfieUrl), expires_in_seconds: links.expiresInSeconds },
    });
    return NextResponse.json({ ok: true, ...links }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "identity_evidence_unavailable";
    return NextResponse.json({ ok: false, message: message === "identity_review_not_pending" ? "This check has already been decided. Its photos have been deleted." : "The photos aren’t available." }, { status: 409 });
  }
}
