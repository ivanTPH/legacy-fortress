import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { createLegalAuthorityDocumentUrl, LegalAuthorityActionError } from "@/lib/admin/legalAuthorities";

export async function GET(request: Request, { params }: { params: Promise<{ authorityId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:review");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  const { authorityId } = await params;
  try {
    const result = await createLegalAuthorityDocumentUrl(admin.adminClient, authorityId);
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_review",
      action: "Power of Attorney document viewed",
      result: "success",
      resourceType: "document",
      resourceId: authorityId,
      resourceLabel: result.fileName,
      route: "/api/internal/admin/legal-authorities/[authorityId]/document",
      metadata: { authority_id: authorityId, expires_in_seconds: result.expiresInSeconds },
    });
    return NextResponse.json({ ok: true, fileName: result.fileName, signedUrl: result.signedUrl, expiresInSeconds: result.expiresInSeconds });
  } catch (error) {
    if (error instanceof LegalAuthorityActionError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    throw error;
  }
}
