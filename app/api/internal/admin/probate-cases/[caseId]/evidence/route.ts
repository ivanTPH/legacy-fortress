import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { addProbateCaseEvidence, getProbateCase, normalizeEvidenceType } from "@/lib/admin/probateCases";

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const { caseId } = await params;
  const probateCase = await getProbateCase(admin.adminClient, caseId);
  return NextResponse.json({ ok: true, evidence: probateCase.evidence });
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:review");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Evidence file is required." }, { status: 400 });
  }
  const evidenceType = normalizeEvidenceType(String(form.get("evidenceType") ?? ""));
  const { caseId } = await params;
  const evidence = await addProbateCaseEvidence(admin.adminClient, {
    caseId,
    file,
    evidenceType,
    uploadedByUserId: admin.access.user.id,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Probate evidence uploaded",
    result: "success",
    resourceType: "document",
    resourceId: evidence.id,
    resourceLabel: evidence.fileName,
    route: "/api/internal/admin/probate-cases/[caseId]/evidence",
    metadata: {
      case_id: caseId,
      evidence_type: evidence.evidenceType,
      file_name: evidence.fileName,
      mime_type: evidence.mimeType,
      size_bytes: evidence.sizeBytes,
    },
  });

  return NextResponse.json({ ok: true, evidence });
}
