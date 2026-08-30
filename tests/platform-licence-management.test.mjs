import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Platform Admin licence detail uses the canonical enterprise API in platform context", () => {
  const route = read("app/admin/licences/[licenceId]/page.tsx");
  const workspace = read("components/enterprise/EnterpriseLicenceDetailWorkspace.tsx");

  assert.match(route, /EnterpriseLicenceDetailWorkspace/);
  assert.match(route, /platformAdmin/);
  assert.match(workspace, /platformAdmin \? PLATFORM_ADMIN_NAVIGATION/);
  assert.match(workspace, /\/api\/internal\/admin\/enterprise\?licenceId/);
  assert.doesNotMatch(workspace, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
});

test("seat changes use canonical formulas, in-app confirmation and server-side action", () => {
  const workspace = read("components/enterprise/EnterpriseLicenceDetailWorkspace.tsx");
  const service = read("lib/admin/enterpriseOperations.ts");
  const route = read("app/api/internal/admin/enterprise/route.ts");

  assert.match(workspace, /committedSeats/);
  assert.match(workspace, /Allocation cannot be reduced below currently committed seats/);
  assert.match(workspace, /Change licence allocation/);
  assert.match(workspace, /Confirm allocation/);
  assert.doesNotMatch(workspace, /window\.confirm/);
  assert.match(workspace, /change_licence_seats/);
  assert.match(service, /committedSeatsForRow/);
  assert.match(service, /seat_entitlement_exceeded/);
  assert.match(route, /change_licence_seats/);
});

test("licence lifecycle, renewal and history remain exposed without vault data", () => {
  const workspace = read("components/enterprise/EnterpriseLicenceDetailWorkspace.tsx");
  const service = read("lib/admin/enterpriseOperations.ts");

  for (const action of ["transition_licence", "renew_licence", "change_licence_seats"]) assert.match(workspace, new RegExp(action));
  for (const field of ["renewalDate", "endDate", "renewals", "auditEvents", "Suspended", "Available"]) assert.match(workspace, new RegExp(field));
  assert.match(service, /enterprise_licence_renewals/);
  assert.match(workspace, /Private vault records.*not queried/);
  assert.match(workspace, /Engagement analytics are not yet available/);
  assert.match(workspace, /Product adoption analytics are not yet available/);
  assert.match(workspace, /Registration lifecycle/);
  assert.match(workspace, /Enrolment link oversight/);
});

test("organisation registration lifecycle is state-based and excludes engagement/adoption claims", () => {
  const workspace = read("components/admin/PlatformOrganisationControlCentre.tsx");

  for (const label of ["Registration lifecycle", "Pending invitations", "Accepted", "Active memberships", "Suspended memberships", "Claims used"]) {
    assert.match(workspace, new RegExp(label));
  }
  assert.match(workspace, /Status-based operational counts only/);
  assert.match(workspace, /does not measure user engagement or Personal Vault adoption/);
  assert.doesNotMatch(workspace, /activeLast30|activeLast60|willAdoption|bankAdoption|documentAdoption/);
});

test("platform licence actions remain capability and scope guarded", () => {
  const route = read("app/api/internal/admin/enterprise/route.ts");
  const caps = read("lib/admin/enterpriseActionCapabilities.ts");

  assert.match(route, /requireEnterpriseAccess\(request\)/);
  assert.match(route, /requireAdminCapability/);
  assert.match(route, /assertEnterpriseActionScope/);
  assert.match(caps, /change_licence_seats/);
  assert.match(caps, /renew_licence/);
  assert.match(caps, /transition_licence/);
});
