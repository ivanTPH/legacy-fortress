import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFinanceCategorySummary,
  buildFinanceSummary,
  countAssetsByBucket,
  getAssetsForBucket,
  prioritizeCreatedAsset,
  summarizeScopedAssetRows,
} from "../lib/dashboard/summary.ts";

test("bank-account canonical rows appear in dashboard finance totals and counts", () => {
  const rows = [
    {
      id: "bank-1",
      section_key: "finances",
      category_key: "bank",
      title: "Current Account",
      provider_name: "Barclays",
      value_minor: 125000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: {
        institution_name: "Barclays",
        asset_category_token: "bank-accounts",
      },
      created_at: "2026-03-20T10:00:00.000Z",
      updated_at: "2026-03-20T10:00:00.000Z",
    },
  ];

  const counts = countAssetsByBucket(rows);
  const financeRows = getAssetsForBucket(rows, "finance");
  const summary = buildFinanceSummary(rows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.equal(counts.finance, 1);
  assert.equal(financeRows.length, 1);
  assert.equal(summary.includedCount, 1);
  assert.equal(summary.totalMajor, 1250);
  assert.equal(summary.items[0]?.label, "Barclays");
  assert.equal(summary.items[0]?.href, "/finances/bank");
  assert.match(summary.items[0]?.meta ?? "", /1,250|1250/);
});

test("dashboard finance summary treats legacy bank-accounts category rows as finance assets", () => {
  const rows = [
    {
      id: "bank-legacy-category",
      section_key: "finances",
      category_key: "bank-accounts",
      title: "Legacy Current Account",
      provider_name: "HSBC",
      value_minor: 205000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: {
        provider_name: "HSBC",
        current_balance: 2050,
      },
      created_at: "2026-03-23T10:00:00.000Z",
      updated_at: "2026-03-23T10:00:00.000Z",
    },
  ];

  const counts = countAssetsByBucket(rows);
  const financeRows = getAssetsForBucket(rows, "finance");
  const summary = buildFinanceSummary(rows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.equal(counts.finance, 1);
  assert.equal(financeRows.length, 1);
  assert.equal(summary.includedCount, 1);
  assert.equal(summary.totalMajor, 2050);
  assert.equal(summary.items[0]?.label, "HSBC");
  assert.equal(summary.items[0]?.href, "/finances/bank");
});

test("dashboard finance summary prefers canonical provider name over legacy institution name", () => {
  const rows = [
    {
      id: "bank-provider-precedence",
      section_key: "finances",
      category_key: "bank",
      title: "Stale Title",
      provider_name: "HSBC",
      value_minor: 10000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: {
        provider_name: "HSBC",
        institution_name: "Barclays Legacy",
        current_balance: 100,
      },
      created_at: "2026-03-23T11:00:00.000Z",
      updated_at: "2026-03-23T11:00:00.000Z",
    },
  ];

  const summary = buildFinanceSummary(rows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.equal(summary.items[0]?.label, "HSBC");
});

test("dashboard finance summary orders items by descending value before trimming", () => {
  const rows = [
    {
      id: "bank-low",
      section_key: "finances",
      category_key: "bank",
      title: "Low Value",
      provider_name: "Low Bank",
      value_minor: 10000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { provider_name: "Low Bank" },
      created_at: "2026-03-23T09:00:00.000Z",
      updated_at: "2026-03-23T09:00:00.000Z",
    },
    {
      id: "bank-high",
      section_key: "finances",
      category_key: "bank",
      title: "High Value",
      provider_name: "High Bank",
      value_minor: 900000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { provider_name: "High Bank" },
      created_at: "2026-03-23T08:00:00.000Z",
      updated_at: "2026-03-23T08:00:00.000Z",
    },
    {
      id: "bank-mid",
      section_key: "finances",
      category_key: "bank",
      title: "Mid Value",
      provider_name: "Mid Bank",
      value_minor: 450000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { provider_name: "Mid Bank" },
      created_at: "2026-03-23T07:00:00.000Z",
      updated_at: "2026-03-23T07:00:00.000Z",
    },
  ];

  const summary = buildFinanceSummary(rows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.deepEqual(summary.items.map((item) => item.label), ["High Bank", "Mid Bank", "Low Bank"]);
});

test("fallback-mode bank rows with safe public fields are still included", () => {
  const rows = [
    {
      id: "bank-2",
      section_key: "finances",
      category_key: "bank",
      title: "Treasury Account",
      provider_name: null,
      value_minor: 40000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: {},
      created_at: "2026-03-21T10:00:00.000Z",
      updated_at: "2026-03-21T10:00:00.000Z",
    },
  ];

  const summary = buildFinanceSummary(rows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.equal(summary.includedCount, 1);
  assert.equal(summary.totalMajor, 400);
  assert.equal(summary.items[0]?.label, "Treasury Account");
  assert.doesNotMatch(summary.items[0]?.label ?? "", /HSBC|Smoke/i);
});

test("dashboard finance summary excludes archived or deleted rows without injecting extras", () => {
  const rows = [
    {
      id: "bank-live",
      section_key: "finances",
      category_key: "bank",
      title: "Lloyds Saver",
      provider_name: "Lloyds Bank",
      value_minor: 50000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { institution_name: "Lloyds Bank" },
      created_at: "2026-03-21T09:00:00.000Z",
      updated_at: "2026-03-21T09:00:00.000Z",
    },
    {
      id: "bank-archived",
      section_key: "finances",
      category_key: "bank",
      title: "Archived Account",
      provider_name: "Barclays",
      value_minor: 99900,
      currency_code: "GBP",
      status: "archived",
      archived_at: "2026-03-21T10:00:00.000Z",
      deleted_at: null,
      metadata_json: { institution_name: "Barclays" },
      created_at: "2026-03-21T08:00:00.000Z",
      updated_at: "2026-03-21T10:00:00.000Z",
    },
  ];

  const summary = buildFinanceSummary(rows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.equal(summary.includedCount, 1);
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0]?.label, "Lloyds Bank");
  assert.equal(summary.totalMajor, 500);
  assert.doesNotMatch(summary.items.map((item) => item.label).join(" "), /Smoke HSBC Current Account/i);
});

test("bank page totals stay bank-only while dashboard finance summary spans all finance categories", () => {
  const bankRows = [
    {
      id: "bank-a",
      section_key: "finances",
      category_key: "bank",
      title: "Barclays Current",
      provider_name: "Barclays",
      value_minor: 58936000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { institution_name: "Barclays" },
      created_at: "2026-03-21T09:00:00.000Z",
      updated_at: "2026-03-21T09:00:00.000Z",
    },
  ];

  const financeRows = [
    ...bankRows,
    {
      id: "investment-a",
      section_key: "finances",
      category_key: "investments",
      title: "Quilters Portfolio",
      provider_name: "Quilters",
      value_minor: 34587600,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { investment_provider: "Quilters" },
      created_at: "2026-03-21T10:00:00.000Z",
      updated_at: "2026-03-21T10:00:00.000Z",
    },
  ];

  const bankTotals = summarizeScopedAssetRows(bankRows);
  const financeSummary = buildFinanceSummary(financeRows, {
    createdId: "",
    currency: "GBP",
    getHref: (categoryKey) => `/finances/${categoryKey}`,
  });

  assert.equal(bankTotals.activeValueMajor, 589360);
  assert.equal(bankTotals.activeCount, 1);
  assert.equal(financeSummary.totalMajor, 935236);
  assert.equal(financeSummary.includedCount, 2);
  assert.equal(financeSummary.categoryCount, 2);
  assert.match(financeSummary.detailText, /across 2 categories/);
});

test("prioritizeCreatedAsset moves a newly created row to the top without duplicating it", () => {
  const rows = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ];

  const prioritized = prioritizeCreatedAsset(rows, "b");

  assert.deepEqual(prioritized.map((row) => row.id), ["b", "a", "c"]);
  assert.equal(prioritized.filter((row) => row.id === "b").length, 1);
});

test("finance landing page bank summary card shows bank items only", () => {
  const rows = [
    {
      id: "bank-1",
      section_key: "finances",
      category_key: "bank",
      title: "Main Account",
      provider_name: "Barclays",
      value_minor: 250000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { institution_name: "Barclays" },
      created_at: "2026-03-22T10:00:00.000Z",
      updated_at: "2026-03-22T10:00:00.000Z",
    },
    {
      id: "investment-1",
      section_key: "finances",
      category_key: "investments",
      title: "Platform Account",
      provider_name: "Quilters",
      value_minor: 999999,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { investment_provider: "Quilters" },
      created_at: "2026-03-22T11:00:00.000Z",
      updated_at: "2026-03-22T11:00:00.000Z",
    },
  ];

  const summary = buildFinanceCategorySummary(rows, {
    categoryKey: "bank",
    currency: "GBP",
    href: "/finances/bank",
  });

  assert.equal(summary.includedCount, 1);
  assert.equal(summary.totalMajor, 2500);
  assert.equal(summary.items[0]?.label, "Barclays");
  assert.equal(summary.items[0]?.href, "/finances/bank");
});

test("finance landing page investments summary card shows investment items only", () => {
  const rows = [
    {
      id: "bank-1",
      section_key: "finances",
      category_key: "bank",
      title: "Main Account",
      provider_name: "Barclays",
      value_minor: 250000,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { institution_name: "Barclays" },
      created_at: "2026-03-22T10:00:00.000Z",
      updated_at: "2026-03-22T10:00:00.000Z",
    },
    {
      id: "investment-1",
      section_key: "finances",
      category_key: "investments",
      title: "Platform Account",
      provider_name: "Quilters",
      value_minor: 999999,
      currency_code: "GBP",
      status: "active",
      archived_at: null,
      deleted_at: null,
      metadata_json: { investment_provider: "Quilters" },
      created_at: "2026-03-22T11:00:00.000Z",
      updated_at: "2026-03-22T11:00:00.000Z",
    },
  ];

  const summary = buildFinanceCategorySummary(rows, {
    categoryKey: "investments",
    currency: "GBP",
    href: "/finances/investments",
  });

  assert.equal(summary.includedCount, 1);
  assert.equal(summary.totalMajor, 9999.99);
  assert.equal(summary.items[0]?.label, "Platform Account");
  assert.equal(summary.items[0]?.href, "/finances/investments");
});

test("empty finance categories show no-records-yet summaries", () => {
  const summary = buildFinanceCategorySummary([], {
    categoryKey: "pensions",
    currency: "GBP",
    href: "/finances/pensions",
  });

  assert.equal(summary.includedCount, 0);
  assert.equal(summary.valueText, "No records yet");
  assert.equal(summary.detailText, "No records yet");
  assert.deepEqual(summary.items, []);
});
