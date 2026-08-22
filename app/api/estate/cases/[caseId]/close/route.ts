import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { closeEstateCase } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const estateCase = await closeEstateCase(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      reason: String(body.reason ?? "").trim(),
    });
    return NextResponse.json({ ok: true, estateCase });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
