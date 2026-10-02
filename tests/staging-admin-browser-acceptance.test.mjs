import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const spec = readFileSync(new URL("../tests/e2e/staging-admin-role-boundary.spec.ts", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/staging-release.yml", import.meta.url), "utf8");

test("staging browser acceptance fails closed on target, authorization and exact SHA", () => {
  assert.match(spec, /LEGACY_FORTRESS_ALLOW_STAGING_BROWSER === "true"/);
  assert.match(spec, /https:\/\/test\.mylegacyfortress\.com/);
  assert.match(spec, /https:\/\/supabase-test\.mylegacyfortress\.com/);
  assert.match(spec, /version\.env !== "staging" \|\| version\.commitSha !== EXPECTED_SHA/);
  assert.match(spec, /if \(!ANON_KEY \|\| !SERVICE_KEY\)/);
});

test("staging browser acceptance creates and cleans only synthetic fixtures", () => {
  assert.match(spec, /RUN_MARKER/);
  assert.match(spec, /enterprise_memberships.*delete/);
  assert.match(spec, /auth\.admin\.deleteUser/);
  assert.doesNotMatch(spec, /console\.log\([^)]*(PASSWORD|SERVICE_KEY|ANON_KEY)/);
  assert.match(workflow, /LEGACY_FORTRESS_ALLOW_STAGING_BROWSER: "true"/);
  assert.match(workflow, /npm run test:e2e:staging-admin/);
});

test("browser acceptance covers platform, enterprise and personal boundaries", () => {
  for (const phrase of ["platform admin remains in admin context", "enterprise admin is organisation-scoped", "personal user cannot enter administrative workspaces", "api/internal/admin/admin-users", "Account menu"]) {
    assert.match(spec, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
