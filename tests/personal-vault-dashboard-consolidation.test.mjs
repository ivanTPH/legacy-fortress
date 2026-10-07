import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Personal Vault presents one action system and persistent creation destinations", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const manifest = read("config/routeManifest.tsx");
  const actionQueue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  const addPage = read("app/(app)/add-to-fortress/page.tsx");

  assert.match(manifest, /id: "add-to-fortress"[\s\S]*path: "\/add-to-fortress"/);
  assert.match(manifest, /id: "action-centre"[\s\S]*path: "\/action-centre"/);
  assert.match(addPage, /<AddToFortressPanel \/>/);
  assert.match(dashboard, /guidanceItems=\{guidanceItems\}/);
  assert.match(actionQueue, /buildGuidanceActionRows/);
  assert.match(actionQueue, /onGuidanceDecision/);
  assert.doesNotMatch(dashboard, /<LegacyGuidancePanel/);
  assert.doesNotMatch(dashboard, /<AddToFortressPanel/);
  assert.doesNotMatch(dashboard, /aria-label="Estate readiness summary"/);
});

test("category summaries separate opening a category from adding another record", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const summaryCard = read("app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx");

  assert.match(summaryCard, /addHref\?: string/);
  assert.match(summaryCard, /label=\{addLabel \?\? `Add/);
  assert.match(dashboard, /addHref="\/property\?add=1"/);
  assert.match(dashboard, /addLabel="Add property"/);
  assert.match(dashboard, /addHref="\/finances"/);
  assert.match(dashboard, /addLabel="Add financial record"/);
  assert.match(dashboard, /addHref="\/vault\/personal\/records\?add=1&possessionCategory=other"/);
});

test("multiple records remain a count-based snapshot rather than a single-record slot", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const createAsset = read("lib/assets/createAsset.ts");

  assert.match(dashboard, /value=\{String\(propertyRecordCount\)\}/);
  assert.match(dashboard, /propertyRecordCount === 1 \? "" : "s"/);
  assert.match(createAsset, /\.insert\(/);
  assert.doesNotMatch(createAsset, /\.upsert\(/);
});

test("customer action routes remain deep-linkable and owner controls stay optional", () => {
  const guidance = read("lib/readiness/guidance.ts");
  const actionQueue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");

  assert.match(guidance, /href: "\/legal\/wills\?add=1"/);
  assert.match(guidance, /href: "\/contacts\?group=executors"/);
  assert.match(actionQueue, /item\.href/);
  assert.match(actionQueue, /requiredRole: "owner"/);
  assert.match(actionQueue, /Already done/);
  assert.match(actionQueue, /Not relevant/);
  assert.match(actionQueue, /Remind me later/);
});
