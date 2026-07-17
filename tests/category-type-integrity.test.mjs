import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATEGORY_TYPE_DEFINITIONS,
  canonicalizeCategoryTypeValue,
  getCategoryTypeDatabaseTokens,
  getCategoryTypeFieldOptions,
  getCategoryTypeLabel,
  getCategoryTypeSelectOptions,
  normalizeCategoryTypeToken,
  validateCategoryTypeSelection,
} from "../lib/assets/categoryTypeIntegrity.mjs";

const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260711120000_category_type_integrity.sql", import.meta.url),
  "utf8",
);
const latestMigrationSource = readFileSync(
  new URL("../supabase/migrations/20260717120000_fix_finance_type_allowed_tokens.sql", import.meta.url),
  "utf8",
);
const fieldDictionarySource = readFileSync(new URL("../lib/assets/fieldDictionary.ts", import.meta.url), "utf8");
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

test("canonical registry has unique active finance types and non-empty labels", () => {
  const seenKeys = new Set();

  for (const definition of CATEGORY_TYPE_DEFINITIONS) {
    assert.equal(definition.sectionKey, "finances");
    assert.ok(definition.categoryKey, "category key should be present");
    assert.ok(definition.typeField, `${definition.categoryKey} should declare the persisted metadata field`);
    assert.ok(definition.allowedTypes.length > 0, `${definition.categoryKey} should expose at least one type`);

    const localAliases = new Set();
    for (const option of definition.allowedTypes) {
      assert.ok(option.key.trim(), `${definition.categoryKey} option should have a key`);
      assert.ok(option.label.trim(), `${option.key} should have a label`);
      assert.equal(seenKeys.has(option.key), false, `${option.key} should be globally unique`);
      seenKeys.add(option.key);

      for (const alias of option.legacyAliases ?? []) {
        const normalizedAlias = normalizeCategoryTypeToken(alias);
        assert.ok(normalizedAlias, `${option.key} should not declare blank aliases`);
        assert.equal(localAliases.has(normalizedAlias), false, `${definition.categoryKey} should not reuse alias ${alias}`);
        localAliases.add(normalizedAlias);
      }
    }
  }
});

test("every generated finance dropdown option is accepted by the authoritative validator", () => {
  for (const definition of CATEGORY_TYPE_DEFINITIONS) {
    const options = getCategoryTypeSelectOptions(definition.sectionKey, definition.categoryKey);
    assert.equal(options[0]?.value, "", `${definition.categoryKey} should keep a placeholder option`);

    for (const option of options.slice(1)) {
      const result = validateCategoryTypeSelection({
        sectionKey: definition.sectionKey,
        categoryKey: definition.categoryKey,
        typeValue: option.value,
      });
      assert.equal(result.ok, true, `${definition.categoryKey}/${option.value} should validate`);
      assert.equal(result.canonicalTypeKey, option.value);
    }
  }
});

test("stocks and shares ISA is a valid investment type but not a cross-category escape hatch", () => {
  const investment = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "investments",
    typeValue: "stocks_shares_isa",
  });
  const labelInput = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "investments",
    typeValue: "Stocks and shares ISA",
  });
  const wrongCategory = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "pensions",
    typeValue: "stocks_shares_isa",
  });

  assert.equal(investment.ok, true);
  assert.equal(investment.canonicalTypeKey, "stocks_shares_isa");
  assert.equal(labelInput.ok, true);
  assert.equal(labelInput.canonicalTypeKey, "stocks_shares_isa");
  assert.equal(getCategoryTypeLabel("finances", "investments", "stocks_shares_isa"), "Stocks and shares ISA");
  assert.equal(canonicalizeCategoryTypeValue("finances", "investments", "Stocks and shares ISA"), "stocks_shares_isa");
  assert.equal(wrongCategory.ok, false);
  assert.equal(wrongCategory.code, "CATEGORY_TYPE_MISMATCH");
  assert.equal(wrongCategory.suggestedCategoryKey, "investments");
});

test("unknown and arbitrary finance type values stay rejected", () => {
  const unknown = validateCategoryTypeSelection({
    sectionKey: "finances",
    categoryKey: "investments",
    typeValue: "surprise_token",
  });

  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "CATEGORY_TYPE_MISMATCH");
  assert.doesNotMatch(unknown.message, /surprise_token/);
});

test("canonical bank asset form options come from the finance registry without exposing stale values", () => {
  const fieldOptions = getCategoryTypeFieldOptions("finances", "bank", { otherValue: "__other" });

  assert.ok(fieldOptions.some((option) => option.value === "current_account"));
  assert.ok(fieldOptions.some((option) => option.value === "cash_deposit"));
  assert.ok(fieldOptions.some((option) => option.value === "__other" && option.canonicalValue === "other_bank_account"));
  assert.equal(fieldOptions.some((option) => option.value === "investment_account"), false);
  assert.match(fieldDictionarySource, /getCategoryTypeFieldOptions\("finances", "bank"/);
});

test("latest finance database validator contains every canonical stored type key", () => {
  for (const definition of CATEGORY_TYPE_DEFINITIONS) {
    for (const option of definition.allowedTypes) {
      assert.match(
        latestMigrationSource,
        new RegExp(`'${normalizeCategoryTypeToken(option.key)}'`),
        `${definition.categoryKey}/${option.key} should be allowed by the latest database validator`,
      );
    }
  }
});

test("database token helper includes the canonical stocks ISA key and its display alias", () => {
  const tokens = getCategoryTypeDatabaseTokens("finances", "investments");

  assert.ok(tokens.includes("stocks_shares_isa"));
  assert.ok(tokens.includes("stocks_and_shares_isa"));
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
