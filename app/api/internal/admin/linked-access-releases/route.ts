import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";

type ReleaseState = "ATTORNEY_LIMITED" | "ESTATE_RELEASED" | "REVOKED";

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const state = String(body.state ?? "") as ReleaseState;
  if (!["ATTORNEY_LIMITED", "ESTATE_RELEASED", "REVOKED"].includes(state)) {
    return NextResponse.json({ ok: false, message: "A valid release decision is required." }, { status: 400 });
  }
  const denied = requireAdminCapability(admin.access, state === "ATTORNEY_LIMITED" ? "verification:decide" : "estate_access_manage");
  if (denied) return NextResponse.json({ ok: false, message: denied.message }, { status: denied.status });
  const grantId = String(body.grantId ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(grantId) || reason.length < 12) {
    return NextResponse.json({ ok: false, message: "Grant ID and a substantive review reason are required." }, { status: 400 });
  }
  if (state === "ATTORNEY_LIMITED" && (!String(body.authorityReference ?? "").trim() || !body.authorityExpiresAt)) {
    return NextResponse.json({ ok: false, message: "Current legal-authority evidence and expiry are required." }, { status: 400 });
  }
  if (state === "ESTATE_RELEASED" && !body.claimId) {
    return NextResponse.json({ ok: false, message: "An approved estate claim is required." }, { status: 400 });
  }

  const result = await admin.adminClient.rpc("lf_authorize_linked_release", {
    p_grant_id: grantId,
    p_state: state,
    p_scope: body.scope ?? (state === "ATTORNEY_LIMITED" ? [] : {}),
    p_claim_id: body.claimId ?? null,
    p_authority_expires_at: body.authorityExpiresAt ?? null,
    p_authority_reference: body.authorityReference ?? null,
    p_actor_user_id: admin.access.user.id,
    p_reason: reason,
  });
  if (result.error) {
    return NextResponse.json({ ok: false, message: "Release decision was not committed. Review the authority and scope." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, grantId, state });
}
