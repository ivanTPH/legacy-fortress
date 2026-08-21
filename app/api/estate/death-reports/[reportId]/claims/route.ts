import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createEstateClaimFromReport } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { reportId } = await params;
    const body = (await request.json().catch(() => ({}))) as { roleClaimed?: string };
    const claim = await createEstateClaimFromReport(access.admin, {
      reportId,
      actorUserId: access.user.id,
      roleClaimed: body.roleClaimed ?? null,
    });
    return NextResponse.json({
      ok: true,
      claim: {
        id: claim.id,
        status: claim.status,
        authorityEvidenceStatus: claim.authority_evidence_status,
        requiredIdentityLevel: claim.required_identity_level,
      },
    }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
