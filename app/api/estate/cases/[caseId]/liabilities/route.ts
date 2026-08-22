import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { addEstateLiability } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as { creditorName?: string; amountMinor?: number; category?: string };
    const liability = await addEstateLiability(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      creditorName: String(body.creditorName ?? "").trim(),
      amountMinor: Number(body.amountMinor ?? 0),
      category: body.category,
    });
    return NextResponse.json({ ok: true, liability }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
