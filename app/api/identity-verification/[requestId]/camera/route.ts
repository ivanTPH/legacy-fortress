import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { isInternalExperimentalProviderAllowed, uploadCameraEvidence, generateSyntheticCameraEvidence } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as { synthetic?: boolean; challengeId?: string };
      if (!body.synthetic || !isInternalExperimentalProviderAllowed() || !body.challengeId) throw new Error("synthetic_provider_not_enabled");
      const result = await generateSyntheticCameraEvidence(access.admin, { userId: access.user.id, requestId, challengeId: body.challengeId });
      return NextResponse.json({ ok: true, synthetic: true, liveness: { result: result.liveness.result, confidence: result.liveness.confidence, reasonCodes: result.liveness.reasonCodes } });
    }
    const form = await request.formData();
    const file = form.get("file");
    const challengeId = String(form.get("challengeId") ?? "");
    if (!(file instanceof File) || !challengeId) {
      return NextResponse.json({ ok: false, error: "camera_capture_and_challenge_required" }, { status: 400 });
    }
    const result = await uploadCameraEvidence(access.admin, {
      userId: access.user.id,
      requestId,
      challengeId,
      file,
    });
    return NextResponse.json({
      ok: true,
      liveness: {
        result: result.liveness.result,
        confidence: result.liveness.confidence,
        reasonCodes: result.liveness.reasonCodes,
      },
    });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
