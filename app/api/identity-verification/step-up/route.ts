import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { getCurrentIdentityAssuranceLevel, startIdentityVerification } from "@/lib/identity-verification/service";

const HIGH_RISK_ACTIONS = new Set([
  "death_claim",
  "probate_activation",
  "security_control_change",
  "estate_access_exception",
  "critical_identity_change",
]);

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = String(body.action ?? "").trim();
    if (!HIGH_RISK_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: "unsupported_high_risk_action" }, { status: 400 });
    }
    const currentLevel = await getCurrentIdentityAssuranceLevel(access.admin, access.user.id);
    if (currentLevel < 2) {
      return NextResponse.json({ ok: false, error: "level_2_required_for_step_up" }, { status: 403 });
    }
    const verification = await startIdentityVerification(access.admin, {
      userId: access.user.id,
      purpose: "step_up_presence",
      requestedIdentityLevel: 3,
    });
    return NextResponse.json({
      ok: true,
      verification: {
        id: verification.id,
        status: verification.status,
        requestedIdentityLevel: verification.requested_identity_level,
        purpose: verification.verification_purpose,
        action,
      },
    }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
