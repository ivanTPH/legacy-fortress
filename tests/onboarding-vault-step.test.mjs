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
  // Guided set-up (UX review, 10 Nov 2026): three questions feed the same shared preferences; Skip keeps every area on.
  assert.match(onboardingPage, /saveVaultPreferences/);
  // Everyday things first (owner, 10 Nov 2026); the Will and Power of Attorney come later via Your next steps.
  assert.match(onboardingPage, /What would you like to keep safe\?/);
  assert.match(onboardingPage, /Bank and savings accounts/);
  assert.doesNotMatch(onboardingPage, /Do you have a Will|Power of Attorney\?|Your Will|My executor|history_edu/);
  // One way out, worded the same everywhere (owner, 10 Nov 2026): "Skip this step" and "Skip set-up".
  assert.match(onboardingPage, /className="lf-setup-skip" onClick=\{\(\) => void skipSetUp\(\)\}[^>]*>Skip set-up</);
  assert.equal((onboardingPage.match(/>Skip this step</g) ?? []).length + (onboardingPage.match(/: "Skip this step"\}/g) ?? []).length, 3, "three steps, each with Skip this step");
  assert.doesNotMatch(onboardingPage, /I’ll do this later|explore on my own|Skip this question|from Help/);
  assert.match(onboardingPage, /"vault_categories"/);
  assert.match(onboardingPage, /saveTermsAcceptance\(supabase, userId, \{ accepted: true, source: "onboarding" \}\)/);
  assert.match(onboardingPage, /By continuing or skipping, you agree to our/);
  assert.match(onboardingPage, /is_completed: true/);
  assert.doesNotMatch(onboardingPage, /invite|sendInvitation|grant/i, "set-up never invites or shares");
  // Settings is now a page of links (V5); My Vault is one of them.
  assert.match(settingsRoute, /href: "\/account\/my-vault"/);
});
