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
  assert.match(historyScript, /appears \$existing_count times/);
  assert.match(historyScript, /already exists exactly once/);
  assert.match(historyScript, /Unexpected migration-history convention/);
  assert.match(historyScript, /20260905120000/);
  assert.doesNotMatch(historyScript, /DROP|ALTER TABLE|CREATE TABLE/);
  for (const match of historyScript.matchAll(/DO\s+\$\$(.*?)\$\$/gis)) {
    assert.doesNotMatch(match[1], /:'migration_(?:version|name)'/);
  }
  assert.doesNotMatch(historyScript, /DO\s+\$\$/i);
  assert.match(historyScript, /INSERT INTO supabase_migrations\.schema_migrations/);
  assert.match(historyScript, /verified_count/);
});

test("revocation records the authenticated Platform Admin actor", () => {
  assert.match(script, /revoked_by_user_id !== platformAdmin\.id/);
  assert.match(script, /Sensitive estate approval revoked/);
  assert.match(script, /revokeAudit\.data\.actor_user_id !== platformAdmin\.id/);
});

test("participant approval service enforces estate eligibility and independent approval", () => {
  const service = fs.readFileSync("lib/estate-administration/service.ts", "utf8");
  assert.match(service, /requireEstatePermission\(client, request\.estate_case_id, input\.approverUserId, "approve_sensitive_action"\)/);
  assert.match(service, /getIdentityPresenceLevel\(client, input\.approverUserId\)/);
  assert.match(service, /assertIndependentApproval/);
  assert.match(service, /request\.expires_at/);
  assert.match(service, /sensitive_action_not_pending/);
  const quorum = fs.readFileSync("lib/estate-administration/quorum.ts", "utf8");
  assert.match(quorum, /requesterUserId/);
  assert.match(quorum, /ownerUserId/);
  assert.match(quorum, /sensitive_action_duplicate_approval_denied/);
});

test("harness stores estate participant permissions in the canonical capabilities shape", () => {
  assert.match(script, /permissions: \{ capabilities: permissions \}/);
  assert.match(script, /canonical participant permission fixtures verified/);
  assert.match(script, /participantRows\.data\.some\(\(row\) => row\.user_id === platformAdmin\.id\)/);
});

test("sensitive-action requests expose and verify bounded expiry", () => {
  assert.match(script, /request\.expires_at/);
  assert.match(script, /Date\.parse\(expiresAt\) <= Date\.now\(\)/);
  const service = fs.readFileSync("lib/estate-administration/service.ts", "utf8");
  assert.match(service, /select\("id,status,required_approvals,expires_at"\)/);
});

test("known sensitive-action denials use safe non-500 HTTP statuses", () => {
  const api = fs.readFileSync("lib/estate-administration/api.ts", "utf8");
  assert.match(api, /sensitive_action_duplicate_approval_denied/);
  assert.match(api, /sensitive_action_self_approval_denied/);
  assert.match(api, /expired" \? 410/);
  assert.match(api, /\? 409/);
  assert.match(api, /\? 403/);
  assert.match(api, /sensitive_action_error/);
  for (const route of [
    fs.readFileSync("app/api/estate/cases/[caseId]/sensitive-actions/route.ts", "utf8"),
    fs.readFileSync("app/api/estate/cases/[caseId]/sensitive-actions/[requestId]/approve/route.ts", "utf8"),
  ]) assert.match(route, /sensitiveActionErrorResponse/);
});
