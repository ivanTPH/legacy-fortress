import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { addEstateAdministrationDocument } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { claimId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "estate_document_file_required" }, { status: 400 });
    const document = await addEstateAdministrationDocument(access.admin, {
      claimId,
      uploaderUserId: access.user.id,
      file,
      documentType: String(form.get("documentType") ?? "other_estate_document"),
    });
    return NextResponse.json({ ok: true, document: { id: document.id, provenance: document.provenance } }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
