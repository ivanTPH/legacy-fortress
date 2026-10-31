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
      nominationRef?: string;
      claimantRole?: string;
      relationship?: string;
      dateOfDeath?: string;
      declarationAccepted?: boolean;
    };
    // Executors, trustees and attorneys report by owner; a nominee reports through their
    // nomination reference (owner decision 30 Oct 2026: any nominee or executor may report).
    const nominationRef = String(body.nominationRef ?? "").trim();
    let ownerUserId = String(body.ownerUserId ?? "").trim();
    let claimantRole = "";
    let claimantRelationship: string | null = null;
    if (nominationRef) {
      const nominee = await resolveNomineeReporter(access.admin, nominationRef, access.user.id);
      if (!nominee) return NextResponse.json({ ok: false, error: "estate_relationship_required" }, { status: 403 });
      ownerUserId = nominee.ownerUserId;
      claimantRole = "family_member";
      claimantRelationship = nominee.relationship;
    } else {
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
      claimantRole = String(relationship.data.assigned_role ?? "other");
      claimantRelationship = relationship.data.relationship ?? null;
    }
    const report = await createDeathReport(access.admin, {
      ownerUserId,
      claimantUserId: access.user.id,
      claimantRole,
      relationship: claimantRelationship ?? body.relationship ?? null,
      dateOfDeath: body.dateOfDeath ?? null,
      declarationAccepted: body.declarationAccepted === true,
      metadata: { source_route: "/api/estate/death-reports", reported_as: nominationRef ? "nominee" : "estate_role" },
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

type AdminClient = Awaited<ReturnType<typeof requireIdentityApiAccess>> extends infer T ? T extends { ok: true; admin: infer A } ? A : never : never;

/** A nominee who has joined, accepted the invitation and been told about the nomination. */
async function resolveNomineeReporter(admin: AdminClient, nominationRef: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(nominationRef)) return null;
  const nomination = await admin.from("vault_nominations").select("id,owner_user_id,person_id,status,notify_person")
    .eq("id", nominationRef).eq("status", "active").eq("notify_person", true).maybeSingle();
  if (nomination.error || !nomination.data) return null;
  const contact = await admin.from("contacts").select("id,linked_user_id,relationship")
    .eq("id", nomination.data.person_id).eq("owner_user_id", nomination.data.owner_user_id).maybeSingle();
  if (contact.error || contact.data?.linked_user_id !== userId) return null;
  const invitation = await admin.from("contact_invitations").select("id")
    .eq("contact_id", contact.data.id).eq("owner_user_id", nomination.data.owner_user_id)
    .eq("accepted_user_id", userId).in("invitation_status", ["accepted", "verified", "active"]).limit(1).maybeSingle();
  if (invitation.error || !invitation.data) return null;
  return { ownerUserId: String(nomination.data.owner_user_id), relationship: (contact.data.relationship as string | null) ?? null };
}
