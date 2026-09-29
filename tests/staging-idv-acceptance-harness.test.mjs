import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const runner = fs.readFileSync(path.join(root, "scripts/staging/run-invitation-idv-acceptance.mjs"), "utf8");

test("hosted IDV runner is staging-locked before mutation", () => {
  assert.match(runner, /LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE/);
  assert.match(runner, /APP_ENV !== "staging"/);
  assert.match(runner, /LEGACY_FORTRESS_ENV !== "staging"/);
  assert.match(runner, /https:\/\/test\.mylegacyfortress\.com/);
  assert.match(runner, /https:\/\/supabase-test\.mylegacyfortress\.com/);
  assert.match(runner, /version\.env !== "staging"/);
  assert.match(runner, /version\.commitSha !== EXPECTED_SHA/);
});

test("hosted IDV runner rejects missing credentials before mutation", () => {
  assert.match(runner, /required\("NEXT_PUBLIC_SUPABASE_ANON_KEY"\)/);
  assert.match(runner, /required\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(runner, /config = await proveEnvironment\(\)/);
  assert.match(runner, /admin = makeClient/);
  assert.ok(runner.indexOf("config = await proveEnvironment()") < runner.indexOf("const owner = await createUser(admin"));
});

test("IDV runner drives the application boundary and does not seed terminal state", () => {
  for (const route of ["/api/identity-verification", "/document", "/challenge", "/camera", "/complete"]) {
    assert.match(runner, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(runner, /\.from\("identity_assurance_states"\)\.insert/);
  assert.doesNotMatch(runner, /\.from\("identity_verification_decisions"\)\.insert/);
  assert.match(runner, /challenge_replay/);
  assert.match(runner, /missing_consent/);
  assert.match(runner, /cross_user_context/);
  assert.match(runner, /wrong_invitation_context/);
  assert.match(runner, /document-failed/);
  assert.match(runner, /stale_level_3_presence/);
  assert.match(runner, /callbackReplay/);
});

test("contact fixture matches the canonical contact status schema and exposes safe DB diagnostics", () => {
  assert.match(runner, /invite_status: "invite_sent"/);
  assert.doesNotMatch(runner, /invite_status: "invited"/);
  assert.match(runner, /\["code", "message", "details", "hint"\]/);
  assert.match(runner, /database_error/);
  assert.doesNotMatch(runner, /const message = error instanceof Error/);
});

test("cleanup checks mutable deletes and retains audit history", () => {
  assert.match(runner, /if \(result\.error\) failures\.push/);
  assert.match(runner, /audit_history: "retained"/);
  assert.match(runner, /activation_status: "revoked"/);
  assert.match(runner, /identity-verification\/\$\{requestId\}\/cleanup/);
  assert.doesNotMatch(runner, /identity_verification_requests"\)\.delete/);
  assert.match(runner, /auth_users_and_contact_rows: "retained_for_audit_integrity"/);
});
