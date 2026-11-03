import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("profile and account settings have separate canonical destinations", () => {
  const profilePage = fs.readFileSync(path.join(root, "app/(app)/profile/page.tsx"), "utf8");
  const settingsPage = fs.readFileSync(path.join(root, "app/(app)/settings/page.tsx"), "utf8");
  const appLayout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
  const accessibilityPage = fs.readFileSync(path.join(root, "app/(app)/account/accessibility/page.tsx"), "utf8");
  const routeManifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");

  assert.match(profilePage, /href="\/settings"/);
  assert.match(settingsPage, /href: "\/account\/accessibility"/);
  assert.match(settingsPage, /href="\/profile"/);
  assert.match(appLayout, /\["\/settings", "Settings", "settings"\]/);
  assert.doesNotMatch(profilePage, /title="Accessibility and guided help"/);
  assert.match(accessibilityPage, /title="Accessibility"/);
  assert.match(accessibilityPage, /<AccessibilitySettingsCard \/>/);
  assert.match(routeManifest, /settings-accessibility/);
  assert.match(routeManifest, /path: "\/account\/accessibility"/);
});

test("billing overview shows plan status as plain words, never raw codes", () => {
  const billingPage = fs.readFileSync(path.join(root, "app/(app)/account/billing/page.tsx"), "utf8");

  assert.match(billingPage, /"Free trial"/);
  assert.match(billingPage, /"Payment due"/);
  assert.doesNotMatch(billingPage, /\{status\?\.status\}/);
});

test("billing page shows the real plan and hands payment to Stripe", () => {
  const billingPage = fs.readFileSync(path.join(root, "app/(app)/account/billing/page.tsx"), "utf8");
  const dashboardPage = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const portalRoute = fs.readFileSync(path.join(root, "app/api/billing/portal/route.ts"), "utf8");

  assert.match(billingPage, /reason === "plan-limit"/);
  assert.match(billingPage, /Manage subscription/);
  assert.match(billingPage, /Your card details never reach Legacy Fortress/);
  assert.match(dashboardPage, /isPlanLimitStatus\(status\)/);
  assert.match(dashboardPage, /showPremiumSheet\("people"\)/);
  assert.match(portalRoute, /billing_portal\/sessions/);
  assert.match(portalRoute, /Payments aren’t set up on this server yet|Payments aren't set up on this server yet/);
});
