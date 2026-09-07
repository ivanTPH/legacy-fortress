import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { sensitiveActionErrorResponse } from "@/lib/estate-administration/api";
import { approveSensitiveEstateAction } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string; requestId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId, requestId } = await params;
    const requestRow = await access.admin
      .from("sensitive_action_requests")
      .select("id")
      .eq("id", requestId)
      .eq("estate_case_id", caseId)
      .maybeSingle();
    if (requestRow.error) throw new Error(requestRow.error.message);
    if (!requestRow.data) throw new Error("sensitive_action_not_found");
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ ok: false, error: "A reason is required." }, { status: 400 });
    const result = await approveSensitiveEstateAction(access.admin, {
      requestId,
      approverUserId: access.user.id,
      reason,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return sensitiveActionErrorResponse(error);
  }
}
