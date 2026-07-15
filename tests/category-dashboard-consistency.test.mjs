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

test("asset-class overview pages use the same summary card pattern as finance", () => {
  for (const [name, source] of Object.entries({
    legal: files.legal,
    property: files.property,
    business: files.business,
    personal: files.personal,
    digitalOverview: files.digitalOverview,
    possessionOverview: files.possessionOverview,
  })) {
    assert.match(source, /DashboardAssetSummaryCard|CanonicalAssetOverviewGrid/, `${name} should use shared dashboard summary cards`);
    assert.match(`${source}\n${files.canonicalOverviewGrid}`, /lf-finance-summary-tile/, `${name} should use the finance dashboard tile layout`);
    assert.doesNotMatch(source, /CategoryDashboardCard/, `${name} should not use the retired dashboard card pattern`);
  }
  assert.match(files.canonicalOverviewGrid, /DashboardAssetSummaryCard/);
  assert.match(files.canonicalOverviewGrid, /fetchCanonicalAssets/);
});

test("sidebar launches top-level dashboards instead of submenu flyouts", () => {
  assert.match(files.appLayout, /stripNavigationChildren\(topLevelItems\)/);
  assert.match(files.appLayout, /items=\{dashboardNavigationItems\}/);
  assert.match(files.appLayout, /className="lf-topbar-back"/);
  assert.match(files.sidebarPrimary, /aria-haspopup=\{item\.children\?\.length \? "menu" : undefined\}/);
});

test("record workspaces open the add form from add=1 query links", () => {
  assert.match(files.finances, /\$\{section\.href\}\?add=1/);
  assert.match(files.finances, /emptyState=\{isEmpty\}/);
  assert.match(files.finances, /emptyActionLabel="Add record"/);
  assert.match(files.legal, /\$\{href\}\?add=1/);
  assert.match(files.legal, /emptyState=\{!hasRecords\}/);
  assert.match(files.property, /\$\{item\.href\}\?add=1/);
  assert.match(files.property, /CanonicalAssetOverviewGrid/);
  assert.match(files.property, /emptyState/);
  assert.match(files.business, /\$\{href\}\?add=1/);
  assert.match(files.business, /CanonicalAssetOverviewGrid/);
  assert.match(files.personal, /\$\{item\.href\}\?add=1/);
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

test("empty dashboard cards use a single primary add action", () => {
  assert.match(files.summaryCard, /emptyState = false/);
  assert.match(files.summaryCard, /emptyState \? \(/);
  assert.match(files.summaryCard, /emptyPrimaryActionStyle/);
  assert.match(files.summaryCard, /emptyPrimaryLabelStyle/);
  assert.match(files.summaryCard, /emptyPrimaryIconStyle/);
  assert.match(files.summaryCard, /Icon name="add" size=\{22\}/);
  assert.match(files.summaryCard, /border: "1px solid #e5e0dc"/);
  assert.match(files.summaryCard, /width: 32/);
  assert.match(files.summaryCard, /fontSize: 24/);
  assert.match(files.summaryCard, /color: "#a4afbf"/);
  assert.match(files.summaryCard, /color: "#7f8794"/);
  assert.match(files.summaryCard, /style=\{emptyState \? emptyFooterStyle : footerWrapStyle\}/);
  assert.match(files.summaryCard, /minHeight: 62/);
  assert.match(files.globals, /\.lf-finance-summary-tile \{\s*display: grid;\s*gap: 4px;\s*height: 100%;\s*grid-template-rows: auto 1fr;/);
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
