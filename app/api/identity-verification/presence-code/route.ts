import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { sendPresenceCode, verifyPresenceCode } from "@/lib/identity-verification/presenceCode";

const MESSAGES: Record<string, string> = {
  presence_code_requires_verified_id: "Verify your ID first. Then you can confirm it’s you with a code.",
  presence_code_wait_before_resend: "We’ve just sent a code. Wait a minute before asking for another.",
  presence_code_invalid: "That code isn’t right. Check the email and try again.",
  presence_code_expired: "That code has expired. Ask for a new one.",
  presence_code_too_many_attempts: "Too many tries. Ask for a new code.",
};

/** POST { action: "send" } emails a code; POST { action: "verify", code } confirms it's you for 10 minutes. */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as { action?: string; code?: string };
  try {
    if (body.action === "send") {
      const result = await sendPresenceCode(access.admin, { id: access.user.id, email: access.user.email });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "verify") {
      const result = await verifyPresenceCode(access.admin, access.user.id, String(body.code ?? ""));
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "presence_code_failed";
    return NextResponse.json({ ok: false, error: code, message: MESSAGES[code] ?? "That didn’t work. Try again in a moment." }, { status: code.startsWith("presence_code_send_failed") || code.endsWith("not_configured") ? 503 : 400 });
  }
}
