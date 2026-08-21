import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { cleanupExpiredIdentityEvidence } from "@/lib/identity-verification/service";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { requestId } = await context.params;
    const result = await cleanupExpiredIdentityEvidence(access.admin, access.user.id, requestId);
    return NextResponse.json({ ok: true, cleanup: result });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
