import test from "node:test";
import assert from "node:assert/strict";

const { buildBucketSummary, getDashboardAssetValueMajor } = await import("../lib/dashboard/summary.ts");
const { formatCurrency } = await import("../lib/currency.ts");

test("property and business bucket summaries can surface total monetary value when present", () => {
  const rows = [
    {
      id: "asset-1",
      estimated_value_minor: 25000000,
      currency_code: "GBP",
      created_at: "2026-03-28T10:00:00.000Z",
      updated_at: "2026-03-28T10:00:00.000Z",
    },
    {
      id: "asset-2",
      value_minor: 1250000,
      currency_code: "GBP",
      created_at: "2026-03-27T10:00:00.000Z",
      updated_at: "2026-03-27T10:00:00.000Z",
    },
  ];

  const summary = buildBucketSummary(rows, {
    createdId: "",
    detailLabel: "property asset(s)",
    valueTextBuilder: (bucketRows) => {
      const totalMajor = bucketRows.reduce((sum, row) => sum + getDashboardAssetValueMajor(row), 0);
      return totalMajor > 0 ? formatCurrency(totalMajor, "GBP") : `${bucketRows.length}`;
    },
    itemBuilder: (row) => ({ id: row.id, label: row.id, href: "/property" }),
  });

  assert.equal(summary.valueText, "£262,500.00");
  assert.equal(summary.detailText, "2 property asset(s)");
});

test("dashboard value extraction reads normalized major-value metadata for property and business assets", () => {
  assert.equal(getDashboardAssetValueMajor({
    id: "property-1",
    metadata_json: {
      value_major: 450000,
    },
  }), 450000);

  assert.equal(getDashboardAssetValueMajor({
    id: "business-1",
    metadata_json: {
      estimated_value_major: 125000,
    },
  }), 125000);
});
