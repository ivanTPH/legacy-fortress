import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/staging/run-probate-quorum-acceptance.mjs", "utf8");
const historyScript = fs.readFileSync("scripts/staging/reconcile-phase7-migration-history.sh", "utf8");

test("staging acceptance harness fails closed outside explicit staging", () => {
  assert.match(script, /LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE/);
  assert.match(script, /APP_ENV.*staging/);
  assert.match(script, /LEGACY_FORTRESS_ENV.*staging/);
  assert.match(script, /Refusing to run/);
  assert.match(script, /legacy-fortress/);
  assert.match(script, /supabase\\.co/);
  assert.match(script, /const platformAdmin = await createUser/);
  assert.match(script, /await addAdminRow\(admin, platformAdmin\)/);
  assert.doesNotMatch(script, /await addAdminRow\(admin, owner\)/);
  assert.doesNotMatch(script, /await addAdminRow\(admin, requester\)/);
  assert.doesNotMatch(script, /await addAdminRow\(admin, approver1\)/);
  assert.doesNotMatch(script, /await addAdminRow\(admin, approver2\)/);
});

test("harness uses synthetic-only prefixes and staging endpoints", () => {
  assert.match(script, /phase7-quorum-/);
  assert.match(script, /example\.test/);
  assert.match(script, /test\.mylegacyfortress\.com/);
  assert.match(script, /supabase-test\.mylegacyfortress\.com/);
});

test("harness asserts quorum, duplicate, self-approval, revocation and expiry invariants", () => {
  for (const fragment of [
    "required: 2, approved: 1, remaining: 1",
    "required: 2, approved: 2, remaining: 0",
    "duplicate approval",
    "requester self-approval",
    "owner self-approval",
    "self-approval trigger",
    "concurrent duplicate race",
    "revoked_at",
    "expired request",
    "lf_sensitive_action_quorum_met",
  ]) assert.match(script, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("estate approval route authenticates the participant and binds request to case", () => {
  const route = fs.readFileSync("app/api/estate/cases/[caseId]/sensitive-actions/[requestId]/approve/route.ts", "utf8");
  assert.match(route, /requireIdentityApiAccess/);
  assert.match(route, /eq\("estate_case_id", caseId\)/);
  assert.match(route, /approveSensitiveEstateAction/);
  assert.doesNotMatch(route, /requireAdminAccess/);
});

test("harness cleanup removes mutable fixtures and supports explicit retention", () => {
  assert.match(script, /KEEP_STAGING_ACCEPTANCE_FIXTURE/);
  assert.match(script, /mutable fixtures removed/);
  assert.match(script, /append-only audit history retained/);
  assert.match(script, /cleanup failed/);
});

test("migration-history repair is staging-only, idempotent and refuses unknown conventions", () => {
  assert.match(historyScript, /supabase-db-wdf2fyo7hrewev6hnqypd2vc/);
  assert.match(historyScript, /existing_count > 1/);
  assert.match(historyScript, /already exists exactly once/);
  assert.match(historyScript, /Unexpected migration-history convention/);
  assert.match(historyScript, /20260905120000/);
  assert.doesNotMatch(historyScript, /DROP|ALTER TABLE|CREATE TABLE/);
});
