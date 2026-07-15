import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertPhase4aFixturePackIsLocalOnly,
  phase4aSyntheticFixturePack,
} from "./fixtures/phase4aSyntheticFixturePack.mjs";

const files = {
  component: readFileSync(new URL("../app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx", import.meta.url), "utf8"),
  property: readFileSync(new URL("../app/(app)/property/page.tsx", import.meta.url), "utf8"),
  business: readFileSync(new URL("../app/(app)/business/page.tsx", import.meta.url), "utf8"),
  digital: readFileSync(new URL("../app/(app)/vault/digital/page.tsx", import.meta.url), "utf8"),
  possessions: readFileSync(new URL("../app/(app)/vault/personal/page.tsx", import.meta.url), "utf8"),
  inventory: readFileSync(new URL("../docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md", import.meta.url), "utf8"),
  selectedScope: readFileSync(new URL("../docs/product/PHASE4A_SELECTED_SCOPE.md", import.meta.url), "utf8"),
  boundaries: readFileSync(new URL("../docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md", import.meta.url), "utf8"),
};

test("Phase 4A fixture pack is local-only and deterministic", () => {
  assert.doesNotThrow(() => assertPhase4aFixturePackIsLocalOnly());
  assert.equal(phase4aSyntheticFixturePack.scope, "local-only");
  assert.equal(phase4aSyntheticFixturePack.customerStates.length, 4);
  assert.deepEqual(phase4aSyntheticFixturePack.selectedRoutes, ["/property", "/business", "/vault/digital", "/vault/personal"]);
});

test("selected customer dashboards use canonical owner-scoped reads", () => {
  assert.match(files.component, /waitForActiveUser/);
  assert.match(files.component, /useViewerAccess/);
  assert.match(files.component, /resolveWalletContextForRead/);
  assert.match(files.component, /fetchCanonicalAssets/);
  assert.match(files.component, /sectionKeys/);
  assert.doesNotMatch(files.component, /\.from\("section_entries"\)/);
  assert.doesNotMatch(files.component, /AttachmentGallery/);
  assert.doesNotMatch(files.component, /sendContactInvite/);
});

test("selected overview pages use the shared canonical overview grid", () => {
  for (const [name, source] of Object.entries({
    property: files.property,
    business: files.business,
    digital: files.digital,
    possessions: files.possessions,
  })) {
    assert.match(source, /CanonicalAssetOverviewGrid/, `${name} should use the Phase 4A shared grid`);
    assert.match(source, /DashboardAssetSummaryCard|CanonicalAssetOverviewGrid/, `${name} should retain shared dashboard card rendering`);
    assert.doesNotMatch(source, /CategoryDashboardCard/, `${name} must not reintroduce retired card components`);
  }
});

test("Phase 4A dashboards keep summaries privacy-safe", () => {
  assert.match(files.component, /hideItems/);
  assert.match(files.component, /items=\{\[\]\}/);
  assert.match(files.component, /value=\{state\.status === "loading" \? "Loading" : isEmpty \? "Add record" : String\(rows\.length\)\}/);
  assert.doesNotMatch(files.component, /file_name|storage_path|contact_email|contact_phone|account_number|sort_code/);
  assert.match(files.inventory, /Do not count attachments, filenames, invitation records, contact notes, document contents, account numbers or unrelated owner data/);
  assert.match(files.selectedScope, /count-only summaries/);
});

test("Phase 4A documents explicitly separate canonical, mixed and legacy routes", () => {
  assert.match(files.inventory, /mixed canonical\/legacy/);
  assert.match(files.inventory, /section_entries/);
  assert.match(files.inventory, /Phase 4A safe to change/);
  assert.match(files.selectedScope, /Excluded Routes/);
  assert.match(files.selectedScope, /No database schema, migrations, hosted settings/);
});

test("Phase 4A selected routes do not claim admin or enterprise readiness", () => {
  assert.doesNotMatch(files.selectedScope, /production-ready enterprise/i);
  assert.doesNotMatch(files.inventory, /enterprise multi-tenancy is implemented/i);
  assert.match(files.boundaries, /Customer Dashboard/);
});
