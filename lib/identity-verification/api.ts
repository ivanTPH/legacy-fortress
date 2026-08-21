import { NextResponse } from "next/server";
import { getRequestUser } from "../admin/access.ts";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../supabaseAdmin.ts";

export async function requireIdentityApiAccess(request: Request) {
  const requestUser = await getRequestUser(request);
  if (!requestUser.user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: requestUser.error }, { status: 401 }),
    };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: getSupabaseAdminConfigIssue() ?? "admin_client_unavailable" }, { status: 503 }),
    };
  }
  return { ok: true as const, user: requestUser.user, admin };
}

export function identityErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "identity_verification_error");
  const status = message.includes("not_found") ? 404
    : message.includes("transition") || message.includes("unsupported") || message.includes("expired") ? 400
      : message.includes("not_enabled") ? 503
        : 500;
  return NextResponse.json({ ok: false, error: safeIdentityError(message) }, { status });
}

function safeIdentityError(message: string) {
  if (/secret|token|jwt|password|signed/i.test(message)) return "identity_verification_error";
  return message;
}
