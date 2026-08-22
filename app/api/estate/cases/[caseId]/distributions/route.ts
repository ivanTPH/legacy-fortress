import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { addEstateDistribution } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as { description?: string; amountMinor?: number; status?: string };
    const distribution = await addEstateDistribution(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      description: String(body.description ?? "").trim(),
      amountMinor: Number(body.amountMinor ?? 0),
      status: body.status,
    });
    return NextResponse.json({ ok: true, distribution }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
