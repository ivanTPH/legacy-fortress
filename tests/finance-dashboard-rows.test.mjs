import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const financeRowsSource = readFileSync(new URL("../lib/dashboard/financeRows.ts", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");
const financesSource = readFileSync(new URL("../app/(app)/finances/page.tsx", import.meta.url), "utf8");

test("dashboard merges canonical finance assets with legacy finance records", () => {
  assert.match(dashboardSource, /loadFinanceDashboardRows/);
  assert.match(dashboardSource, /const nonFinanceAssets = canonicalAssets\.filter/);
  assert.match(dashboardSource, /const mergedAssets = \[\.\.\.nonFinanceAssets, \.\.\.\(\(\(financeRowsRes\.data \?\? \[\]\)/);
});

test("finance loader maps legacy finance records into dashboard rows", () => {
  assert.match(financeRowsSource, /\.from\("records"\)/);
  assert.match(financeRowsSource, /\.eq\("section_key", "finances"\)/);
  assert.match(financeRowsSource, /export function mapLegacyFinanceRecordsToDashboardRows/);
  assert.match(financeRowsSource, /finance_record_source: "records"/);
});

test("legacy singular finance categories normalize into plural dashboard categories", () => {
  assert.match(financeRowsSource, /if \(normalized === "investment"\) return "investments"/);
  assert.match(financeRowsSource, /if \(normalized === "pension"\) return "pensions"/);
  assert.match(financeRowsSource, /if \(normalized === "debt" \|\| normalized === "loans-liabilities"\) return "debts"/);
});

test("all finances category display order is banks, pensions, investments, insurance, debts", () => {
  const banksIndex = financesSource.indexOf('title: "Banks"');
  const pensionsIndex = financesSource.indexOf('title: "Pensions"');
  const investmentsIndex = financesSource.indexOf('title: "Investments"');
  const insuranceIndex = financesSource.indexOf('title: "Insurance"');
  const debtsIndex = financesSource.indexOf('title: "Debts"');

  assert.ok(banksIndex > -1, "Banks card should exist");
  assert.ok(pensionsIndex > banksIndex, "Pensions should follow Banks");
  assert.ok(investmentsIndex > pensionsIndex, "Investments should follow Pensions");
  assert.ok(insuranceIndex > investmentsIndex, "Insurance should follow Investments");
  assert.ok(debtsIndex > insuranceIndex, "Debts should follow Insurance");
});
