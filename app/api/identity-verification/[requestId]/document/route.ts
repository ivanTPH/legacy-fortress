import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { uploadDocumentEvidence } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const side = String(form.get("side") ?? "front") === "back" ? "back" : "front";
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "identity_document_file_required" }, { status: 400 });
    }
    const document = await uploadDocumentEvidence(access.admin, {
      userId: access.user.id,
      requestId,
      file,
      documentSide: side,
    });
    return NextResponse.json({
      ok: true,
      document: {
        id: document.id,
        side: document.document_side,
        documentType: document.document_type,
        documentCountry: document.document_country,
        extractionStatus: document.extraction_status,
        extractionConfidence: document.extraction_confidence,
        extractionWarnings: document.extraction_warnings,
      },
    });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
