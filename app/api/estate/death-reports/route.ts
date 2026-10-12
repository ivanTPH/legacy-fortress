import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createDeathReport } from "@/lib/estate-lifecycle/service";
import { ACTIVE_PROTECTED_GRANT_STATUSES } from "@/lib/access-control/securityPolicy";

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
    const relationship = await access.admin
      .from("account_access_grants")
      .select("assigned_role,relationship,activation_status")
      .eq("owner_user_id", ownerUserId)
      .eq("linked_user_id", access.user.id)
      .in("activation_status", ACTIVE_PROTECTED_GRANT_STATUSES)
      .in("assigned_role", ["executor", "trustee", "power_of_attorney"])
      .limit(1)
      .maybeSingle();
    if (relationship.error || !relationship.data) {
      return NextResponse.json({ ok: false, error: "estate_relationship_required" }, { status: 403 });
    }
    const report = await createDeathReport(access.admin, {
      ownerUserId,
      claimantUserId: access.user.id,
      claimantRole: String(relationship.data.assigned_role ?? "other"),
      relationship: relationship.data.relationship ?? body.relationship ?? null,
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
