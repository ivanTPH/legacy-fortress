import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../components/records/UniversalRecordWorkspace.tsx", import.meta.url), "utf8");
const integritySource = readFileSync(new URL("../lib/assets/categoryTypeIntegrity.mjs", import.meta.url), "utf8");

test("investment and pension type fields use dropdowns, not free text", () => {
  assert.match(workspaceSource, /INVESTMENT_SELECT_OPTIONS = getCategoryTypeSelectOptions\("finances", "investments"/);
  assert.match(workspaceSource, /PENSION_SELECT_OPTIONS = getCategoryTypeSelectOptions\("finances", "pensions"/);
  assert.match(workspaceSource, /<FieldSelect label="Investment type"/);
  assert.match(workspaceSource, /<FieldSelect label="Pension type"/);
  assert.doesNotMatch(workspaceSource, /<FieldInput label="Investment type"/);
  assert.doesNotMatch(workspaceSource, /<FieldInput label="Pension type"/);
});

test("finance save validates selected type against the route category", () => {
  assert.match(workspaceSource, /validateCategoryTypeSelection\(\{/);
  assert.match(workspaceSource, /sectionKey,\s*categoryKey,\s*typeValue: financeTypeValue/);
  assert.match(workspaceSource, /validationMessage =\s*financeTypeValidation\.message/);
  assert.match(workspaceSource, /setSubmitError\(validationMessage\)/);
  assert.match(integritySource, /crossCategoryMessage: "This record type belongs under Pensions/);
});

test("finance save canonicalizes type values before persistence", () => {
  assert.match(workspaceSource, /const investmentTypeKey = canonicalizeCategoryTypeValue\("finances", "investments", form\.investment_type\)/);
  assert.match(workspaceSource, /investment_type: investmentTypeKey \|\| null/);
  assert.match(workspaceSource, /getCategoryTypeLabel\("finances", "investments", investmentTypeKey\)/);
});

test("bank other account type stores a stable classification and separate custom text", () => {
  assert.match(workspaceSource, /form\.bank_account_type === "__other"[\s\S]*\? "other_bank_account"/);
  assert.match(workspaceSource, /account_type_other: resolvedAccountTypeOther \|\| null/);
  assert.match(workspaceSource, /bank_account_type_other: value === "__other" \? prev\.bank_account_type_other : ""/);
  assert.match(workspaceSource, /canonicalBankSeed\.account_type_other/);
  assert.match(workspaceSource, /canonicalOption\.value[\s\S]*explicitOtherValue\.trim\(\)/);
  assert.match(workspaceSource, /resolvedAccountTypeOther/);
});

test("pension save requires a pension type", () => {
  assert.match(integritySource, /message: `Choose a \$\{definition\.label\.toLowerCase\(\)\} type before saving\.`/);
  assert.match(integritySource, /Final salary \/ defined benefit/);
  assert.match(integritySource, /SIPP/);
});
