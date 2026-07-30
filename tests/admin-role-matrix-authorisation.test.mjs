import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const capabilities = await import("../lib/admin/capabilities.ts");
const access = await import("../lib/admin/access.ts");
const enterpriseActions = await import("../lib/admin/enterpriseActionCapabilities.ts");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function stateFor(role) {
  return {
    user: { id: `${role}-user`, email: `${role}@example.test` },
    emailNormalized: `${role}@example.test`,
    isMasterAdmin: role === "super_admin",
    adminRole: role,
    capabilities: capabilities.getAdminRoleCapabilities(role),
    adminRow: {
      id: `${role}-admin-row`,
      email_normalized: `${role}@example.test`,
      user_id: `${role}-user`,
      display_name: role,
      status: "active",
      is_master: role === "super_admin",
      role,
      granted_by_user_id: "seed",
      created_at: "2026-07-30T00:00:00.000Z",
      updated_at: "2026-07-30T00:00:00.000Z",
    },
  };
}

test("canonical role matrix document exists and names the current role sources", () => {
  const matrix = read("docs/admin/ADMIN_ROLE_MATRIX.md");
  assert.match(matrix, /Canonical platform role source: `admin_users\.role`/);
  assert.match(matrix, /Canonical organisation-scoped enterprise role source: `enterprise_memberships\.organisation_role`/);
  for (const role of capabilities.ADMIN_ROLES) {
    assert.match(matrix, new RegExp(`\\\`${role}\\\``));
  }
  assert.match(matrix, /Missing or invalid sessions return `401`/);
  assert.match(matrix, /without the required capability return `403`/);
  assert.match(matrix, /Private vault records/);
});

test("platform role capability mapping follows least privilege matrix", () => {
  assert.deepEqual(capabilities.ADMIN_ROLES, [
    "super_admin",
    "support_agent",
    "verification_reviewer",
    "probate_reviewer",
    "auditor",
    "enterprise_admin",
  ]);

  assert.ok(capabilities.hasAdminCapability("super_admin", "admin_users:manage"));
  assert.ok(capabilities.hasAdminCapability("super_admin", "verification:decide"));
  assert.ok(capabilities.hasAdminCapability("super_admin", "enterprise.export.request"));

  assert.ok(capabilities.hasAdminCapability("auditor", "audit:read"));
  assert.ok(capabilities.hasAdminCapability("auditor", "organisation:view"));
  assert.equal(capabilities.hasAdminCapability("auditor", "admin_users:manage"), false);
  assert.equal(capabilities.hasAdminCapability("auditor", "licence:edit"), false);
  assert.equal(capabilities.hasAdminCapability("auditor", "enterprise.export.request"), false);

  assert.ok(capabilities.hasAdminCapability("support_agent", "users:lookup"));
  assert.ok(capabilities.hasAdminCapability("support_agent", "support:read"));
  assert.equal(capabilities.hasAdminCapability("support_agent", "admin_users:manage"), false);
  assert.equal(capabilities.hasAdminCapability("support_agent", "verification:decide"), false);
  assert.equal(capabilities.hasAdminCapability("support_agent", "licence:edit"), false);

  assert.ok(capabilities.hasAdminCapability("probate_reviewer", "verification:decide"));
  assert.equal(capabilities.hasAdminCapability("probate_reviewer", "admin_users:manage"), false);
  assert.equal(capabilities.hasAdminCapability("probate_reviewer", "licence:edit"), false);

  assert.ok(capabilities.hasAdminCapability("enterprise_admin", "organisation:manage"));
  assert.ok(capabilities.hasAdminCapability("enterprise_admin", "licence:edit"));
  assert.equal(capabilities.hasAdminCapability("enterprise_admin", "admin_users:manage"), false);
  assert.equal(capabilities.hasAdminCapability("enterprise_admin", "verification:decide"), false);
});

test("shared capability denial distinguishes authenticated 403 from missing authentication", () => {
  const auditor = stateFor("auditor");
  const denied = access.requireAdminCapability(auditor, "admin_users:manage");
  assert.equal(denied.status, 403);
  assert.equal(denied.capability, "admin_users:manage");
  assert.match(denied.message, /admin users manage permission/i);

  const allowed = access.requireAdminCapability(stateFor("super_admin"), "admin_users:manage");
  assert.equal(allowed, null);
});

test("admin-user lifecycle API checks capability before parsing or mutating payload", () => {
  const route = read("app/api/internal/admin/admin-users/route.ts");
  const postCapabilityIndex = route.indexOf('requireAdminCapability(admin.access, "admin_users:manage")');
  const postJsonIndex = route.indexOf("await request.json");
  const lifecyclePlanIndex = route.indexOf("planAdminUserLifecycleUpdate(admin.adminClient");
  assert.ok(postCapabilityIndex > -1);
  assert.ok(postJsonIndex > postCapabilityIndex);
  assert.ok(lifecyclePlanIndex > postCapabilityIndex);

  assert.ok(route.includes('code: admin.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_PERMISSION_DENIED"'));
  assert.ok(route.includes("{ status: denied.status }"));
});

test("enterprise action capability map denies read-only roles before mutation handlers", () => {
  assert.equal(enterpriseActions.capabilityForEnterpriseAction("create_organisation"), "organisation:manage");
  assert.equal(enterpriseActions.capabilityForEnterpriseAction("update_licence"), "licence:edit");
  assert.equal(enterpriseActions.capabilityForEnterpriseAction("change_licence_seats"), "licence:seats");
  assert.equal(enterpriseActions.capabilityForEnterpriseAction("invite_enterprise_user"), "enterprise.invitation.manage");
  assert.equal(enterpriseActions.capabilityForEnterpriseAction("export_report"), "enterprise.export.request");

  assert.equal(access.requireAdminCapability(stateFor("auditor"), enterpriseActions.capabilityForEnterpriseAction("update_licence")).status, 403);
  assert.equal(access.requireAdminCapability(stateFor("support_agent"), enterpriseActions.capabilityForEnterpriseAction("create_organisation")).status, 403);
  assert.equal(access.requireAdminCapability(stateFor("probate_reviewer"), enterpriseActions.capabilityForEnterpriseAction("change_licence_seats")).status, 403);
  assert.equal(access.requireAdminCapability(stateFor("enterprise_admin"), enterpriseActions.capabilityForEnterpriseAction("update_licence")), null);
});

test("enterprise route enforces organisation scope for scoped memberships", () => {
  const route = read("app/api/internal/admin/enterprise/route.ts");
  assert.match(route, /assertEnterpriseActionScope\(admin, action, body\)/);
  assert.match(route, /organisationScoped/);
  assert.match(route, /Organisation-scoped users cannot create organisations/);
  assert.match(route, /enterprise_scope_denied/);
  assert.match(route, /enterprise_licences"\)\.select\("organisation_id"\)/);
  assert.match(route, /enterprise_memberships"\)\.select\("organisation_id"\)/);
  assert.match(route, /enterprise_invitations"\)\.select\("organisation_id"\)/);
  assert.match(route, /enterprise_enrolment_links"\)\.select\("organisation_id"\)/);
});

test("Phase 1 admin cache and sign-out protections remain present", () => {
  const layout = read("app/admin/layout.tsx");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");
  assert.match(layout, /dynamic = "force-dynamic"/);
  assert.match(layout, /fetchCache = "force-no-store"/);
  assert.match(workspace, /await supabase\.auth\.signOut\(\)/);
  assert.match(workspace, /setAdmin\(null\)/);
  assert.match(workspace, /router\.refresh\(\)/);
});
