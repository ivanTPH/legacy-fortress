import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { applyDeathReportAction } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { reportId } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const report = await applyDeathReportAction(access.admin, {
      reportId,
      action: "start_owner_recovery",
      actorUserId: access.user.id,
      actorType: "owner",
      reason: String(body.reason ?? "Owner disputes death report and requests controlled recovery."),
    });
    return NextResponse.json({ ok: true, report: { id: report.id, status: report.status } });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
