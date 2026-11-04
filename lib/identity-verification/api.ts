import { NextResponse } from "next/server";
import { getRequestUser } from "../admin/access.ts";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../supabaseAdmin.ts";
import { sessionIsTrusted } from "../auth/deviceTrust.ts";

/**
 * Signed-in person plus the server client. Refuses a session from a new device that hasn't passed the
 * emailed code (4 Nov 2026); only the device-check route itself opts out.
 */
export async function requireIdentityApiAccess(request: Request, options: { allowUnverifiedDevice?: boolean } = {}) {
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
  if (!options.allowUnverifiedDevice && !(await sessionIsTrusted(admin, request, requestUser.user.id))) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "device_not_verified", message: "Confirm it's you with the code we email you." }, { status: 403 }),
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
