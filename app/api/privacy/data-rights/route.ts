import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createPrivacyDataRightsCase } from "@/lib/privacy-security/privacy";

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { requestType?: string; scope?: Record<string, unknown>; syntheticRunMarker?: string };
    const privacyCase = await createPrivacyDataRightsCase(access.admin, {
      requesterUserId: access.user.id,
      subjectUserId: access.user.id,
      requestType: String(body.requestType ?? "other_privacy_enquiry"),
      scope: body.scope ?? {},
      syntheticRunMarker: body.syntheticRunMarker ?? null,
    });
    return NextResponse.json({ ok: true, privacyCase }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
