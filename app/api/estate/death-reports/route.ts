import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createDeathReport } from "@/lib/estate-lifecycle/service";

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      ownerUserId?: string;
      claimantRole?: string;
      relationship?: string;
      dateOfDeath?: string;
      declarationAccepted?: boolean;
    };
    const ownerUserId = String(body.ownerUserId ?? "").trim();
    if (!ownerUserId) return NextResponse.json({ ok: false, error: "owner_user_id_required" }, { status: 400 });
    const report = await createDeathReport(access.admin, {
      ownerUserId,
      claimantUserId: access.user.id,
      claimantRole: String(body.claimantRole ?? "other"),
      relationship: body.relationship ?? null,
      dateOfDeath: body.dateOfDeath ?? null,
      declarationAccepted: body.declarationAccepted === true,
      metadata: { source_route: "/api/estate/death-reports" },
    });
    return NextResponse.json({ ok: true, report: publicDeathReport(report) }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}

function publicDeathReport(report: { id: string; owner_user_id: string; status: string; claimant_role: string; date_of_death: string | null; submitted_at: string | null }) {
  return {
    id: report.id,
    ownerUserId: report.owner_user_id,
    status: report.status,
    claimantRole: report.claimant_role,
    dateOfDeath: report.date_of_death,
    submittedAt: report.submitted_at,
  };
}
