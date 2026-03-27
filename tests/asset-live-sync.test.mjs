import test from "node:test";
import assert from "node:assert/strict";

import { shouldRefreshDashboardForAssetMutation } from "../lib/assets/liveSync.ts";

test("dashboard refreshes for finance asset mutations", () => {
  assert.equal(
    shouldRefreshDashboardForAssetMutation({
      assetId: "asset-1",
      sectionKey: "finances",
      categoryKey: "bank",
      source: "test",
    }),
    true,
  );
});

test("dashboard ignores non-finance asset mutations", () => {
  assert.equal(
    shouldRefreshDashboardForAssetMutation({
      assetId: "asset-2",
      sectionKey: "property",
      categoryKey: "property",
      source: "test",
    }),
    false,
  );
});
