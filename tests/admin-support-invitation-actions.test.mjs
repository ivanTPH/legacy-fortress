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
  assert.match(workspace, />View<\/button>/);
  assert.match(workspace, /canManageSupport/);
  assert.match(workspace, /Resend invitation/);
  assert.match(workspace, /Revoke invitation/);
  assert.match(workspace, /operational metadata only, not private vault contents/);
  assert.match(workspace, /You can inspect this invitation but cannot mutate it/);
});
