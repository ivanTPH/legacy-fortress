import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { uploadDeathReportEvidence } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { reportId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "estate_evidence_file_required" }, { status: 400 });
    const evidence = await uploadDeathReportEvidence(access.admin, {
      reportId,
      uploaderUserId: access.user.id,
      file,
      evidenceType: String(form.get("evidenceType") ?? "other_supporting_evidence"),
    });
    return NextResponse.json({ ok: true, evidence: { id: evidence.id } });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
