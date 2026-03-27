import test from "node:test";
import assert from "node:assert/strict";

import { buildCanonicalBankEditSeed, normalizeBankAssetRow, normalizeCanonicalBankMetadata } from "../lib/assets/bankAsset.ts";
import { normalizeSensitivePayloadPersistenceError } from "../lib/assets/createAsset.ts";
import { getAssetCategoryFormConfig, validateAssetFormValues } from "../lib/assets/fieldDictionary.ts";

test("bank create normalization writes canonical metadata keys without legacy duplicates", () => {
  const normalized = normalizeCanonicalBankMetadata({
    institution_name: "HSBC",
    account_type: "current_account",
    account_holder_name: "Jane Doe",
    sort_code: "10-20-30",
    account_number: "12345678",
    iban: "GB12HBUK12345612345678",
    value_major: 1250,
    last_updated_on: "2026-03-23",
    country_code: "UK",
    currency_code: "GBP",
    notes: "Primary account",
  });

  assert.deepEqual(normalized, {
    provider_name: "HSBC",
    provider_key: null,
    account_type: "current_account",
    account_holder: "Jane Doe",
    sort_code: "10-20-30",
    account_number: "12345678",
    iban: "GB12HBUK12345612345678",
    current_balance: 1250,
    valuation_date: "2026-03-23",
    country: "UK",
    currency: "GBP",
    notes: "Primary account",
    swift_bic: null,
    branch_name: null,
    branch_address: null,
    bank_contact_phone: null,
    bank_contact_email: null,
    online_banking_url: null,
  });

  assert.equal("institution_name" in normalized, false);
  assert.equal("account_holder_name" in normalized, false);
  assert.equal("country_code" in normalized, false);
  assert.equal("currency_code" in normalized, false);
  assert.equal("value_major" in normalized, false);
  assert.equal("last_updated_on" in normalized, false);
});

test("bank update normalization preserves canonical keys and does not reintroduce legacy duplicates", () => {
  const normalized = normalizeCanonicalBankMetadata({
    provider_name: "Barclays",
    institution_name: "Barclays legacy",
    account_type: "savings_account",
    account_holder: "John Smith",
    account_holder_name: "Legacy Holder",
    sort_code: "20-30-40",
    account_number: "87654321",
    iban: "GB98BARC20000087654321",
    current_balance: 9800,
    value_major: 1111,
    valuation_date: "2026-03-22",
    last_updated_on: "2026-01-01",
    country: "UK",
    country_code: "US",
    currency: "GBP",
    currency_code: "USD",
  });

  assert.equal(normalized.provider_name, "Barclays");
  assert.equal(normalized.account_holder, "John Smith");
  assert.equal(normalized.current_balance, 9800);
  assert.equal(normalized.valuation_date, "2026-03-22");
  assert.equal(normalized.country, "UK");
  assert.equal(normalized.currency, "GBP");

  assert.equal("institution_name" in normalized, false);
  assert.equal("account_holder_name" in normalized, false);
  assert.equal("country_code" in normalized, false);
  assert.equal("currency_code" in normalized, false);
  assert.equal("value_major" in normalized, false);
  assert.equal("last_updated_on" in normalized, false);
});

test("bank edit seed prefers canonical keys and falls back to legacy keys only when needed", () => {
  const seed = buildCanonicalBankEditSeed({
    title: "Legacy title",
    provider_name: "Row provider",
    currency_code: "EUR",
    metadata: {
      provider_name: "Canonical Provider",
      institution_name: "Legacy Institution",
      account_type: "current_account",
      account_holder: "Canonical Holder",
      account_holder_name: "Legacy Holder",
      sort_code: "10-20-30",
      account_number: "12345678",
      iban: "GB12BARC12345612345678",
      current_balance: 4500,
      valuation_date: "2026-03-23",
      last_updated_on: "2026-01-01",
      country: "UK",
      country_code: "US",
      currency: "GBP",
      currency_code: "USD",
    },
  });

  assert.equal(seed.provider_name, "Canonical Provider");
  assert.equal(seed.institution_name, "Canonical Provider");
  assert.equal(seed.account_type, "current_account");
  assert.equal(seed.account_holder, "Canonical Holder");
  assert.equal(seed.sort_code, "10-20-30");
  assert.equal(seed.account_number, "12345678");
  assert.equal(seed.iban, "GB12BARC12345612345678");
  assert.equal(seed.value_major, "4500");
  assert.equal(seed.last_updated_on, "2026-03-23");
  assert.equal(seed.country_code, "UK");
  assert.equal(seed.currency_code, "GBP");
});

