import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const legacyMutationRoutes = [
  "app/api/admin/roles/propose-change/route.ts",
  "app/api/admin/roles/validate-change/route.ts",
  "app/api/admin/roles/submit-change/route.ts",
  "app/api/admin/users/[userId]/suspend/route.ts",
  "app/api/admin/accounts/[accountId]/restrict/route.ts",
  "app/api/admin/audit/route.ts",
];

test("platform admin UI uses canonical internal admin APIs only", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(workspace, /\/api\/internal\/admin\/session/);
  assert.match(workspace, /\/api\/internal\/admin\/admin-users/);
  assert.match(workspace, /\/api\/internal\/admin\/users/);
  assert.match(workspace, /\/api\/internal\/admin\/audit-history/);
  assert.doesNotMatch(workspace, /\/api\/admin\//);
});

test("legacy platform admin mutation routes are intentionally retired", () => {
  for (const routePath of legacyMutationRoutes) {
    const route = read(routePath);
    assert.match(route, /retiredLegacyAdminMutationResponse/);
    assert.doesNotMatch(route, /handleProposeRoleChange|handleValidateRoleChange|handleSubmitRoleChange|handleSuspendUser|handleRestrictAccount|handleEmitAuditEvent/);
  }
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
  assert.match(audit, /LEGACY_ADMIN_API_RETIRED/);
  assert.match(audit, /\/api\/internal\/admin\/admin-users/);
});
