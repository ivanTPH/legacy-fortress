import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { recordConsentPreference, recordMarketingObjection } from "@/lib/privacy-security/privacy";

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      purpose?: string;
      status?: "given" | "withdrawn" | "objected" | "not_required";
      channel?: string;
      partnerOrganisationId?: string | null;
      syntheticRunMarker?: string;
    };
    if (body.status === "objected" || body.purpose === "marketing_objection") {
      const suppression = await recordMarketingObjection(access.admin, {
        userId: access.user.id,
        actorUserId: access.user.id,
        channel: body.channel ?? "all",
        partnerOrganisationId: body.partnerOrganisationId ?? null,
        reason: "User recorded a marketing objection.",
        syntheticRunMarker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, suppression }, { status: 201 });
    }
    const consent = await recordConsentPreference(access.admin, {
      userId: access.user.id,
      purpose: String(body.purpose ?? "service"),
      status: body.status ?? "given",
      channel: body.channel ?? "in_app",
      partnerOrganisationId: body.partnerOrganisationId ?? null,
      noticeVersion: "phase5-2026-08",
      noticeReference: "phase5-contextual-preference",
      source: "privacy_preferences",
      syntheticRunMarker: body.syntheticRunMarker ?? null,
    });
    return NextResponse.json({ ok: true, consent }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
