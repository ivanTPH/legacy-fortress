import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const dashboard = read("app/(app)/dashboard/page.tsx");
const finances = read("app/(app)/finances/page.tsx");
const card = read("app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx");
const chooser = read("lib/vault/addRecordTypes.ts");
const addToFortress = read("app/(app)/components/dashboard/AddToFortressPanel.tsx");
const overviewGrid = read("app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx");

test("parent finance plus opens the canonical finance category without a duplicate chooser", () => {
  assert.match(dashboard, /addHref="\/finances"/);
  assert.doesNotMatch(finances, /FINANCE_RECORD_CHOICES/);
  assert.doesNotMatch(finances, /role="dialog"/);
  assert.doesNotMatch(finances, /Add to Finances/);
  for (const path of ["\/finances\/bank\?add=1", "\/finances\/pensions\?add=1", "\/finances\/investments\?add=1", "\/finances\/insurance\?add=1", "\/finances\/debts\?add=1"]) {
    assert.match(chooser, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("finance subcategory cards retain an exact-type plus for empty and populated states", () => {
  assert.match(finances, /addHref=\{`\$\{section\.href\}\?add=1`\}/);
  assert.match(finances, /const cardHref = section\.href/);
  assert.match(card, /label=\{addLabel \?\? `Add \$\{title\.toLowerCase\(\)\}`\}/);
  assert.match(card, /router\.push\(addHref\)/);
  assert.match(card, /event\.stopPropagation\(\)/);
  assert.match(overviewGrid, /addHref=\{tile\.addHref\}/);
});

test("Add to my Fortress enters the same canonical finance category", () => {
  assert.match(addToFortress, /FINANCE_CATEGORY_CHOICE/);
  assert.match(chooser, /href: "\/finances"/);
});

test("session prompt action is excluded from dashboard preview without changing the full count", () => {
  assert.match(dashboard, /entryPromptActionKey/);
  assert.match(dashboard, /excludedActionKeys=\{entryPromptActionKey \? \[entryPromptActionKey\] : \[\]\}/);
  assert.match(dashboard, /setEntryPromptActionKey\(actionCentrePreview\.actionKey\)/);
  assert.match(read("app/(app)/components/dashboard/ActionQueuePanel.tsx"), /excludedActionKeys: readonly string\[\]/);
});

test("bank account number is enrichment, not a creation prerequisite", () => {
  const fields = read("lib/assets/fieldDictionary.ts");
  assert.match(fields, /key: "account_number"[\s\S]*required: false/);
  assert.match(read("components/records/UniversalRecordWorkspace.tsx"), /validateAssetFormValues\(BANK_FORM_CONFIG/);
});
