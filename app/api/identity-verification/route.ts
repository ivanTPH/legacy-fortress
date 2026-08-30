import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { isInternalExperimentalProviderAllowed, startIdentityVerification, validateSimulatorScenario } from "@/lib/identity-verification/service";
import type { IdentityVerificationPurpose } from "@/lib/identity-verification/types";

const PURPOSES = new Set(["linked_access", "registration_required", "step_up_presence", "admin_review"]);

export async function GET(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const rows = await access.admin
    .from("identity_verification_requests")
    .select("id,verification_purpose,provider_key,status,requested_identity_level,achieved_identity_level,related_access_grant_id,manual_review_required,submitted_at,verified_at,expires_at,evidence_retention_until,created_at,updated_at")
    .eq("user_id", access.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (rows.error) return NextResponse.json({ ok: false, error: rows.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, requests: rows.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      purpose?: string;
      requestedIdentityLevel?: number;
      invitationId?: string | null;
      accessGrantId?: string | null;
      simulatorScenario?: string | null;
    };
    const purpose = String(body.purpose ?? "linked_access");
    if (!PURPOSES.has(purpose)) {
      return NextResponse.json({ ok: false, error: "invalid_identity_verification_purpose" }, { status: 400 });
    }
    const requestedIdentityLevel = Number(body.requestedIdentityLevel ?? (purpose === "step_up_presence" ? 3 : 2));
    if (requestedIdentityLevel !== 2 && requestedIdentityLevel !== 3) {
      return NextResponse.json({ ok: false, error: "invalid_identity_level" }, { status: 400 });
    }
    const simulatorScenario = body.simulatorScenario == null ? null : validateSimulatorScenario(body.simulatorScenario);
    if (body.simulatorScenario != null && (!isInternalExperimentalProviderAllowed() || !simulatorScenario)) {
      return NextResponse.json({ ok: false, error: "invalid_simulator_scenario" }, { status: 400 });
    }
    const verification = await startIdentityVerification(access.admin, {
      userId: access.user.id,
      purpose: purpose as IdentityVerificationPurpose,
      requestedIdentityLevel,
      invitationId: body.invitationId ?? null,
      accessGrantId: body.accessGrantId ?? null,
      simulatorScenario,
    });
    return NextResponse.json({
      ok: true,
      verification: publicRequest(verification),
    }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}

function publicRequest(row: Record<string, unknown>) {
  return {
    id: row.id,
    purpose: row.verification_purpose,
    providerKey: row.provider_key,
    status: row.status,
    requestedIdentityLevel: row.requested_identity_level,
    achievedIdentityLevel: row.achieved_identity_level,
    manualReviewRequired: row.manual_review_required,
    expiresAt: row.expires_at,
  };
}
