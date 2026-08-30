import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { generateSyntheticDocumentEvidence, uploadDocumentEvidence, isInternalExperimentalProviderAllowed } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as { synthetic?: boolean; documentType?: string; side?: string };
      if (!body.synthetic || !isInternalExperimentalProviderAllowed()) throw new Error("synthetic_provider_not_enabled");
      const documentType = String(body.documentType ?? "");
      if (!("passport" === documentType || "driving_licence" === documentType || "national_identity_document" === documentType)) throw new Error("synthetic_document_type_invalid");
      const document = await generateSyntheticDocumentEvidence(access.admin, { userId: access.user.id, requestId, documentSide: body.side === "back" ? "back" : "front", documentType });
      return NextResponse.json({ ok: true, synthetic: true, document: { id: document.id, side: document.document_side, documentType: document.document_type, documentCountry: document.document_country, extractionStatus: document.extraction_status, extractionConfidence: document.extraction_confidence, extractionWarnings: document.extraction_warnings } });
    }
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
