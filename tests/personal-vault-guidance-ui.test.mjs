import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
const panel = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/LegacyGuidancePanel.tsx"), "utf8");

test("Personal Vault renders structured guidance and keeps linked viewers read-only", () => {
  assert.match(dashboard, /buildGuidanceItems/);
  assert.match(dashboard, /<LegacyGuidancePanel/);
  assert.match(dashboard, /ownerActionsEnabled=\{viewer\.mode !== "linked"\}/);
  assert.match(dashboard, /saveVaultPreferences/);
});

test("guidance actions remain understandable and do not expose technical permission machinery", () => {
  assert.match(panel, /Already done/);
  assert.match(panel, /Not relevant/);
  assert.match(panel, /Remind me later/);
  assert.match(panel, /Learn more/);
  assert.doesNotMatch(panel, /service.role|invitation token|biometric/i);
});
