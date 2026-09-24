import { NextResponse } from "next/server";
import { deliverWithResend, parseAndVerifyHook, validateStagingSender } from "@/lib/auth/sendEmailHook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const event = parseAndVerifyHook(body, request.headers, process.env);
    const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
    const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
    if (!apiKey || !from) throw new Error("resend_configuration_missing");

    const result = await deliverWithResend(event, { apiKey, from });
    console.info("[lf:auth-email-hook]", JSON.stringify({
      event: "accepted",
      eventId: event.eventId,
      actionType: event.actionType,
      provider: "resend",
      providerIdPresent: Boolean(result.providerId),
    }));
    return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "hook_failed";
    const redirectDiagnostic = error instanceof Error && "redirectDiagnostic" in error
      ? (error as Error & { redirectDiagnostic?: unknown }).redirectDiagnostic
      : undefined;
    const isAbort = error instanceof Error && error.name === "AbortError";
    const status = message === "invalid_hook_signature" || message === "stale_hook" || message === "replayed_hook" ? 401
      : message === "invalid_hook_json" || message === "invalid_email_event" || message === "invalid_staging_redirect" ? 400
        : message.startsWith("resend_http_") || isAbort ? 502
          : 503;
    const safeReason = [
      "invalid_hook_signature", "stale_hook", "replayed_hook", "invalid_hook_json", "invalid_email_event",
      "invalid_staging_redirect", "resend_configuration_missing", "invalid_staging_sender",
    ].includes(message) ? message : isAbort ? "provider_timeout" : message.startsWith("resend_http_") ? message : "delivery_failed";
    console.warn("[lf:auth-email-hook]", JSON.stringify({ event: "rejected", reason: safeReason, ...(redirectDiagnostic ? { redirect: redirectDiagnostic } : {}) }));
    return NextResponse.json({ ok: false, error: "email_delivery_unavailable" }, { status });
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
}
