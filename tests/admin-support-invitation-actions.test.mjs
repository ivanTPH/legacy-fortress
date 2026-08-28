import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("support invitation detail route is canonical, no-store, capability gated, and audited", () => {
  const route = read("app/api/internal/admin/support/[invitationId]/route.ts");

  assert.match(route, /requireAdminAccess\(request\)/);
  assert.match(route, /requireAdminCapability\(admin\.access, "support:read"\)/);
  assert.match(route, /requireAdminCapability\(admin\.access, "support:manage"\)/);
  assert.match(route, /loadSupportInvitationDetail/);
  assert.match(route, /resendSupportInvitation/);
  assert.match(route, /revokeSupportInvitation/);
  assert.match(route, /checkAdminLifecycleRateLimit/);
  assert.match(route, /recordAdminAuditEvent/);
  assert.match(route, /restricted_action_blocked/);
  assert.match(route, /noStoreJson/);
  assert.doesNotMatch(route, /\/api\/admin\//);
});

test("support invitation operations use canonical sender and avoid token exposure", () => {
  const operations = read("lib/admin/operations.ts");

  assert.match(operations, /sendContactInvite/);
  assert.match(operations, /loadSupportInvitationDetail/);
  assert.match(operations, /resendSupportInvitation/);
  assert.match(operations, /revokeSupportInvitation/);
  assert.match(operations, /sanitizeInvitationEventPayload/);
  assert.match(operations, /\/token\|accept_path\|body_text\|password\|secret\|key\/i\.test\(key\)/);
  assert.doesNotMatch(operations, /invite_token_hash[^;]+return/);
  assert.match(operations, /if \(\["accepted", "revoked", "expired"\]\.includes\(normalized\)\) return \[\]/);
});

test("support queue UI exposes inspect and permission-aware lifecycle actions", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(workspace, /loadSupportInvitationDetail/);
  assert.match(workspace, /runSupportInvitationAction/);
  assert.match(workspace, /SupportInvitationDetail/);
  assert.match(workspace, />View case<\/button>/);
  assert.match(workspace, /canManageSupport/);
  assert.match(workspace, /Resend invitation/);
  assert.match(workspace, /Revoke invitation/);
  assert.match(workspace, /operational metadata only, not private vault contents/);
  assert.match(workspace, /You can inspect this invitation but cannot mutate it/);
});

test("access support distinguishes terminal security state from operational next steps", () => {
  const operations = read("lib/admin/operations.ts");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(operations, /getSupportOperationalState/);
  assert.match(operations, /getSupportNextStep/);
  assert.match(operations, /canonical Contacts workflow/);
  assert.match(workspace, /Issue and next step/);
  assert.match(workspace, /Operational status/);
  assert.match(workspace, /Open verification review queue/);
  assert.match(workspace, /security history cannot be reopened or manually activated/);
  assert.doesNotMatch(workspace, /approve anyway|Manually activate access|Override IDV/i);
});

test("access operations cases are separate, append-only support records", () => {
  const migration = read("supabase/migrations/20260828100000_access_operations_case_management.sql");
  const route = read("app/api/internal/admin/support/[invitationId]/route.ts");
  const operations = read("lib/admin/operations.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.access_operations_cases/);
  assert.match(migration, /REFERENCES public\.contact_invitations\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /access_operations_case_notes/);
  assert.match(migration, /REVOKE ALL ON public\.access_operations_cases FROM PUBLIC, anon, authenticated/);
  assert.match(route, /createAccessOperationsCase/);
  assert.match(route, /addAccessOperationsCaseNote/);
  assert.match(route, /mutateAccessOperationsCase/);
  assert.match(operations, /access_case_must_be_resolved_before_close/);
  assert.match(operations, /access_operations_case_scope_mismatch/);
  assert.match(operations, /access_case_assignee_not_authorised/);
  assert.match(operations, /support_note_must_be_between_1_and_4000_characters/);
  assert.doesNotMatch(route, /activation_status.*active|approve.*access/i);
});
