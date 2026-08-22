import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { addEstateAdministrationDocumentVersion } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "estate_document_file_required" }, { status: 400 });
    const document = await addEstateAdministrationDocumentVersion(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      file,
      documentCategory: String(form.get("documentCategory") ?? "other_estate_document"),
      priorVersionId: String(form.get("priorVersionId") ?? "").trim() || null,
      purpose: String(form.get("purpose") ?? "").trim() || null,
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    return NextResponse.json({ ok: true, document }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
