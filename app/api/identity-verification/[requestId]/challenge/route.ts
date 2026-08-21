import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createPresenceChallenge } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
    const { challenge } = await createPresenceChallenge(access.admin, requestId, access.user.id);
    return NextResponse.json({
      ok: true,
      challenge: {
        id: challenge.id,
        type: challenge.challenge_type,
        prompt: challenge.challenge_prompt,
        status: challenge.status,
        expiresAt: challenge.expires_at,
      },
    });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
