import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import {
  buildVerificationUrl,
  deliverWithResend,
  parseAndVerifyHook,
  renderAuthEmail,
  validateStagingRedirect,
  validateStagingSender,
} from "../lib/auth/sendEmailHook.ts";
import { parseRecoveryParams } from "../lib/auth/recovery.ts";

function signedRequest(body, secret, overrides = {}) {
  const id = overrides.id ?? `evt_${randomBytes(6).toString("hex")}`;
  const timestamp = String(overrides.timestamp ?? Math.floor(Date.now() / 1000));
  const signed = `${id}.${timestamp}.${body}`;
  const key = Buffer.from(secret.slice("v1,whsec_".length), "base64");
  const signature = createHmac("sha256", key).update(signed).digest("base64");
  return {
    id,
    headers: new Headers({ "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` }),
  };
}

function payload(action = "recovery") {
  return JSON.stringify({
    user: { id: "00000000-0000-4000-8000-000000000001", email: "synthetic@example.test" },
    email_data: {
      token_hash: "opaque-auth-token-hash",
      redirect_to: "https://test.mylegacyfortress.com/reset-password",
      email_action_type: action,
    },
  });
}

const secret = `v1,whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
const env = { APP_ENV: "staging", LEGACY_FORTRESS_ENV: "staging", SEND_EMAIL_HOOK_SECRET: secret };

test("accepts a valid signed staging recovery event", () => {
  const body = payload();
  const request = signedRequest(body, secret);
  const event = parseAndVerifyHook(body, request.headers, env);
  assert.equal(event.actionType, "recovery");
  assert.equal(event.recipient, "synthetic@example.test");
  assert.match(event.verificationUrl, /^https:\/\/supabase-test\.mylegacyfortress\.com\/auth\/v1\/verify\?/);
  assert.match(event.verificationUrl, /type=recovery/);
  assert.match(event.verificationUrl, /redirect_to=https%3A%2F%2Ftest\.mylegacyfortress\.com%2Freset-password/);
});

test("rejects invalid, stale, replayed and production events", () => {
  const body = payload();
  const valid = signedRequest(body, secret);
  const badHeaders = new Headers(valid.headers);
  badHeaders.set("webhook-signature", "v1,invalid");
  assert.throws(() => parseAndVerifyHook(body, badHeaders, env), /invalid_hook_signature/);
  const stale = signedRequest(body, secret, { id: "evt_stale", timestamp: 1 });
  assert.throws(() => parseAndVerifyHook(body, stale.headers, env, { nowSeconds: 1000 }), /stale_hook/);
  parseAndVerifyHook(body, valid.headers, env);
  assert.throws(() => parseAndVerifyHook(body, valid.headers, env), /replayed_hook/);
  const production = signedRequest(body, secret, { id: "evt_production" });
  assert.throws(() => parseAndVerifyHook(body, production.headers, { ...env, APP_ENV: "production" }), /staging_only/);
});

test("rejects unsafe redirect and unsupported email actions", () => {
  assert.throws(() => validateStagingRedirect("https://legacy-fortress.vercel.app/reset-password"), /invalid_staging_redirect/);
  assert.equal(
    validateStagingRedirect("https://test.mylegacyfortress.com/reset-password/"),
    "https://test.mylegacyfortress.com/reset-password/",
  );
  assert.equal(
    validateStagingRedirect("https://test.mylegacyfortress.com/auth/callback/?next=%2Freset-password"),
    "https://test.mylegacyfortress.com/auth/callback/?next=%2Freset-password",
  );
  assert.throws(() => validateStagingRedirect("https://test.mylegacyfortress.com/reset-password/extra"), /invalid_staging_redirect/);
  const body = payload("email_change");
  const request = signedRequest(body, secret);
  assert.throws(() => parseAndVerifyHook(body, request.headers, env), /invalid_email_event/);
});

test("rejects malformed payloads and non-staging senders", () => {
  const body = "{";
  const request = signedRequest(body, secret, { id: "evt_malformed" });
  assert.throws(() => parseAndVerifyHook(body, request.headers, env), /invalid_hook_json/);
  assert.throws(() => validateStagingSender("Legacy Fortress <noreply@legacy-fortress.vercel.app>"), /invalid_staging_sender/);
  assert.throws(() => validateStagingSender("Legacy Fortress <noreply@mail.mylegacyfortress.com.evil.test>"), /invalid_staging_sender/);
  assert.equal(validateStagingSender("Legacy Fortress Staging <staging@mail.mylegacyfortress.com>"), "Legacy Fortress Staging <staging@mail.mylegacyfortress.com>");
});

test("renders approved event templates without changing Auth token semantics", () => {
  const event = {
    eventId: "evt_template",
    actionType: "recovery",
    recipient: "synthetic@example.test",
    tokenHash: "opaque-auth-token-hash",
    redirectTo: "https://test.mylegacyfortress.com/reset-password",
    verificationUrl: buildVerificationUrl("https://supabase-test.mylegacyfortress.com", "opaque-auth-token-hash", "recovery", "https://test.mylegacyfortress.com/reset-password"),
  };
  const email = renderAuthEmail(event);
  assert.match(email.subject, /Reset/);
  assert.match(email.html, /auth\/v1\/verify/);
  assert.match(email.text, /opaque-auth-token-hash/);
  const resetParams = parseRecoveryParams("https://test.mylegacyfortress.com/reset-password?token_hash=opaque-auth-token-hash&type=recovery");
  assert.equal(resetParams.tokenHash, "opaque-auth-token-hash");
  assert.equal(resetParams.type, "recovery");
});

test("returns provider id on accepted Resend response and uses idempotency", async () => {
  let received;
  const event = {
    eventId: "evt_delivery",
    actionType: "recovery",
    recipient: "synthetic@example.test",
    tokenHash: "opaque-auth-token-hash",
    redirectTo: "https://test.mylegacyfortress.com/reset-password",
    verificationUrl: "https://supabase-test.mylegacyfortress.com/auth/v1/verify?token=opaque-auth-token-hash&type=recovery&redirect_to=https%3A%2F%2Ftest.mylegacyfortress.com%2Freset-password",
  };
  const result = await deliverWithResend(event, {
    apiKey: "staging-test-key",
    from: "Legacy Fortress Staging <staging@mail.mylegacyfortress.com>",
    fetchImpl: async (_url, options) => {
      received = options;
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    },
  });
  assert.deepEqual(result, { providerId: "re_123" });
  assert.equal(received.headers["Idempotency-Key"], "legacy-fortress-auth-hook/evt_delivery");
});

test("fails closed on provider rejection and timeout", async () => {
  const event = {
    eventId: "evt_failure",
    actionType: "recovery",
    recipient: "synthetic@example.test",
    tokenHash: "opaque-auth-token-hash",
    redirectTo: "https://test.mylegacyfortress.com/reset-password",
    verificationUrl: "https://supabase-test.mylegacyfortress.com/auth/v1/verify?token=opaque-auth-token-hash&type=recovery&redirect_to=https%3A%2F%2Ftest.mylegacyfortress.com%2Freset-password",
  };
  await assert.rejects(() => deliverWithResend(event, { apiKey: "staging-test-key", from: "staging@mail.mylegacyfortress.com", fetchImpl: async () => new Response("", { status: 429 }) }), /resend_http_429/);
  await assert.rejects(() => deliverWithResend(event, { apiKey: "staging-test-key", from: "staging@mail.mylegacyfortress.com", timeoutMs: 1, fetchImpl: async (_url, options) => await new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("AbortError")))) }), /AbortError/);
});
