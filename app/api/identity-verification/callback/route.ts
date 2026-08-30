import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";
import { isInternalExperimentalProviderAllowed } from "@/lib/identity-verification/service";

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const ALLOWED_EVENTS = new Set([
  "document_verification_completed",
  "liveness_verification_completed",
  "face_match_completed",
  "identity_verification_retry_requested",
  "identity_verification_review_required",
  "identity_verification_verified",
  "identity_verification_failed",
]);

export async function POST(request: Request) {
  const providerKey = String(request.headers.get("x-lf-idv-provider") ?? "").trim();
  const timestamp = String(request.headers.get("x-lf-idv-timestamp") ?? "").trim();
  const signature = String(request.headers.get("x-lf-idv-signature") ?? "").trim();
  const secret = String(process.env.IDENTITY_VERIFICATION_CALLBACK_SECRET ?? "").trim();
  if (!secret || !isInternalExperimentalProviderAllowed() || providerKey !== "lf_internal_experimental_v1") {
    return NextResponse.json({ ok: false, error: "identity_callback_unavailable" }, { status: 503 });
  }
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return NextResponse.json({ ok: false, error: "identity_callback_timestamp_invalid" }, { status: 400 });
  }
  const rawBody = await request.text();
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!safeEqual(signature, expected)) {
    return NextResponse.json({ ok: false, error: "identity_callback_signature_invalid" }, { status: 401 });
  }
  const body = JSON.parse(rawBody) as {
    providerReference?: string;
    eventId?: string;
    eventType?: string;
    metadata?: Record<string, unknown>;
  };
  const providerReference = String(body.providerReference ?? "").trim();
  const eventId = String(body.eventId ?? "").trim();
  const eventType = String(body.eventType ?? "").trim();
  if (!providerReference || !eventId || !ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: false, error: "identity_callback_payload_invalid" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: getSupabaseAdminConfigIssue() ?? "admin_client_unavailable" }, { status: 503 });
  const lookup = await admin.from("identity_verification_requests").select("id,user_id,status,provider_key,provider_reference").eq("provider_key", providerKey).eq("provider_reference", providerReference).maybeSingle();
  if (lookup.error) return NextResponse.json({ ok: false, error: "identity_callback_lookup_failed" }, { status: 500 });
  if (!lookup.data) return NextResponse.json({ ok: false, error: "identity_callback_reference_unknown" }, { status: 404 });
  const insert = await admin.from("identity_verification_events").insert({
    request_id: lookup.data.id,
    user_id: lookup.data.user_id,
    event_type: eventType,
    actor_type: "provider",
    provider_key: providerKey,
    provider_event_id: eventId,
    metadata: safeMetadata(body.metadata ?? {}),
  });
  if (insert.error && !/duplicate key|unique constraint/i.test(insert.error.message)) {
    return NextResponse.json({ ok: false, error: "identity_callback_event_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, idempotent: Boolean(insert.error), requestId: lookup.data.id });
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeMetadata(metadata: Record<string, unknown>) {
  const blocked = /token|secret|password|document|selfie|image|video|biometric|embedding|mrz/i;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.test(key)));
}
