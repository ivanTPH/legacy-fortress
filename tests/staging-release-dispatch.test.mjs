import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/staging/dispatch-release.mjs", import.meta.url), "utf8");

test("local release dispatch is locked to the repository and staging branch", () => {
  assert.match(source, /ivanTPH/);
  assert.match(source, /legacy-fortress/);
  assert.match(source, /hosted-uat-preparation-20260715/);
  assert.match(source, /staging-release\.yml/);
  assert.match(source, /expected_sha/);
  assert.match(source, /expected_sha_must_equal_committed_head/);
  assert.match(source, /expected_sha_must_be_pushed_to_origin/);
});

test("dispatch uses a caller-supplied token and never prints it", () => {
  assert.match(source, /GITHUB_TOKEN.*GH_TOKEN/);
  assert.match(source, /dispatches/);
  assert.match(source, /actions\/workflows/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(GITHUB_TOKEN|GH_TOKEN|Authorization)/);
  assert.doesNotMatch(source, /printenv|set -x/);
});

test("dispatch passes the exact SHA and reports failed workflow steps", () => {
  assert.match(source, /inputs: \{ expected_sha: expectedSha \}/);
  assert.match(source, /run\.head_sha === expectedSha/);
  assert.match(source, /failedSteps/);
  assert.match(source, /run\.conclusion !== "success"/);
});
