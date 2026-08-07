import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("platform administration enterprise links stay inside the platform hierarchy", () => {
  const navigation = read("components/admin/adminNavigation.ts");
  const platformBlock = navigation.match(/export const PLATFORM_ADMIN_NAVIGATION[\s\S]*?export const ENTERPRISE_ADMIN_NAVIGATION/)?.[0] ?? "";

  assert.match(platformBlock, /href: "\/admin\/organisations"/);
  assert.match(platformBlock, /href: "\/admin\/licences"/);
  assert.match(platformBlock, /label: "Enterprise audit"/);
  assert.doesNotMatch(platformBlock, /label: "Enterprise reports"/);
  assert.doesNotMatch(platformBlock, /href: "\/application\/enterprise/);
  assert.doesNotMatch(platformBlock, /tab=organisations|tab=licences/);
});

test("platform organisation and licence drill-down routes are canonical admin routes", () => {
  for (const file of [
    "app/admin/organisations/page.tsx",
    "app/admin/organisations/[organisationId]/page.tsx",
    "app/admin/organisations/[organisationId]/users/page.tsx",
    "app/admin/organisations/[organisationId]/invitations/page.tsx",
    "app/admin/organisations/[organisationId]/licences/page.tsx",
    "app/admin/organisations/[organisationId]/licences/[licenceId]/page.tsx",
    "app/admin/licences/page.tsx",
    "app/admin/licences/[licenceId]/page.tsx",
  ]) {
    assert.match(read(file), /AdminControlPlaneWorkspace/);
  }

  const controlPlane = read("components/admin/AdminControlPlaneWorkspace.tsx");
  assert.match(controlPlane, /\| "organisations"/);
  assert.match(controlPlane, /\| "organisation-detail"/);
  assert.match(controlPlane, /\| "licence-detail"/);
  assert.match(controlPlane, /\/api\/internal\/admin\/enterprise/);
  assert.doesNotMatch(controlPlane, /\/api\/admin\//);
});

test("platform organisation and licence actions do not silently switch to enterprise workspace", () => {
  const controlPlane = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const platformRenderers = controlPlane.match(/function renderPlatformOrganisations[\s\S]*?function renderAdminUsers/)?.[0] ?? "";

  assert.match(platformRenderers, /\/admin\/organisations\/\$\{org\.id\}/);
  assert.match(platformRenderers, /\/admin\/licences\/\$\{licence\.id\}/);
  assert.match(platformRenderers, /Edit organisation unavailable/);
  assert.match(platformRenderers, /Invite administrator unavailable/);
  assert.match(platformRenderers, /Edit licence unavailable/);
  assert.doesNotMatch(platformRenderers, /href=\{`\/application\/enterprise/);
});

test("enterprise entry no longer renders a duplicate horizontal workspace tab bar", () => {
  const workspace = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");

  assert.doesNotMatch(workspace, /<nav aria-label="Enterprise navigation"/);
  assert.doesNotMatch(workspace, /tabListStyle|activeTabStyle|tabStyle/);
  assert.match(workspace, /More filters and saved views/);
  assert.match(workspace, /moreFiltersStyle/);
});

test("platform metrics render labels, values and supporting text separately", () => {
  const controlPlane = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const primitives = read("components/admin/AdminPrimitives.tsx");

  assert.match(primitives, /function AdminMetricCard/);
  assert.match(primitives, /lf-admin-metric-label/);
  assert.match(primitives, /lf-admin-metric-value/);
  assert.match(primitives, /lf-admin-metric-detail/);
  assert.match(controlPlane, /AdminMetricCard/);
  assert.doesNotMatch(controlPlane, /Purchased seats0|Active seats0|Invited\/reserved seats0/);
});

test("shared admin primitives prevent mid-word headings and default-looking controls", () => {
  const primitives = read("components/admin/AdminPrimitives.tsx");
  const shell = read("components/admin/AdminWorkspaceShell.tsx");

  assert.match(primitives, /word-break: keep-all/);
  assert.match(primitives, /white-space: nowrap/);
  assert.doesNotMatch(primitives, /overflow-wrap: anywhere/);
  assert.match(shell, /border: 1px solid #cbd5e1/);
  assert.match(shell, /box-shadow: 0 0 0 3px/);
  assert.doesNotMatch(shell, /th,[\s\S]*overflow-wrap: anywhere/);
});

test("admin detail routes focus on the selected record instead of re-rendering global queues", () => {
  const controlPlane = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const adminDetailBranch = controlPlane.match(/if \(resourceId\) \{\n    return \(\n      <div style=\{stackStyle\}>[\s\S]*?function permissionSummaryForRole/)?.[0] ?? "";
  const probateDetailBranch = controlPlane.match(/function renderProbate[\s\S]*?if \(resourceId\) \{[\s\S]*?return \(\n    <div style=\{stackStyle\}>/)?.[0] ?? "";

  assert.match(adminDetailBranch, /Back to administrators/);
  assert.match(adminDetailBranch, /Permitted lifecycle actions/);
  assert.match(probateDetailBranch, /Back to probate queue/);
  assert.match(controlPlane, /This case is terminal/);
});

test("enterprise saved views are server persisted and licence actions map to explicit capabilities", () => {
  const route = read("app/api/internal/admin/enterprise/route.ts");
  const service = read("lib/admin/enterpriseOperations.ts");
  const capabilities = read("lib/admin/enterpriseActionCapabilities.ts");

  assert.match(service, /from\("enterprise_saved_views"\)/);
  assert.match(route, /action === "save_view"/);
  assert.match(route, /action === "update_view"/);
  assert.match(route, /action === "delete_view"/);

  for (const action of ["update_licence", "change_licence_seats", "renew_licence", "transition_licence"]) {
    assert.match(capabilities, new RegExp(action));
  }
});
