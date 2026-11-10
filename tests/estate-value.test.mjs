import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { getEstateValueMajor, getLifeCoverMajor } from "../lib/dashboard/summary.ts";
import { formatCurrencyWhole } from "../lib/currency.ts";

// UX review decisions, 10 Nov 2026 (synthetic figures).
const row = (category_key, value_minor) => ({ id: category_key, section_key: "finances", category_key, value_minor });

test("estimated value leaves out life cover and takes off debts", () => {
  const rows = [row("pensions", 2480000), row("insurance", 50000000), row("debts", 500000)];
  const estate = rows.reduce((sum, r) => sum + getEstateValueMajor(r), 0);
  const cover = rows.reduce((sum, r) => sum + getLifeCoverMajor(r), 0);
  assert.equal(estate, 24800 - 5000);
  assert.equal(cover, 500000);
});

test("totals show whole pounds", () => {
  assert.equal(formatCurrencyWhole(1237300, "GBP"), "£1,237,300");
  assert.equal(formatCurrencyWhole(19.6, "GBP"), "£20");
});

test("Home and Finances use the estimated value and show life cover on its own line", () => {
  const home = fs.readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  assert.match(home, /getEstateValueMajor\(row\)/);
  const overview = fs.readFileSync("app/(app)/components/dashboard/V3DashboardOverview.tsx", "utf8");
  assert.match(overview, /Estimated value/);
  assert.match(overview, /Plus \{lifeCover\} life cover/);
  const finances = fs.readFileSync("app/(app)/finances/page.tsx", "utf8");
  assert.match(finances, /estimated value\$\{lifeCover > 0/);
});

test("the profile address shows the country typed for Other, and no repeated town", () => {
  const profile = fs.readFileSync("app/(app)/profile/page.tsx", "utf8");
  assert.match(profile, /form\.country === "__other" \? form\.country_other : form\.country/);
});
