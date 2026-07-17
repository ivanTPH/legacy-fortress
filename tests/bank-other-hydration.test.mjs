import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCanonicalBankEditSeed,
  normalizeBankAssetRow,
  normalizeCanonicalBankMetadata,
} from "../lib/assets/bankAsset.ts";

const workspaceSource = readFileSync(new URL("../components/records/UniversalRecordWorkspace.tsx", import.meta.url), "utf8");

test("bank other metadata preserves canonical type and separate custom text", () => {
  const normalized = normalizeCanonicalBankMetadata({
    provider_name: "Local Bank",
    account_type: "other_bank_account",
    account_type_other: "Offset savings account",
    account_holder: "Synthetic Holder",
    account_number: "12345678",
    country: "UK",
    currency: "GBP",
  });

  assert.equal(normalized.account_type, "other_bank_account");
  assert.equal(normalized.account_type_other, "Offset savings account");
});

test("bank other edit seed hydrates custom text instead of raw canonical token", () => {
  const seed = buildCanonicalBankEditSeed({
    provider_name: "Local Bank",
    currency_code: "GBP",
    metadata: {
      provider_name: "Local Bank",
      account_type: "other_bank_account",
      account_type_other: "Offset savings account",
      account_holder: "Synthetic Holder",
      account_number: "12345678",
      country: "UK",
      currency: "GBP",
    },
  });

  assert.equal(seed.account_type, "other_bank_account");
  assert.equal(seed.account_type_other, "Offset savings account");
  assert.notEqual(seed.account_type_other, "other_bank_account");
});

test("bank other legacy compatibility ignores canonical token as custom text", () => {
  const seed = buildCanonicalBankEditSeed({
    provider_name: "Local Bank",
    metadata: {
      provider_name: "Local Bank",
      account_type: "other_bank_account",
      account_type_details: "other_bank_account",
      account_holder: "Synthetic Holder",
      account_number: "12345678",
      country: "UK",
      currency: "GBP",
    },
  });

  assert.equal(seed.account_type, "other_bank_account");
  assert.equal(seed.account_type_other, "");
});

test("bank other display prefers custom text and hides raw token", () => {
  const row = normalizeBankAssetRow({
    provider_name: "Local Bank",
    currency_code: "GBP",
    metadata: {
      provider_name: "Local Bank",
      account_type: "other_bank_account",
      account_type_other: "Offset savings account",
      account_holder: "Synthetic Holder",
      account_number: "12345678",
      country: "UK",
      currency: "GBP",
    },
  });

  assert.equal(row.account_type, "other_bank_account");
  assert.equal(row.account_type_other, "Offset savings account");
  assert.equal(row.title, "Local Bank — Offset Savings Account");
  assert.doesNotMatch(row.title, /other_bank_account/);
});

test("workspace maps canonical other token back to Other option with explicit custom text", () => {
  assert.match(workspaceSource, /canonicalBankSeed\.account_type_other/);
  assert.match(workspaceSource, /canonicalOption\.value[\s\S]*explicitOtherValue\.trim\(\)/);
  assert.match(workspaceSource, /resolvedAccountTypeOther/);
  assert.match(workspaceSource, /bankAccountTypeLabel/);
});
