import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatOwed } from "../lib/currency.ts";
import { buildExecutorPack } from "../lib/vault/executorPack.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("owed amounts read '−£12,000 owed': a true minus sign and the word, never colour alone", () => {
  assert.equal(formatOwed(12000, "GBP"), "−£12,000 owed");
  assert.equal(formatOwed(-12000, "GBP"), "−£12,000 owed", "sign-safe");
  assert.equal(formatOwed(1200.5, "GBP", { whole: false }), "−£1,200.50 owed");
  const css = read("app/v3-screens.css");
  assert.match(css, /--lf-owed: #A0412D/);
  assert.doesNotMatch(css, /\.lf-amount-owed \{[^}]*#B3261E/, "not the error red");
});

test("Home says 'Estimated net value' with assets and owed when anything is owed", () => {
  const overview = read("app/(app)/components/dashboard/V3DashboardOverview.tsx");
  assert.match(overview, /valueBreakdown \? "Estimated net value" : "Estimated value"/);
  assert.match(overview, /\{valueBreakdown\.assets\} assets · <span className="lf-amount-owed/);
  const page = read("app/(app)/dashboard/page.tsx");
  assert.match(page, /owed: formatOwed\(owedMajor, currency\)/);
  assert.match(page, /owed: financialSummary\.owedText/);
  assert.match(read("lib/dashboard/summary.ts"), /owedMajor > 0 \? `\$\{formatCurrencyWhole\(heldMajor, currency\)\} held`/);
});

test("Finances, record lists and record pages show owed amounts as owed", () => {
  const finances = read("app/(app)/finances/page.tsx");
  assert.match(finances, /held · \$\{formatOwed\(owed, currency\)\}/);
  assert.match(finances, /owed: section\.key === "debts" && section\.summary\.totalMajor \? formatOwed/);
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /const isOwedRow = /);
  assert.match(workspace, /isOwedRow \? "Amount owed" : "Value"/);
  assert.match(read("components/vault/VaultSectionGrid.tsx"), /className="lf-amount-owed"/);
});

test("executor pack prints debts as owed", () => {
  const pack = buildExecutorPack({
    ownerName: "Bill Smith",
    rows: [{ id: "m1", section_key: "finances", category_key: "debts", title: "Nationwide", provider_name: "Nationwide", value_minor: 18500000, currency_code: "GBP",
      metadata: { debt_type: "mortgage", creditor_name: "Nationwide", outstanding_balance: "185000" } }],
    documentCounts: new Map(), people: [], includeValues: true,
  });
  assert.match(JSON.stringify(pack), /\\u2212£185,000 owed|−£185,000 owed/);
});
