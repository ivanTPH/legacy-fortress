import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("shared admin shell exposes responsive navigation, identity and sign-out controls", () => {
  const source = read("components/admin/AdminWorkspaceShell.tsx");
  assert.match(source, /lf-admin-shell-sidebar/);
  assert.match(source, /lf-admin-shell-mobile-toggle/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /WorkspaceSwitcher/);
  assert.match(source, /Personal Vault/);
  assert.match(source, /Sign out/);
  assert.match(source, /prefetch=\{false\}/);
  assert.match(source, /@media \(max-width: 860px\)/);
  assert.match(source, /overflow-wrap: anywhere/);
  assert.match(source, /min-height: 44px/);
});

test("admin navigation is capability-filtered without defining a second role matrix", () => {
  const source = read("components/admin/adminNavigation.ts");
  assert.match(source, /PLATFORM_ADMIN_NAVIGATION/);
  assert.match(source, /ENTERPRISE_ADMIN_NAVIGATION/);
  assert.match(source, /filterAdminNavigation/);
  assert.match(source, /capabilitySet\.has/);
  assert.doesNotMatch(source, /super_admin:/);
  assert.doesNotMatch(source, /support_agent:/);
  assert.match(source, /admin_users:manage/);
  assert.match(source, /organisation:view/);
  assert.match(source, /verification:read/);
});

test("platform, enterprise and probate entry surfaces use the shared shell", () => {
  const platform = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const enterprise = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");
  const probatePage = read("app/admin/probate/page.tsx");

  assert.match(platform, /AdminWorkspaceShell/);
  assert.match(platform, /PLATFORM_ADMIN_NAVIGATION/);
  assert.match(platform, /workspaceLabel="Platform Administration"/);
  assert.match(enterprise, /AdminWorkspaceShell/);
  assert.match(enterprise, /ENTERPRISE_ADMIN_NAVIGATION/);
  assert.match(enterprise, /workspaceLabel="Enterprise Operations"/);
  assert.match(probatePage, /section="probate"/);
});

test("enterprise shared navigation tab links are safe query-state links", () => {
  const enterprise = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");
  const enterprisePage = read("app/application/enterprise/page.tsx");
  assert.match(enterprise, /useSearchParams/);
  assert.match(enterprise, /normalizeEnterpriseTab/);
  assert.match(enterprise, /setActiveTab\(tab\)/);
  assert.match(enterprisePage, /Suspense/);
  assert.match(enterprisePage, /EnterpriseOperationsWorkspace/);
  assert.doesNotMatch(enterprise, /window\.location/);
  assert.doesNotMatch(enterprise, /dangerouslySetInnerHTML/);
});

test("admin product audit records unresolved prototype and detail-shell follow-ups", () => {
  const audit = read("docs/admin/ADMIN_PRODUCT_AUDIT.md");
  assert.match(audit, /ADMIN-UX-004/);
  assert.match(audit, /internal\/admin\/prototype/);
  assert.match(audit, /ADMIN-NEXT-001/);
  assert.match(audit, /EnterpriseOrganisationDetailWorkspace/);
  assert.match(audit, /Severity Scale/);
});
