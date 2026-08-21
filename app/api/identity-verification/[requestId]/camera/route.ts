import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { uploadCameraEvidence } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
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
