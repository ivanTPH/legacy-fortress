import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");
const actionQueue = await readFile(new URL("../app/(app)/components/dashboard/ActionQueuePanel.tsx", import.meta.url), "utf8");
const preferences = await readFile(new URL("../lib/vaultPreferences.ts", import.meta.url), "utf8");

test("unknown Will state is answered before the dashboard offers a record journey", () => {
  assert.match(dashboard, /handleGuidanceApplicability/);
  assert.match(actionQueue, /Yes, I have a Will/);
  assert.match(actionQueue, /No, I don&apos;t have one/);
  assert.match(actionQueue, /I&apos;m not sure/);
  assert.doesNotMatch(actionQueue, /key:\s*"dashboard-upload-will"/);
});

test("applicability answers use persisted vault preferences rather than a second state store", () => {
  assert.match(preferences, /setVaultApplicability/);
  assert.match(preferences, /updatedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(dashboard, /saveVaultPreferences\(supabase, user\.id, setVaultApplicability/);
});

test("executor guidance is downstream of a recorded Will and executor evidence", async () => {
  const guidance = await readFile(new URL("../lib/readiness/guidance.ts", import.meta.url), "utf8");
  assert.match(guidance, /evidence\.willCount > 0 && evidence\.executorCount === 0/);
  assert.match(guidance, /evidence\.executorCount > 0/);
});

test("existing probate controls remain the authority for post-death access", async () => {
  const lifecycle = await readFile(new URL("../lib/estate-lifecycle/service.ts", import.meta.url), "utf8");
  const administration = await readFile(new URL("../lib/estate-administration/service.ts", import.meta.url), "utf8");
  assert.match(lifecycle, /ESTATE_LOCKED/);
  assert.match(administration, /estate_case_requires_locked_vault/);
  assert.match(administration, /prior_version_cross_case_denied/);
});
