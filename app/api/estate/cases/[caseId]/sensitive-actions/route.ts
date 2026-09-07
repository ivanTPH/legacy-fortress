import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { sensitiveActionErrorResponse } from "@/lib/estate-administration/api";
import { requestSensitiveEstateAction } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as { actionType?: string; targetType?: string; targetId?: string; justification?: string; requiredApprovals?: number };
    const requestRow = await requestSensitiveEstateAction(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      actionType: String(body.actionType ?? "exceptional_recovery"),
      targetType: String(body.targetType ?? "estate_case"),
      targetId: body.targetId ?? null,
      justification: String(body.justification ?? "").trim(),
      requiredApprovals: body.requiredApprovals,
    });
    return NextResponse.json({ ok: true, request: requestRow }, { status: 201 });
  } catch (error) {
    return sensitiveActionErrorResponse(error);
  }
}
