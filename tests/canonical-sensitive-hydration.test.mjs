import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSensitivePayloadFallbackResult,
  buildSensitivePayloadSuccessResult,
  isSensitivePayloadHydrationCapabilityError,
} from "../lib/assets/sensitiveHydration.ts";

test("isSensitivePayloadHydrationCapabilityError detects decrypt/RPC capability issues", () => {
  assert.equal(
    isSensitivePayloadHydrationCapabilityError("function pgp_sym_decrypt(bytea, text) does not exist"),
    true,
  );
  assert.equal(
    isSensitivePayloadHydrationCapabilityError("Could not find the function public.get_assets_sensitive_payloads in the schema cache"),
    true,
  );
  assert.equal(
    isSensitivePayloadHydrationCapabilityError("permission denied for table assets"),
    false,
  );
});

test("fallback result preserves safe non-sensitive mode without injecting placeholder data", () => {
  const result = buildSensitivePayloadFallbackResult(["account_number", "sort_code", "iban"]);

  assert.equal(result.decryptSupportAvailable, false);
  assert.equal(result.fallbackMode, true);
  assert.equal(result.warning?.includes("non-sensitive record details"), true);
  assert.equal(result.payloads.size, 0);
  assert.equal(result.hydratedAssetCount, 0);
  assert.deepEqual(result.skippedFields, ["account_number", "sort_code", "iban"]);
});

test("success result keeps hydrated payloads and no fallback warning", () => {
  const payloads = new Map([["bank-1", { account_number: "12345678" }]]);
  const result = buildSensitivePayloadSuccessResult(payloads);

  assert.equal(result.decryptSupportAvailable, true);
  assert.equal(result.fallbackMode, false);
  assert.equal(result.warning, null);
  assert.equal(result.payloads.get("bank-1")?.account_number, "12345678");
  assert.equal(result.hydratedAssetCount, 1);
  assert.deepEqual(result.skippedFields, []);
});
