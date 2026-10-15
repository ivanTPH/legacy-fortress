import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = {
  appLayout: readFileSync(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8"),
  summaryCard: readFileSync(new URL("../app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx", import.meta.url), "utf8"),
  finances: readFileSync(new URL("../app/(app)/finances/page.tsx", import.meta.url), "utf8"),
  legal: readFileSync(new URL("../app/(app)/legal/page.tsx", import.meta.url), "utf8"),
  property: readFileSync(new URL("../app/(app)/property/page.tsx", import.meta.url), "utf8"),
  business: readFileSync(new URL("../app/(app)/business/page.tsx", import.meta.url), "utf8"),
  personal: readFileSync(new URL("../app/(app)/personal/page.tsx", import.meta.url), "utf8"),
  digitalOverview: readFileSync(new URL("../app/(app)/vault/digital/page.tsx", import.meta.url), "utf8"),
  digitalRecords: readFileSync(new URL("../app/(app)/vault/digital/records/page.tsx", import.meta.url), "utf8"),
  possessionOverview: readFileSync(new URL("../app/(app)/vault/personal/page.tsx", import.meta.url), "utf8"),
  possessionRecords: readFileSync(new URL("../app/(app)/vault/personal/records/page.tsx", import.meta.url), "utf8"),
  fieldDictionary: readFileSync(new URL("../lib/assets/fieldDictionary.ts", import.meta.url), "utf8"),
  universalWorkspace: readFileSync(new URL("../components/records/UniversalRecordWorkspace.tsx", import.meta.url), "utf8"),
  sectionWorkspace: readFileSync(new URL("../components/sections/SectionWorkspace.tsx", import.meta.url), "utf8"),
  sidebarPrimary: readFileSync(new URL("../app/(app)/components/navigation/SidebarPrimary.tsx", import.meta.url), "utf8"),
  canonicalOverviewGrid: readFileSync(new URL("../app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx", import.meta.url), "utf8"),
  globals: readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"),
};

test("asset-class overview pages use Version 3 section cards and the shared canonical grid", () => {
  for (const [name, source] of Object.entries({
    legal: files.legal,
    finances: files.finances,
    property: files.property,
    business: files.business,
    digitalOverview: files.digitalOverview,
    possessionOverview: files.possessionOverview,
  })) {
    assert.match(source, /PageHeader/, `${name} should use the shared page header`);
    assert.match(source, /CanonicalAssetOverviewGrid|lf-v3-area-section/, `${name} should use Version 3 area sections`);
  }
  assert.match(files.canonicalOverviewGrid, /lf-v3-area-section/);
  assert.match(files.canonicalOverviewGrid, /fetchCanonicalAssets/);
});

test("sidebar launches top-level dashboards instead of submenu flyouts", () => {
  assert.match(files.appLayout, /stripNavigationChildren\(topLevelItems\)/);
  assert.match(files.appLayout, /items=\{dashboardNavigationItems\}/);
  assert.match(files.appLayout, /className="lf-topbar-back"/);
  assert.match(files.sidebarPrimary, /href=\{item\.path\}/);
  assert.match(files.sidebarPrimary, /className="lf-nav-expand"/);
});

test("record workspaces open the add form from add=1 query links", () => {
  assert.match(files.finances, /\$\{section\.href\}\?add=1/);
  assert.match(files.legal, /\$\{section\.href\}\?add=1/);
  assert.match(files.property, /addHref: "\/vault\/property\?add=1"/);
  assert.match(files.property, /CanonicalAssetOverviewGrid/);
  assert.match(files.business, /addHref: "\/vault\/business\?add=1"/);
  assert.match(files.business, /CanonicalAssetOverviewGrid/);
  assert.match(files.digitalOverview, /\/vault\/digital\/records\?add=1&digitalType=/);
  assert.match(files.possessionOverview, /\/vault\/personal\/records\?add=1&possessionCategory=/);
  assert.match(files.digitalRecords, /UniversalRecordWorkspace/);
  assert.match(files.possessionRecords, /variant="possessions"/);
  assert.match(files.universalWorkspace, /searchParams\.get\("add"\) !== "1"/);
  assert.match(files.universalWorkspace, /setFormVisible\(true\)/);
  assert.match(files.universalWorkspace, /const isCreatingRecord = formVisible && !editingId/);
  assert.match(files.universalWorkspace, /shouldShowExistingRecords/);
  assert.match(files.sectionWorkspace, /searchParams\.get\("add"\) !== "1"/);
  assert.match(files.sectionWorkspace, /setShowForm\(true\)/);
});

test("empty area tiles provide owner-only add destinations", () => {
  assert.match(files.canonicalOverviewGrid, /viewer\.mode !== "linked" && empty\.length/);
  assert.match(files.canonicalOverviewGrid, /href=\{tile\.addHref\}/);
  assert.match(files.legal, /viewer\.mode !== "linked" && empty\.length/);
  assert.match(files.globals, /\.lf-v3-area-empty-tile/);
});

test("digital and possession starter tiles map to known form types", () => {
  for (const label of ["Social media", "Subscriptions", "Email & cloud", "Domains & websites", "Crypto & wallets", "Other digital record"]) {
    assert.match(files.digitalOverview, new RegExp(label));
  }
  for (const value of ["social_media", "subscription", "cloud_storage", "domain_name", "crypto_wallet"]) {
    assert.match(files.fieldDictionary, new RegExp(`value: "${value}"`));
    assert.match(files.digitalOverview, new RegExp(`digitalType=${value}`));
  }
  for (const label of ["Vehicles", "Watches & jewellery", "Art & paintings", "Household contents", "Collections", "Other possession"]) {
    assert.match(files.possessionOverview, new RegExp(label));
  }
  assert.match(files.universalWorkspace, /searchParams\.get\("possessionCategory"\)/);
  assert.match(files.universalWorkspace, /searchParams\.get\("digitalType"\)/);
});
