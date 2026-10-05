import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("category cards use card=view and plus=add semantics", () => {
  const card = read("app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx");
  const dashboard = read("app/(app)/dashboard/page.tsx");

  assert.match(card, /role="group"/);
  assert.match(card, /aria-label=\{`Open \$\{title\}`\}/);
  assert.match(card, /router\.push\(href\)/);
  assert.match(card, /icon="add"/);
  assert.match(card, /router\.push\(addHref\)/);
  assert.match(card, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(card, /icon=\{actionIcon\}/);
  assert.match(dashboard, /title="Finances"/);
  assert.match(dashboard, /addLabel="Add property"/);
});

test("dashboard uses a compact preview while Action Centre retains the full list", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const summary = read("app/(app)/components/dashboard/DashboardActionSummary.tsx");
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  const route = read("app/(app)/action-centre/page.tsx");

  assert.match(dashboard, /<DashboardActionSummary/);
  assert.match(summary, /buildActionCentrePreview\([\s\S]*, 3\)/);
  assert.match(summary, /View \{count > 3 \? `all \$\{count\}` : "Action Centre"\}/);
  assert.doesNotMatch(dashboard, /lf-dashboard-fortress-summary/);
  assert.doesNotMatch(dashboard, /<LegacyGuidancePanel|<AddToFortressPanel/);
  assert.match(queue, /getActionCentreActionCount/);
  assert.doesNotMatch(queue, /\.slice\(0, 6\)/);
  assert.match(route, /redirect\("\/dashboard\?view=action-centre#action-centre"\)/);
});

test("Action Centre count is derived from active rows and shared with navigation", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const layout = read("app/(app)/layout.tsx");
  const sidebar = read("app/(app)/components/navigation/SidebarPrimary.tsx");
  const mobile = read("app/(app)/components/navigation/MobileNavTree.tsx");
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");

  assert.match(queue, /section\.key !== "completed" && section\.key !== "clear"/);
  assert.match(dashboard, /sessionStorage\.setItem\("lf:action-centre-count"/);
  assert.match(dashboard, /lf-action-centre-count/);
  assert.match(layout, /lf:action-centre-count/);
  assert.match(layout, /badge: actionCentreCount > 0/);
  assert.match(sidebar, /lf-nav-badge/);
  assert.match(mobile, /lf-nav-badge/);
});

test("dashboard keeps multiple-record creation and linked viewers read-only", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const createAsset = read("lib/assets/createAsset.ts");
  const card = read("app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx");

  assert.match(createAsset, /\.insert\(/);
  assert.doesNotMatch(createAsset, /\.upsert\(/);
  assert.match(dashboard, /viewer\.mode === "linked" \? undefined/);
  assert.match(card, /addHref\?: string/);
});
