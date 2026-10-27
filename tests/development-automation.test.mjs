import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { repoIdentity, remoteHeads } from "../scripts/dev/bootstrap.mjs";
import { firstBlocker } from "../scripts/dev/preflight.mjs";
import { validateRequest, APPROVED_ORDER } from "../scripts/staging/migration-guard.mjs";
import { assessRelease } from "../scripts/staging/release-readiness.mjs";

test("bootstrap accepts only the approved repository and parses exact branch heads", () => {
  assert.equal(repoIdentity("https://github.com/ivanTPH/legacy-fortress.git"), true);
  assert.equal(repoIdentity("git@github.com:ivanTPH/legacy-fortress.git"), true);
  assert.equal(repoIdentity("https://github.com/elsewhere/legacy-fortress.git"), false);
  assert.deepEqual(remoteHeads(`${"a".repeat(40)}\trefs/heads/hosted-uat-preparation-20260715`),
    { "hosted-uat-preparation-20260715": "a".repeat(40) });
});

test("preflight reports one actionable blocker and never treats backup presence as restore proof", () => {
  const base = { bootstrap: { dirty: false, pendingFeatureBranches: [], stagingSha: "a", liveTestSha: "a" },
    coolify: { containerVerified: true, appDeploySha: "a", backup: { latestSuccessful: { uuid: "backup" } } },
    database: { clusterId: "1" }, productionClusterId: "2", restoreVerified: false,
    summary: { database: { schemaMatchesHistory: true } }, historyDrift: false };
  assert.match(firstBlocker(base), /isolated restore/);
  assert.equal(firstBlocker({ ...base, restoreVerified: true }), null);
  assert.match(firstBlocker({ ...base, bootstrap: { ...base.bootstrap, dirty: true } }), /Working tree/);
});

test("exact migration guard rejects wrong approval, unexpected pending SQL and order", () => {
  const base = { filename: APPROVED_ORDER[0], checksum: "a".repeat(64), approvalChecksum: "a".repeat(64),
    currentVersions: ["20261026000000"], localVersions: ["20261026000000", "20261027070000", "20261027071500"],
    preflight: { status: "READ_ONLY_READY_APPROVAL_REQUIRED" } };
  assert.equal(validateRequest(base).version, "20261027070000");
  assert.throws(() => validateRequest({ ...base, approvalChecksum: "b".repeat(64) }), /owner-approved/);
  assert.throws(() => validateRequest({ ...base, localVersions: [...base.localVersions, "20261027070500"] }), /Unexpected pending/);
  assert.throws(() => validateRequest({ ...base, filename: APPROVED_ORDER[1] }), /ordering mismatch/);
  assert.throws(() => validateRequest({ ...base, preflight: { status: "BLOCKED", blocker: "restore missing" } }), /restore missing/);
});

test("migration workflow starts disabled, uses a separate environment and leaves app release unchanged", () => {
  const workflow = readFileSync(new URL("../.github/workflows/staging-database-migration.yml", import.meta.url), "utf8");
  assert.match(workflow, /legacy-fortress-staging-db-migrations/);
  assert.match(workflow, /STAGING_DB_MIGRATIONS_ENABLED/);
  assert.doesNotMatch(workflow, /COOLIFY_DEPLOY_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
  const app = readFileSync(new URL("../.github/workflows/staging-release.yml", import.meta.url), "utf8");
  assert.match(app, /expected_sha/);
});

test("application readiness requires exact staging SHA and recorded migration", () => {
  const sha = "a".repeat(40);
  const report = { status: "READ_ONLY_READY_APPROVAL_REQUIRED", branch: "hosted-uat-preparation-20260715",
    head: sha, stagingSha: sha, migrationHistory: ["20261027070000"] };
  assert.equal(assessRelease({ report, expectedSha: sha, requiredMigration: "20261027070000" }), null);
  assert.match(assessRelease({ report, expectedSha: "b".repeat(40) }), /staging HEAD/);
  assert.match(assessRelease({ report, expectedSha: sha, requiredMigration: "20261027071500" }), /not recorded/);
});
