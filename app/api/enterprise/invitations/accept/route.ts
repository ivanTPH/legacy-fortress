import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  acceptEnterpriseInvitation,
  claimEnterpriseEnrolmentLink,
  EnterpriseOperationError,
  getEnterpriseInvitationPreview,
} from "@/lib/admin/enterpriseOperations";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return NextResponse.json({ ok: false, message: "Invitation service unavailable.", issue: getSupabaseAdminConfigIssue() }, { status: 503 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const preview = await getEnterpriseInvitationPreview(client, token);
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return toInvitationResponse(error);
  }
}

export async function POST(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return NextResponse.json({ ok: false, message: "Invitation service unavailable.", issue: getSupabaseAdminConfigIssue() }, { status: 503 });
  const userRes = await getRequestUser(request);
  if (!userRes.user) return NextResponse.json({ ok: false, message: "Sign in before accepting this invitation." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const type = String(body.type ?? "enterprise");
    const result = type === "enrolment"
      ? await claimEnterpriseEnrolmentLink(client, { user: userRes.user }, body)
      : await acceptEnterpriseInvitation(client, { user: userRes.user }, body);
    await recordAdminAuditEvent(client, {
      user: userRes.user,
      emailNormalized: String(userRes.user.email ?? "").toLowerCase(),
      isMasterAdmin: false,
      adminRole: "enterprise_admin",
      capabilities: [],
      adminRow: {
        id: "",
        email_normalized: String(userRes.user.email ?? "").toLowerCase(),
        user_id: userRes.user.id,
        display_name: String(userRes.user.user_metadata?.full_name ?? userRes.user.email ?? "Enterprise recipient"),
        status: "active",
        is_master: false,
        role: "enterprise_admin",
        granted_by_user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, {
      category: "admin_approval",
      action: type === "enrolment" ? "Enterprise enrolment link claimed" : "Enterprise invitation accepted",
      result: "success",
      resourceType: "access_policy",
      resourceId: "membership" in result ? result.membership.id : "",
      resourceLabel: String(userRes.user.email ?? "Enterprise recipient"),
      route: new URL(request.url).pathname,
      metadata: {
        private_vault_content_excluded: true,
        document_content_excluded: true,
        financial_values_excluded: true,
      },
    }).catch(() => null);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return toInvitationResponse(error);
  }
}

function toInvitationResponse(error: unknown) {
  if (error instanceof EnterpriseOperationError) {
    return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
  }
  return NextResponse.json({ ok: false, code: "enterprise_invitation_failed", message: "The invitation could not be processed safely." }, { status: 500 });
}