test("bank detail reader prefers canonical bank metadata and falls back only when needed", () => {
  const canonical = normalizeBankAssetRow({
    title: "Legacy title",
    provider_name: "Row provider",
    currency_code: "EUR",
    metadata: {
      provider_name: "Canonical Provider",
      account_type: "current_account",
      account_holder: "Canonical Holder",
      account_holder_name: "Legacy Holder",
      sort_code: "10-20-30",
      account_number: "12345678",
      iban: "GB12BARC12345612345678",
      current_balance: 4500,
      valuation_date: "2026-03-23",
      country: "UK",
      currency: "GBP",
    },
  });

  assert.equal(canonical.provider_name, "Canonical Provider");
  assert.equal(canonical.account_type, "current_account");
  assert.equal(canonical.account_holder, "Canonical Holder");
  assert.equal(canonical.sort_code, "10-20-30");
  assert.equal(canonical.account_number, "12345678");
  assert.equal(canonical.iban, "GB12BARC12345612345678");
  assert.equal(canonical.current_balance, 4500);
  assert.equal(canonical.valuation_date, "2026-03-23");
  assert.equal(canonical.country, "UK");
  assert.equal(canonical.currency, "GBP");
});

test("shared bank normalizer keeps canonical provider_name instead of stale legacy fallback values", () => {
  const canonical = normalizeBankAssetRow({
    title: "Legacy title",
    provider_name: "Row provider",
    currency_code: "GBP",
    value_minor: 120000,
    metadata: {
      provider_name: "HSBC",
      institution_name: "Barclays Legacy",
      bank_name: "Another Legacy Name",
      account_holder: "Jane Smith",
      current_balance: 1200,
      valuation_date: "2026-03-23",
      country: "UK",
      currency: "GBP",
    },
  });

  assert.equal(canonical.provider_name, "HSBC");
  assert.equal(canonical.account_holder, "Jane Smith");
  assert.equal(canonical.current_balance, 1200);
  assert.equal(canonical.currency, "GBP");
});

test("bank form validation uses canonical bank keys", () => {
  const config = getAssetCategoryFormConfig("bank-accounts");
  assert.ok(config);

  const errors = validateAssetFormValues(config, {
    title: "Main account",
    provider_name: "",
    account_type: "",
    account_number: "",
    sort_code: "",
    country: "",
    country_other: "",
    currency: "",
    currency_other: "",
    current_balance: "",
    valuation_date: "",
    notes: "",
  });

  assert.equal(errors.provider_name, "Bank / provider name is required.");
  assert.equal(errors.account_type, "Account type is required.");
  assert.equal(errors.account_number, "Account number is required.");
  assert.equal(errors.country, "Country is required.");
  assert.equal(errors.currency, "Currency is required.");
  assert.equal("institution_name" in errors, false);
  assert.equal("estimated_value" in errors, false);
  assert.equal("last_updated_on" in errors, false);
});

test("bank field dictionary includes the canonical create fields", () => {
  const config = getAssetCategoryFormConfig("bank-accounts");
  assert.ok(config);

  const keys = config.fields.map((field) => field.key);
  assert.deepEqual(
    keys,
    [
      "title",
      "provider_name",
      "account_type",
      "account_holder",
      "account_number",
      "sort_code",
      "iban",
      "country",
      "currency",
      "current_balance",
      "valuation_date",
      "notes",
    ],
  );
});

test("sensitive payload persistence errors are translated into a controlled pgcrypto migration message", () => {
  const message = normalizeSensitivePayloadPersistenceError(
    "function pgp_sym_encrypt(text, text) does not exist",
  );

  assert.match(message, /Sensitive field encryption is unavailable in the active database/i);
  assert.match(message, /20260321123000_fix_asset_payload_pgcrypto_schema_qualification\.sql/);
  assert.doesNotMatch(message, /function pgp_sym_encrypt\(text, text\) does not exist/);
});
