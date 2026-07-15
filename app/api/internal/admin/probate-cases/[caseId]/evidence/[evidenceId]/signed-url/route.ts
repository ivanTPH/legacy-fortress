import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { createProbateEvidenceSignedUrl } from "@/lib/admin/probateCases";

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string; evidenceId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:review");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const { caseId, evidenceId } = await params;
  const result = await createProbateEvidenceSignedUrl(admin.adminClient, { caseId, evidenceId });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Probate evidence viewed",
    result: "success",
    resourceType: "document",
    resourceId: result.evidence.id,
    resourceLabel: result.evidence.fileName,
    route: "/api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url",
    metadata: {
      case_id: caseId,
      evidence_type: result.evidence.evidenceType,
      expires_in_seconds: result.expiresInSeconds,
    },
  });

  return NextResponse.json({ ok: true, evidence: result.evidence, signedUrl: result.signedUrl, expiresInSeconds: result.expiresInSeconds });
}
