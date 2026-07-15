import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATEGORY_TYPE_DEFINITIONS,
  canonicalizeCategoryTypeValue,
  getCategoryTypeSelectOptions,
  validateCategoryTypeSelection,
} from "../lib/assets/categoryTypeIntegrity.mjs";

const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260711120000_category_type_integrity.sql", import.meta.url),
  "utf8",
);
const auditScriptSource = readFileSync(new URL("../scripts/audit-category-type-integrity.mjs", import.meta.url), "utf8");
const financeRowsSource = readFileSync(new URL("../lib/dashboard/financeRows.ts", import.meta.url), "utf8");
const summarySource = readFileSync(new URL("../lib/dashboard/summary.ts", import.meta.url), "utf8");

test("finance categories have category-scoped dropdown options", () => {
  const investments = getCategoryTypeSelectOptions("finances", "investments");
  const pensions = getCategoryTypeSelectOptions("finances", "pensions");
  const banks = getCategoryTypeSelectOptions("finances", "bank");

  assert.ok(investments.some((option) => option.value === "share_portfolio"));
  assert.ok(investments.some((option) => option.value === "managed_portfolio"));
  assert.equal(investments.some((option) => option.value === "sipp"), false);
  assert.equal(investments.some((option) => /pension/i.test(option.label)), false);

  assert.ok(pensions.some((option) => option.value === "sipp"));
  assert.ok(pensions.some((option) => option.value === "defined_benefit"));
  assert.equal(pensions.some((option) => option.value === "share_portfolio"), false);

  assert.ok(banks.some((option) => option.value === "current_account"));
  assert.equal(banks.some((option) => option.value === "sipp"), false);
});

test("category/type validation rejects pension submitted from investments", () => {
  const result = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "investments",
    typeValue: "Pension",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "CATEGORY_TYPE_MISMATCH");
  assert.equal(result.suggestedCategoryKey, "pensions");
  assert.match(result.message, /Pensions/);
});

test("category/type validation accepts canonical pension and investment keys", () => {
  const pension = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "pensions",
    typeValue: "sipp",
  });
  const investment = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "investments",
    typeValue: "managed_portfolio",
  });

  assert.equal(pension.ok, true);
  assert.equal(pension.canonicalTypeKey, "sipp");
  assert.equal(investment.ok, true);
  assert.equal(investment.canonicalTypeKey, "managed_portfolio");
});

test("legacy display labels canonicalize without becoming valid in the wrong category", () => {
  assert.equal(canonicalizeCategoryTypeValue("finances", "pensions", "Final salary / defined benefit"), "defined_benefit");
  assert.equal(canonicalizeCategoryTypeValue("finances", "investments", "Brokerage / platform account"), "brokerage_account");

  const wrongCategory = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "investments",
    typeValue: "SIPP",
  });
  assert.equal(wrongCategory.ok, false);
  assert.equal(wrongCategory.suggestedCategoryKey, "pensions");
});

test("the registry covers finance categories and records their persisted type fields", () => {
  const byCategory = new Map(CATEGORY_TYPE_DEFINITIONS.map((definition) => [definition.categoryKey, definition]));
  assert.equal(byCategory.get("investments")?.typeField, "investment_type");
  assert.equal(byCategory.get("pensions")?.typeField, "pension_type");
  assert.equal(byCategory.get("insurance")?.typeField, "policy_type");
  assert.equal(byCategory.get("debts")?.typeField, "debt_type");
  assert.equal(byCategory.get("bank")?.typeField, "account_type");
});

test("database migration enforces direct legacy record writes", () => {
  assert.match(migrationSource, /records_finance_category_type_integrity/);
  assert.match(migrationSource, /assets_finance_category_type_integrity/);
  assert.match(migrationSource, /before insert or update of section_key, category_key, metadata/);
  assert.match(migrationSource, /before insert or update of section_key, category_key, metadata_json/);
  assert.match(migrationSource, /CATEGORY_TYPE_MISMATCH/);
  assert.match(migrationSource, /lf_finance_allowed_type/);
});

test("audit script checks records and assets using the shared registry", () => {
  assert.match(auditScriptSource, /CATEGORY_TYPE_DEFINITIONS/);
  assert.match(auditScriptSource, /\.from\("records"\)/);
  assert.match(auditScriptSource, /\.from\("assets"\)/);
  assert.match(auditScriptSource, /confidence/);
});

test("dashboard finance summaries use canonical category keys, not type labels", () => {
  assert.match(financeRowsSource, /category_key: normalizeLegacyFinanceCategory\(row\.category_key\)/);
  assert.match(summarySource, /getAssetsForFinanceCategory/);
  assert.match(summarySource, /getNormalizedDashboardCategoryKey/);
  assert.doesNotMatch(summarySource, /investment_type[^;]+category/i);
});
