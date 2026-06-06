import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("contextual help popover stays reusable, accessible, and mobile safe", () => {
  const infoTip = fs.readFileSync(path.join(root, "components/ui/InfoTip.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const appLayout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");

  assert.equal(fs.existsSync(path.join(root, "public/fonts/material-symbols-outlined.ttf")), true);
  assert.match(css, /@font-face \{\s*font-family: "Material Symbols Outlined"/);
  assert.match(css, /src: url\("\/fonts\/material-symbols-outlined\.ttf"\) format\("truetype"\)/);
  assert.doesNotMatch(appLayout, /fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined/);
  assert.match(infoTip, /type InfoTipProps = \{/);
  assert.match(infoTip, /message: ReactNode/);
  assert.match(infoTip, /title\?: ReactNode/);
  assert.match(infoTip, /tone\?: "default" \| "security" \| "warning"/);
  assert.match(infoTip, /alwaysVisible\?: boolean/);
  assert.match(infoTip, /useAccessibilityPreferences/);
  assert.match(infoTip, /preferences\.contextualHelpEnabled === false/);
  assert.match(infoTip, /return null/);
  assert.match(infoTip, /aria-describedby=\{open \? tipId : undefined\}/);
  assert.match(infoTip, /aria-expanded=\{open\}/);
  assert.match(infoTip, /role="tooltip"/);
  assert.match(infoTip, /className="lf-info-tip-popover lf-info-tip-tooltip"/);
  assert.match(infoTip, /document\.addEventListener\("pointerdown", closeOnPointerDown\)/);
  assert.match(infoTip, /document\.removeEventListener\("pointerdown", closeOnPointerDown\)/);
  assert.match(infoTip, /event\.key === "Escape"/);
  assert.match(infoTip, /width: 22/);
  assert.match(infoTip, /height: 22/);
  assert.match(infoTip, /border: 0/);
  assert.match(infoTip, /background: "#f4f2ef"/);
  assert.match(infoTip, /color: "#111827"/);
  assert.match(infoTip, /fontWeight: 800/);
  assert.doesNotMatch(infoTip, /<Icon name="info"/);
  assert.match(infoTip, /width: "min\(280px, calc\(100vw - 32px\)\)"/);
  assert.match(css, /width: min\(280px, calc\(100vw - 32px\)\) !important;/);
  assert.match(css, /\.lf-panel-help \{\s*margin-left: auto;\s*\}/);
});

test("dashboard introduces contextual help without changing core navigation", () => {
  const dashboardPage = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const actionQueue = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ActionQueuePanel.tsx"), "utf8");

  assert.match(dashboardPage, /import InfoTip from "\.\.\/\.\.\/\.\.\/components\/ui\/InfoTip"/);
  assert.match(dashboardPage, /label="Explain dashboard overview"/);
  assert.match(dashboardPage, /className="lf-panel-help"/);
  assert.match(dashboardPage, /title="Dashboard overview"/);
  assert.match(dashboardPage, /className="lf-dashboard-readiness-heading"/);
  assert.match(dashboardPage, /label="Explain estate readiness"/);
  assert.match(dashboardPage, /title="Estate readiness"/);
  assert.match(dashboardPage, /tone="security"/);
  assert.match(actionQueue, /import InfoTip from "\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/InfoTip"/);
  assert.match(actionQueue, /label="Explain Action Centre"/);
  assert.match(actionQueue, /title="Action Centre"/);
  assert.match(actionQueue, /tone="warning"/);
  assert.match(actionQueue, /className="lf-panel-help"/);
  assert.match(dashboardPage, /href="\/finances"/);
  assert.match(actionQueue, /onAction\(item\.actionKey\)/);
});

test("accessibility settings can turn contextual help off without hiding its own control", () => {
  const preferences = fs.readFileSync(path.join(root, "lib/accessibilityPreferences.ts"), "utf8");
  const settingsCard = fs.readFileSync(path.join(root, "components/accessibility/AccessibilitySettingsCard.tsx"), "utf8");
  const appLayout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");

  assert.match(preferences, /contextualHelpEnabled: boolean/);
  assert.match(preferences, /contextualHelpEnabled: true/);
  assert.match(preferences, /record\.contextualHelpEnabled === false \? false : defaults\.contextualHelpEnabled/);
  assert.match(settingsCard, /checked=\{draft\.contextualHelpEnabled\}/);
  assert.match(settingsCard, /contextualHelpEnabled: event\.target\.checked/);
  assert.match(settingsCard, /Contextual help icons/);
  assert.match(settingsCard, /alwaysVisible/);
  assert.match(appLayout, /data-lf-contextual-help=\{accessibilityPreferences\.contextualHelpEnabled \? "true" : "false"\}/);
});
