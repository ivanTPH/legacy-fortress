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

  assert.match(controlPlane, /function MetricCard/);
  assert.match(controlPlane, /<span>\{label\}<\/span>/);
  assert.match(controlPlane, /<strong>\{value\}<\/strong>/);
  assert.match(controlPlane, /<small>\{detail\}<\/small>/);
  assert.doesNotMatch(controlPlane, /Purchased seats0|Active seats0|Invited\/reserved seats0/);
});
