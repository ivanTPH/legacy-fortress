import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("onboarding includes vault category selection and persists shared preferences", () => {
  const config = fs.readFileSync(path.join(root, "config/onboarding.config.ts"), "utf8");
  const onboardingPage = fs.readFileSync(path.join(root, "app/onboarding/OnboardingPageClient.tsx"), "utf8");
  const settingsRoute = fs.readFileSync(path.join(root, "app/(app)/settings/page.tsx"), "utf8");

  assert.match(config, /"vault_categories"/);
  assert.match(onboardingPage, /Choose your vault categories/);
  assert.match(onboardingPage, /saveVaultPreferences/);
  assert.match(onboardingPage, /getVaultSubsectionsForGroup/);
  assert.match(onboardingPage, /"vault_categories"/);
  assert.match(settingsRoute, /router\.replace\("\/account\/my-vault"\)/);
});
