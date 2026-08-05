import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function findRouteHandlers(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = `${path}/${entry.name}`;
    if (entry.isDirectory()) return findRouteHandlers(entryPath);
    return entry.name === "route.ts" ? [entryPath] : [];
  });
}

test("platform admin UI uses canonical internal admin APIs only", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(workspace, /\/api\/internal\/admin\/session/);
  assert.match(workspace, /\/api\/internal\/admin\/admin-users/);
  assert.match(workspace, /\/api\/internal\/admin\/users/);
  assert.match(workspace, /\/api\/internal\/admin\/audit-history/);
  assert.doesNotMatch(workspace, /\/api\/admin\//);
});

test("legacy /api/admin runtime route handlers are removed", () => {
  const handlers = findRouteHandlers(new URL("../app/api/admin", import.meta.url).pathname);
  assert.deepEqual(handlers, []);
});

test("canonical admin lifecycle route remains server-authorised and audited", () => {
  const route = read("app/api/internal/admin/admin-users/route.ts");

  assert.match(route, /requireAdminAccess/);
  assert.match(route, /requireAdminCapability\(admin\.access, "admin_users:manage"\)/);
  assert.match(route, /planAdminUserLifecycleUpdate/);
  assert.match(route, /applyAdminUserLifecycleUpdate/);
  assert.match(route, /recordAdminLifecycleDenied/);
  assert.match(route, /noStoreJson/);
});

test("admin product audit records the duplicate API consolidation decision", () => {
  const audit = read("docs/admin/ADMIN_PRODUCT_AUDIT.md");

  assert.match(audit, /Platform Administration API Consolidation/);
  assert.match(audit, /Runtime route handlers removed/);
  assert.match(audit, /\/api\/internal\/admin\/admin-users/);
});
