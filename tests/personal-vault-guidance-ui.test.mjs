import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
const actionCentre = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ActionQueuePanel.tsx"), "utf8");

test("Personal Vault renders structured guidance and keeps linked viewers read-only", () => {
  assert.match(dashboard, /buildGuidanceItems/);
  assert.match(dashboard, /guidanceItems=\{guidanceItems\}/);
  assert.match(dashboard, /onGuidanceDecision=\{viewer\.mode === "linked" \? undefined/);
  assert.match(dashboard, /saveVaultPreferences/);
  assert.doesNotMatch(dashboard, /<LegacyGuidancePanel/);
});

test("guidance actions remain understandable and do not expose technical permission machinery", () => {
  assert.match(actionCentre, /Already done/);
  assert.match(actionCentre, /Not relevant/);
  assert.match(actionCentre, /Remind me later/);
  assert.match(actionCentre, /learnMoreHref/);
  assert.doesNotMatch(actionCentre, /service.role|invitation token|biometric/i);
});
