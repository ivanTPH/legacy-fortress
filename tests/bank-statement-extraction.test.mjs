import test from "node:test";
import assert from "node:assert/strict";
import { extractBankStatementCandidate } from "../lib/documents/bankStatementExtraction.ts";
import { matchBankStatementToAuthorisedAccounts } from "../lib/documents/bankStatementMatching.ts";

test("digital statement candidate preserves validated fields with page evidence and no automatic mutation", () => {
  const result = extractBankStatementCandidate([{ page: 1, text: [
    "Bank: Barclays",
    "Account name: Rainy Day Savings",
    "Account holder: Jane Example",
    "Account type: Savings account",
    "Account number: 12345678",
    "Sort code: 12-34-56",
    "IBAN: GB82 WEST 1234 5698 7654 32",
    "SWIFT/BIC: WESTGB2L",
    "Statement date: 24 Oct 2026",
    "Statement period: 01/10/2026 to 24/10/2026",
    "Closing balance: GBP 1,234.56 CR",
  ].join("\n") }]);
  assert.equal(result.fields.provider?.value, "Barclays");
  assert.equal(result.fields.accountNumber?.value, "12345678");
  assert.equal(result.fields.sortCode?.value, "12-34-56");
  assert.equal(result.fields.iban?.value, "GB82WEST12345698765432");
  assert.equal(result.fields.swiftBic?.value, "WESTGB2L");
  assert.equal(result.fields.statementDate?.value, "2026-10-24");
  assert.equal(result.fields.periodStart?.value, "2026-10-01");
  assert.equal(result.fields.closingBalance?.value, "1234.56");
  assert.equal(result.fields.closingBalance?.page, 1);
  assert.equal(result.requiresOwnerReview, true);
});

test("debit sign is retained and unsupported or conflicting identifiers are omitted", () => {
  const result = extractBankStatementCandidate([{ page: 2, text: [
    "Account number: ****5678",
    "Account number: 12345678",
    "Account number: 87654321",
    "IBAN: GB00 WEST 1234 5698 7654 32",
    "Closing balance: £42.00 DR",
    "Transaction 01/10/2026 £9,999.00",
  ].join("\n") }]);
  assert.equal(result.fields.accountNumber, undefined);
  assert.equal(result.fields.iban, undefined);
  assert.equal(result.fields.closingBalance?.value, "-42.00");
  assert.equal(result.fields.currency?.value, "GBP");
  assert.ok(result.warnings.includes("conflicting_accountNumber"));
  assert.ok(result.warnings.includes("account_identifier_not_found"));
});

test("scanned document without a digital text layer produces no invented values", () => {
  const result = extractBankStatementCandidate([{ page: 1, text: "" }]);
  assert.deepEqual(result.fields, {});
  assert.ok(result.warnings.includes("no_digital_text"));
});

test("exact identifier matching excludes another owner's record and rejects weak matches", () => {
  const candidate = extractBankStatementCandidate([{ page: 1, text: "Account number: 12345678\nSort code: 12-34-56" }]);
  const records = [
    { id: "other", ownerUserId: "other-owner", accountNumber: "12345678", sortCode: "12-34-56" },
    { id: "mine", ownerUserId: "me", accountNumber: "12345678", sortCode: "123456" },
  ];
  assert.deepEqual(matchBankStatementToAuthorisedAccounts(candidate, "me", records), { status: "exact_match", recordIds: ["mine"] });
  assert.deepEqual(matchBankStatementToAuthorisedAccounts(candidate, "other-person", records), { status: "no_match", recordIds: [] });
  const weak = extractBankStatementCandidate([{ page: 1, text: "Bank: Barclays\nAccount name: Savings" }]);
  assert.deepEqual(matchBankStatementToAuthorisedAccounts(weak, "me", records), { status: "insufficient_evidence", recordIds: [] });
});
