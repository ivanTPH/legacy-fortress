import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("/app dashboard and onboarding aliases redirect to canonical routes", () => {
  const dashboardAlias = fs.readFileSync(path.join(root, "app/(app)/app/dashboard/page.tsx"), "utf8");
  const onboardingAlias = fs.readFileSync(path.join(root, "app/(app)/app/onboarding/page.tsx"), "utf8");

  assert.match(dashboardAlias, /redirect\("\/dashboard"\)/);
  assert.match(onboardingAlias, /redirect\("\/onboarding"\)/);
});
