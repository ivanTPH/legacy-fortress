import test from "node:test";
import assert from "node:assert/strict";

const {
  getDefaultVaultPreferences,
  normalizeVaultPreferences,
  resolveVaultCategoryForPath,
  resolveVaultSubsectionForPath,
  isVaultPathEnabled,
  isVaultSubsectionEnabled,
} = await import("../lib/vaultPreferences.ts");

test("vault preferences default to all visible and preserve explicit false flags", () => {
  const defaults = getDefaultVaultPreferences();
  assert.equal(Object.values(defaults.groups).every(Boolean), true);
  assert.equal(Object.values(defaults.subsections).every(Boolean), true);

  const normalized = normalizeVaultPreferences({
    groups: {
      legal: false,
      finances: true,
      tasks: false,
    },
    subsections: {
      finances_insurance: false,
    },
  });

  assert.equal(normalized.groups.legal, false);
  assert.equal(normalized.groups.finances, true);
  assert.equal(normalized.groups.tasks, false);
  assert.equal(normalized.groups.business, true);
  assert.equal(normalized.subsections.finances_insurance, false);
  assert.equal(normalized.subsections.finances_bank, true);
});

test("vault preferences resolve shared route groups consistently", () => {
  assert.equal(resolveVaultCategoryForPath("/legal/wills"), "legal");
  assert.equal(resolveVaultCategoryForPath("/finances/pensions"), "finances");
  assert.equal(resolveVaultCategoryForPath("/personal/tasks"), "tasks");
  assert.equal(resolveVaultCategoryForPath("/vault/digital"), "digital");
  assert.equal(resolveVaultCategoryForPath("/cars-transport"), "cars_transport");
  assert.equal(resolveVaultCategoryForPath("/contacts"), null);
  assert.equal(resolveVaultSubsectionForPath("/finances/pensions"), "finances_pensions");
  assert.equal(resolveVaultSubsectionForPath("/business"), "business_interests");
});

test("disabled groups and subsections hide matching paths while leaving non-vault routes available", () => {
  const preferences = normalizeVaultPreferences({
    groups: {
      legal: false,
      finances: true,
    },
    subsections: {
      finances_insurance: false,
    },
  });

  assert.equal(isVaultPathEnabled("/legal", preferences), false);
  assert.equal(isVaultPathEnabled("/finances", preferences), true);
  assert.equal(isVaultPathEnabled("/finances/insurance", preferences), false);
  assert.equal(isVaultSubsectionEnabled(preferences, "finances_bank"), true);
  assert.equal(isVaultPathEnabled("/contacts", preferences), true);
});
