import test from "node:test";
import assert from "node:assert/strict";

const {
  getDefaultVaultPreferences,
  normalizeVaultPreferences,
  resolveVaultCategoryForPath,
  isVaultPathEnabled,
} = await import("../lib/vaultPreferences.ts");

test("vault preferences default to all visible and preserve explicit false flags", () => {
  const defaults = getDefaultVaultPreferences();
  assert.equal(Object.values(defaults).every(Boolean), true);

  const normalized = normalizeVaultPreferences({
    legal: false,
    finances: true,
    tasks: false,
  });

  assert.equal(normalized.legal, false);
  assert.equal(normalized.finances, true);
  assert.equal(normalized.tasks, false);
  assert.equal(normalized.business, true);
});

test("vault preferences resolve shared route groups consistently", () => {
  assert.equal(resolveVaultCategoryForPath("/legal/wills"), "legal");
  assert.equal(resolveVaultCategoryForPath("/finances/pensions"), "finances");
  assert.equal(resolveVaultCategoryForPath("/personal/tasks"), "tasks");
  assert.equal(resolveVaultCategoryForPath("/vault/digital"), "digital");
  assert.equal(resolveVaultCategoryForPath("/cars-transport"), "cars_transport");
  assert.equal(resolveVaultCategoryForPath("/contacts"), null);
});

test("disabled groups hide matching paths while leaving non-vault routes available", () => {
  const preferences = normalizeVaultPreferences({
    legal: false,
    finances: true,
  });

  assert.equal(isVaultPathEnabled("/legal", preferences), false);
  assert.equal(isVaultPathEnabled("/finances", preferences), true);
  assert.equal(isVaultPathEnabled("/contacts", preferences), true);
});
