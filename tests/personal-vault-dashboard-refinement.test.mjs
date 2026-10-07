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
  assert.match(summary, /buildActionCentrePreview\([\s\S]*, 3, excludedActionKeys\)/);
  assert.match(summary, /View Action Centre/);
  assert.doesNotMatch(dashboard, /lf-dashboard-fortress-summary/);
  assert.doesNotMatch(dashboard, /<LegacyGuidancePanel|<AddToFortressPanel/);
  assert.match(queue, /getActionCentreActionCount/);
  assert.doesNotMatch(queue, /\.slice\(0, 6\)/);
  assert.match(route, /import DashboardPage from "\.\.\/dashboard\/page"/);
  assert.match(route, /return <DashboardPage \/>/);
  assert.match(dashboard, /const actionCentreOnly = pathname === "\/action-centre"/);
  assert.match(dashboard, /id="action-centre-page-title">Action Centre/);
  assert.doesNotMatch(dashboard, /showFullActionCentre/);
  assert.doesNotMatch(route, /redirect\(/);
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

test("Action Centre actions expose one reusable delivery contract and entry prompt is session-scoped", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  const prompt = read("app/(app)/components/dashboard/ActionCentreEntryPrompt.tsx");

  assert.match(queue, /source: "readiness" \| "workflow" \| "task"/);
  assert.match(queue, /dismissible: boolean/);
  assert.match(queue, /snoozable: boolean/);
  assert.match(queue, /eligibleChannels: Array<"in_app" \| "login" \| "email" \| "push">/);
  assert.match(queue, /eligibleChannels: guidanceItem \? \["in_app", "login", "email", "push"\]/);
  assert.match(dashboard, /lf:action-centre-entry-prompt:session/);
  assert.match(dashboard, /window\.sessionStorage\.getItem\(promptKey\) === "shown"/);
  assert.match(dashboard, /viewer\.mode === "linked"/);
  assert.match(prompt, /role="status"/);
  assert.match(prompt, /A small step for your Fortress/);
});

test("dashboard uses customer-facing records wording and keeps full actions on the dedicated route", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  assert.match(dashboard, /Your Fortress Records/);
  assert.doesNotMatch(dashboard, /Your Fortress at a glance/);
  assert.match(dashboard, /if \(actionCentreOnly\) \{/);
  assert.match(dashboard, /<ActionQueuePanel/);
});

test("Action Centre is a direct inbox with action-specific CTAs and no empty bucket furniture", () => {
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  const summary = read("app/(app)/components/dashboard/DashboardActionSummary.tsx");
  const prompt = read("app/(app)/components/dashboard/ActionCentreEntryPrompt.tsx");

  assert.match(queue, /function ActionCentreInbox/);
  assert.match(queue, /Add a copy of your Will/);
  assert.match(queue, /return item\.blockerLabel\.toLowerCase\(\)\.includes\("accept"\) \? "View invitation" : "Send invitation"/);
  assert.match(queue, /return "Continue setup"/);
  assert.match(queue, /return "See what to do next"/);
  assert.match(queue, /label\.includes\("failed"\)\) return "High"/);
  assert.match(queue, /if \(item\.stageKey === "contacts"\) return "Medium"/);
  assert.doesNotMatch(queue, /aria-expanded=\{isOpen\}/);
  assert.doesNotMatch(queue, />Review invite<|>Open Contacts<|>Open Legal</);
  assert.match(summary, /onAction\(item\.actionKey, item\.href\)/);
  assert.match(prompt, /onAction\(item\.actionKey, item\.href\)/);
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
