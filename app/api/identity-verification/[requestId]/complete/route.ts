import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { completeIdentityVerification } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
    const decision = await completeIdentityVerification(access.admin, requestId, access.user.id);
    return NextResponse.json({
      ok: true,
      decision: {
        status: decision.decision,
        identityLevel: decision.identityLevel,
        providerKey: decision.providerKey,
        providerAssuranceClass: decision.providerAssuranceClass,
        reasonCodes: decision.reasonCodes,
        requiresManualReview: decision.requiresManualReview,
        faceMatchScore: decision.faceMatchScore,
        faceMatchThreshold: decision.faceMatchThreshold,
        livenessResult: decision.livenessResult,
        expiresAt: decision.expiresAt,
      },
    });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
