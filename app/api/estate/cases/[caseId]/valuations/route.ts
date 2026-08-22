import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { addEstateValuation } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as { assetId?: string; amountMinor?: number; valuerName?: string };
    const valuation = await addEstateValuation(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      assetId: body.assetId ?? null,
      amountMinor: Number(body.amountMinor ?? 0),
      valuerName: body.valuerName ?? null,
    });
    return NextResponse.json({ ok: true, valuation }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
