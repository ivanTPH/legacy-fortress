import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertPhase3FixturePackIsLocalOnly,
  phase3SyntheticFixturePack,
} from "./fixtures/phase3SyntheticFixturePack.mjs";

const docs = {
  backlog: readFileSync(new URL("../docs/product/OWNER_REVIEW_BACKLOG.md", import.meta.url), "utf8"),
  boundaries: readFileSync(new URL("../docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md", import.meta.url), "utf8"),
  components: readFileSync(new URL("../docs/architecture/DASHBOARD_COMPONENT_STANDARD.md", import.meta.url), "utf8"),
  slice: readFileSync(new URL("../docs/product/PHASE3_SELECTED_SLICE.md", import.meta.url), "utf8"),
  phase4aScope: readFileSync(new URL("../docs/product/PHASE4A_SELECTED_SCOPE.md", import.meta.url), "utf8"),
  phase4aInventory: readFileSync(new URL("../docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md", import.meta.url), "utf8"),
};

test("Phase 3 product docs define backlog, boundaries, UI standards and selected slice", () => {
  assert.match(docs.backlog, /Customer Application/);
  assert.match(docs.backlog, /Internal Application Control/);
  assert.match(docs.backlog, /Enterprise \/ Licence Control/);
  assert.match(docs.backlog, /owner decision required/);
  assert.match(docs.boundaries, /Customer Dashboard/);
  assert.match(docs.boundaries, /Internal Application Control Dashboard/);
  assert.match(docs.boundaries, /Enterprise \/ Licence Dashboard/);
  assert.match(docs.boundaries, /Metric Register/);
  assert.match(docs.components, /DashboardAssetSummaryCard/);
  assert.match(docs.components, /AttachmentGallery/);
  assert.match(docs.components, /UniversalRecordWorkspace/);
  assert.match(docs.slice, /Selected Slice/);
  assert.match(docs.slice, /Empty asset-class tiles/);
  assert.match(docs.phase4aScope, /Phase 4A/);
  assert.match(docs.phase4aInventory, /Route Inventory/);
});

test("Phase 3 fixture pack is local-only and deterministic", () => {
  assert.doesNotThrow(() => assertPhase3FixturePackIsLocalOnly());
  assert.equal(phase3SyntheticFixturePack.scope, "local-only");
  assert.equal(phase3SyntheticFixturePack.deterministicMetrics.totalSyntheticCustomers, phase3SyntheticFixturePack.customerStates.length);
  assert.equal(phase3SyntheticFixturePack.enterpriseStates.length, 2);
  assert.ok(phase3SyntheticFixturePack.adminOperations.some((item) => item.key === "pending_probate_review"));
  assert.ok(phase3SyntheticFixturePack.customerStates.some((item) => item.key === "stale_will_owner"));
});

test("Phase 3 docs avoid claiming enterprise multi-tenancy is implemented", () => {
  assert.match(docs.boundaries, /Do not claim enterprise multi-tenancy exists/);
  assert.match(docs.backlog, /No production-ready organisation model is proven/);
  assert.doesNotMatch(docs.boundaries, /enterprise multi-tenancy is implemented/i);
  assert.doesNotMatch(docs.phase4aScope, /enterprise multi-tenancy is implemented/i);
});
