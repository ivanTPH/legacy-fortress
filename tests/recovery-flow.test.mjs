import test from "node:test";
import assert from "node:assert/strict";

import { getRecoveryValidationMessage, parseRecoveryParams } from "../lib/auth/recovery.ts";

test("parseRecoveryParams reads token_hash recovery URLs", () => {
  const params = parseRecoveryParams("https://example.com/auth/reset-password?token_hash=abc123&type=recovery");
  assert.equal(params.tokenHash, "abc123");
  assert.equal(params.type, "recovery");
  assert.equal(params.accessToken, null);
  assert.equal(params.refreshToken, null);
  assert.equal(params.hasPkceCode, false);
});

test("parseRecoveryParams reads hash token session URLs", () => {
  const params = parseRecoveryParams("https://example.com/auth/reset-password#access_token=a&refresh_token=b&type=recovery");
  assert.equal(params.tokenHash, null);
  assert.equal(params.accessToken, "a");
  assert.equal(params.refreshToken, "b");
  assert.equal(params.hasPkceCode, false);
});

test("parseRecoveryParams detects pkce code links", () => {
  const params = parseRecoveryParams("https://example.com/auth/reset-password?code=pkce_123");
  assert.equal(params.hasPkceCode, true);
});

test("getRecoveryValidationMessage maps sensitive errors to safe user copy", () => {
  assert.match(
    getRecoveryValidationMessage(new Error("PKCE code verifier not found in storage")),
    /not valid in this browser session/i,
  );
  assert.match(
    getRecoveryValidationMessage(new Error("Token has expired or is invalid")),
    /invalid or expired/i,
  );
  assert.match(
    getRecoveryValidationMessage(new Error("Something else happened")),
    /could not validate/i,
  );
});
