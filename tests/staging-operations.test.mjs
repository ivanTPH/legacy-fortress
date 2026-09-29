import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/staging/operations.mjs", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../.github/workflows/staging-release.yml", import.meta.url), "utf8");

test("staging operations are allowlisted to the Legacy Fortress staging targets", () => {
  assert.match(source, /yka9huzmm56hjpz1gno448fb/);
  assert.match(source, /test\.mylegacyfortress\.com/);
  assert.match(source, /supabase-test\.mylegacyfortress\.com/);
  assert.match(source, /hosted-uat-preparation-20260715/);
  assert.match(source, /staging_version_environment_mismatch/);
});

test("deployment requires explicit approval and exact Coolify identity/branch", () => {
  assert.match(source, /STAGING_DEPLOY_APPROVED.*true/);
  assert.match(source, /COOLIFY_DEPLOY_WEBHOOK/);
  assert.match(source, /coolify_deploy_webhook_application_mismatch/);
  assert.match(source, /Authorization: `Bearer \$\{process\.env\.COOLIFY_DEPLOY_TOKEN\}`/);
});

test("workflow keeps acceptance secrets in the protected staging environment", () => {
  assert.match(workflow, /environment: legacy-fortress-staging/);
  assert.match(workflow, /STAGING_SUPABASE_ANON_KEY/);
  assert.match(workflow, /STAGING_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /echo.*(KEY|TOKEN)|printenv|set -x/i);
});

test("workflow verifies the requested SHA before deployment", () => {
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /expected_sha/);
  assert.match(source, /staging_sha_not_live/);
});

test("release skips Coolify mutation when the exact staging SHA is already live", () => {
  assert.match(source, /async function ensureDeployment\(expectedSha\)/);
  assert.match(source, /if \(current\.commitSha === expectedSha\)/);
  assert.match(source, /if \(command === "release"\) await ensureDeployment\(expectedSha\)/);
});
