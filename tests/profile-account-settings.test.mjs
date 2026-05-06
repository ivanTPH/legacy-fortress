import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("profile keeps accessibility inside account settings links instead of a standalone accessibility panel", () => {
  const profilePage = fs.readFileSync(path.join(root, "app/(app)/profile/page.tsx"), "utf8");
  const accessibilityPage = fs.readFileSync(path.join(root, "app/(app)/account/accessibility/page.tsx"), "utf8");
  const routeManifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");

  assert.match(profilePage, /title="Account settings"/);
  assert.match(profilePage, /href: "\/account\/accessibility"/);
  assert.doesNotMatch(profilePage, /title="Accessibility and guided help"/);
  assert.match(accessibilityPage, /title="Accessibility"/);
  assert.match(accessibilityPage, /<AccessibilitySettingsCard \/>/);
  assert.match(routeManifest, /settings-accessibility/);
  assert.match(routeManifest, /path: "\/account\/accessibility"/);
});

test("billing overview formats plan status labels for display text", () => {
  const billingPage = fs.readFileSync(path.join(root, "app/(app)/account/billing/page.tsx"), "utf8");

  assert.match(billingPage, /formatPlanStatusLabel/);
  assert.match(billingPage, /replace\(\/_\/g, " "\)/);
  assert.match(billingPage, /replace\(\/\\b\\w\/g/);
});

test("billing panel exposes safe test subscription state for plan-limit redirects", () => {
  const billingPage = fs.readFileSync(path.join(root, "app/(app)/account/billing/page.tsx"), "utf8");
  const dashboardPage = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const portalRoute = fs.readFileSync(path.join(root, "app/api/billing/portal/route.ts"), "utf8");

  assert.match(billingPage, /reason === "plan-limit" \|\| reason === "invite-status"/);
  assert.match(billingPage, /Test subscription state/);
  assert.match(billingPage, /Safe test\/admin controls/);
  assert.match(billingPage, /They do not process payments or expose payment provider data/);
  assert.match(dashboardPage, /isPlanLimitStatus\(status\)/);
  assert.match(dashboardPage, /\/account\/billing\?reason=plan-limit/);
  assert.match(portalRoute, /STRIPE_SECRET_KEY/);
  assert.match(portalRoute, /Billing portal is not configured/);
});
