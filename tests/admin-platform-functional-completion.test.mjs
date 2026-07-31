import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("prototype admin source is server-gated and excluded from normal link crawl", () => {
  const layout = read("app/internal/admin/prototype/layout.tsx");
  const crawler = read("scripts/link-crawler.mjs");

  assert.match(layout, /notFound\(\)/);
  assert.match(layout, /NODE_ENV === "development"/);
  assert.match(layout, /LEGACY_FORTRESS_ALLOW_ADMIN_PROTOTYPES === "true"/);
  assert.match(layout, /robots:[\s\S]*index: false/);
  assert.doesNotMatch(layout, /searchParams|prototype=true|admin=true/);
  assert.match(crawler, /isQuarantinedSource/);
  assert.match(crawler, /app\/internal\/admin\/prototype\//);
  assert.match(crawler, /components\/admin\/prototype\//);
  assert.match(crawler, /app\/api\/internal\/admin\/local-role-override\//);
});

test("legacy internal admin entry routes redirect to canonical platform routes", () => {
  const internal = read("app/internal/admin/page.tsx");
  const probate = read("app/internal/admin/probate/page.tsx");

  assert.match(internal, /redirect\("\/admin"\)/);
  assert.match(probate, /redirect\("\/admin\/probate"\)/);
  assert.doesNotMatch(internal, /AdminOpsWorkspace/);
  assert.doesNotMatch(probate, /AdminOpsWorkspace/);
});

test("platform admin high-value lists use shared responsive data primitives", () => {
  const primitives = read("components/admin/AdminPrimitives.tsx");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(primitives, /AdminDataTable/);
  assert.match(primitives, /lf-admin-data-card/);
  assert.match(primitives, /@media \(max-width: 720px\)/);
  assert.match(primitives, /AdminStatusBadge/);
  assert.match(primitives, /AdminEmptyState/);
  assert.match(workspace, /AdminDataTable/);
  assert.match(workspace, /Administrator invitations/);
  assert.match(workspace, /Admin users/);
  assert.match(workspace, /Safe lookup results/);
});

test("platform admin lifecycle controls remain on canonical authorised APIs", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const route = read("app/api/internal/admin/admin-users/route.ts");

  assert.match(workspace, /\/api\/internal\/admin\/admin-users/);
  assert.match(route, /planAdminUserLifecycleUpdate/);
  assert.match(route, /applyAdminUserLifecycleUpdate/);
  assert.match(route, /recordAdminLifecycleDenied/);
  assert.doesNotMatch(workspace, /href=\{?["'`]\/internal\/admin/);
  assert.doesNotMatch(workspace, /Open legacy lifecycle controls/);
});

test("admin product audit documents platform functional-completion decisions", () => {
  const audit = read("docs/admin/ADMIN_PRODUCT_AUDIT.md");

  assert.match(audit, /Platform Administration Functional Completion/);
  assert.match(audit, /ADMIN-PFC-001/);
  assert.match(audit, /Prototype routes are quarantined/);
  assert.match(audit, /ADMIN-PFC-002/);
  assert.match(audit, /responsive data table/);
});
