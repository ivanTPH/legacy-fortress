import test from "node:test";
import assert from "node:assert/strict";
import { validateBankAssetMetadata } from "../lib/assets/validateBankAssetMetadata.ts";

test("owner can save a bank account before its account number is known", () => {
  const reviewed = { provider_name: "Synthetic Bank", account_type: "savings_account", account_holder: "Test Owner", country: "UK", currency: "GBP" };
  assert.doesNotThrow(() => validateBankAssetMetadata(reviewed));
  assert.doesNotThrow(() => validateBankAssetMetadata({ ...reviewed, account_number: null, sort_code: null }));
  assert.throws(() => validateBankAssetMetadata({ ...reviewed, account_holder: null }), /Account Holder is required/);
});
