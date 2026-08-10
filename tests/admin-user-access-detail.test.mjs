import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("customer user detail route uses canonical internal admin access and safe audit", () => {
  const route = read("app/api/internal/admin/users/[userId]/route.ts");

  assert.match(route, /requireAdminAccess\(request\)/);
  assert.match(route, /requireAdminCapability\(admin\.access, "users:lookup"\)/);
  assert.match(route, /loadUserOperationalDetail/);
  assert.match(route, /recordAdminAuditEvent/);
  assert.match(route, /private_vault_contents_exposed: false/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /\/api\/admin\//);
});

test("customer user detail service is privacy bounded and sources real operational tables", () => {
  const operations = read("lib/admin/operations.ts");

  assert.match(operations, /export async function loadUserOperationalDetail/);
  assert.match(operations, /client\.auth\.admin\.getUserById/);
  assert.match(operations, /\.from\("user_profiles"\)/);
  assert.match(operations, /\.from\("billing_profiles"\)/);
  assert.match(operations, /\.from\("contacts"\)/);
  assert.match(operations, /\.from\("contact_invitations"\)/);
  assert.match(operations, /\.from\("account_access_grants"\)/);
  assert.match(operations, /\.from\("verification_requests"\)/);
  assert.match(operations, /Use the canonical Audit history page/);
  assert.match(operations, /Suspend or restrict account/);
  assert.match(operations, /Impersonation is intentionally unavailable/);
  assert.doesNotMatch(operations, /decrypt|storage_path|document_contents|private_key/i);
});

test("customer user detail UI has explicit view action, unavailable actions, and vault privacy copy", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(workspace, /loadUserDetail/);
  assert.match(workspace, /\/api\/internal\/admin\/users\/\$\{encodeURIComponent\(userId\)\}/);
  assert.match(workspace, /renderUserOperationalDetail/);
  assert.match(workspace, /Privacy-bounded account summary/);
  assert.match(workspace, /Secure notes, document contents, storage paths and recovery data are not exposed/);
  assert.match(workspace, /Unavailable actions/);
  assert.match(workspace, /Open audit history/);
  assert.match(workspace, /Open support queue/);
  assert.match(workspace, /href=\{`\/admin\/users\/\$\{encodeURIComponent\(item\.userId\)\}`\}/);
  assert.doesNotMatch(workspace, /impersonate/i);
  assert.doesNotMatch(workspace, /\/api\/admin\//);
});
