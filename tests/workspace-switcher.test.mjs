import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildPrototypeWorkspaceUrl,
  getAvailableWorkspaces,
  getCurrentWorkspaceForPath,
  filterCustomerWorkspaces,
} from "../lib/workspaces.ts";
import {
  getMasterAdminRolesForEmail,
  mergePlatformRoles,
} from "../lib/auth/adminRoles.ts";

const root = process.cwd();

test("workspace route map resolves role-aware admin and application workspaces centrally", () => {
  const superAdmin = getAvailableWorkspaces(["super_admin"], { prototype: true });
  assert.deepEqual(superAdmin.map((workspace) => workspace.id), [
    "application",
    "super_admin",
    "probate_admin",
  ]);
  assert.deepEqual(superAdmin.map((workspace) => workspace.label), [
    "Personal Vault",
    "Platform Administration",
    "Platform Probate Review",
  ]);
  assert.deepEqual(superAdmin.map((workspace) => workspace.href), [
    "/dashboard?role=super_admin&admin=true&prototype=true",
    "/admin",
    "/admin/probate",
  ]);
  assert.equal(
    buildPrototypeWorkspaceUrl("application", { prototype: true, currentRole: "super_admin" }),
    "/dashboard?role=super_admin&admin=true&prototype=true",
  );
  assert.equal(
    buildPrototypeWorkspaceUrl("super_admin"),
    "/admin",
  );

  const enterprise = getAvailableWorkspaces(["enterprise_admin"], { prototype: true });
  assert.deepEqual(enterprise.map((workspace) => workspace.id), ["application", "enterprise_admin"]);

  const combined = getAvailableWorkspaces(["super_admin", "enterprise_admin"], { prototype: true });
  assert.deepEqual(combined.map((workspace) => workspace.id), [
    "application",
    "super_admin",
    "enterprise_admin",
    "probate_admin",
  ]);

  const probate = getAvailableWorkspaces(["probate_admin"], { prototype: true });
  assert.deepEqual(probate.map((workspace) => workspace.id), ["application", "probate_admin"]);

  const consumer = getAvailableWorkspaces(["consumer_user"], { prototype: true });
  assert.deepEqual(consumer.map((workspace) => workspace.id), ["application"]);

  const executor = getAvailableWorkspaces(["executor"], { prototype: true });
  assert.deepEqual(executor.map((workspace) => workspace.id), ["application", "contact_wallet"]);
  assert.deepEqual(executor.map((workspace) => workspace.label), ["Personal Vault", "Contact Wallet"]);
  assert.equal(buildPrototypeWorkspaceUrl("contact_wallet"), "/access");
  assert.equal(buildPrototypeWorkspaceUrl("probate_admin"), "/admin/probate");
  assert.equal(getCurrentWorkspaceForPath("/admin/probate"), "probate_admin");
  assert.equal(getCurrentWorkspaceForPath("/admin/probate/case-1"), "probate_admin");
  assert.equal(getCurrentWorkspaceForPath("/admin/verification"), "probate_admin");
});

test("master admin email stays in platform context unless an enterprise role is present", () => {
  const roles = mergePlatformRoles(["consumer_user"], getMasterAdminRolesForEmail("IVANYARDLEY@ME.COM"));
  assert.deepEqual(roles, ["consumer_user", "super_admin"]);
  assert.deepEqual(getAvailableWorkspaces(roles).map((workspace) => workspace.id), [
    "application",
    "super_admin",
    "probate_admin",
  ]);
});

test("customer switcher never offers platform or partner destinations", () => {
  const roles = ["consumer_user", "enterprise_admin", "executor"];
  const available = getAvailableWorkspaces(roles, { prototype: true });
  assert.deepEqual(filterCustomerWorkspaces(available).map((workspace) => workspace.id), ["application", "contact_wallet"]);
  assert.deepEqual(filterCustomerWorkspaces(getAvailableWorkspaces(["consumer_user"])).map((workspace) => workspace.id), ["application"]);
});

test("workspace switcher is present in admin shell, application shell, sign-in, and test launcher", () => {
  const adminShell = fs.readFileSync(path.join(root, "components/admin/prototype/AdminPrototypeShell.tsx"), "utf8");
  const appLayout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
  const authEntry = fs.readFileSync(path.join(root, "components/auth/PublicAuthEntry.tsx"), "utf8");
  const signInForm = fs.readFileSync(path.join(root, "components/auth/SignInForm.tsx"), "utf8");
  const authCallback = fs.readFileSync(path.join(root, "app/auth/callback/page.tsx"), "utf8");
  const testLogin = fs.readFileSync(path.join(root, "app/internal/test-login/page.tsx"), "utf8");
  const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(adminShell, /WorkspaceSwitcher/);
  assert.doesNotMatch(adminShell, /buildPrototypeWorkspaceUrl\("application"/);
  assert.match(adminShell, /canRoleAccessPath\(userRoles, pathname\)/);
  assert.match(adminShell, /getMasterAdminRolesForEmail\(user\.email\)/);
  assert.match(appLayout, /WorkspaceSwitcher/);
  assert.match(appLayout, /alwaysShow/);
  assert.match(appLayout, /Mobile header · role-aware workspace switch/);
  assert.match(appLayout, /customerOnly/);
  assert.match(authEntry, /WorkspaceSwitcher/);
  assert.match(authEntry, /resolvePermissionedAdminDestination/);
  assert.match(authEntry, /getMasterAdminRolesForEmail\(sessionUser\.email\)/);
  assert.match(authEntry, /mergePlatformRoles/);
  assert.doesNotMatch(authEntry, /lf-login-target-switch/);
  assert.match(signInForm, /getMasterAdminRolesForEmail\(confirmedUser\.email\)/);
  assert.match(signInForm, /mergePlatformRoles/);
  assert.match(signInForm, /roles,/);
  assert.match(authCallback, /getMasterAdminRolesForEmail\(user\.email\)/);
  assert.match(authCallback, /roles,/);
  assert.match(testLogin, /WorkspaceSwitcher/);
  assert.match(switcher, /isTestPersonaAccessEnabled/);
  assert.match(switcher, /queryRole && adminFlag && prototypeFlag/);
  assert.match(switcher, /loadAdminPermissionRoles/);
  assert.match(switcher, /\/api\/internal\/admin\/session/);
  assert.match(switcher, /getMasterAdminRolesForEmail/);
  assert.match(switcher, /mergePlatformRoles\(metadataRoles, adminRoles, masterAdminRoles\)/);
  assert.doesNotMatch(switcher, /extractPlatformRolesFromMetadata\(user\.user_metadata\)/);
  assert.match(switcher, /getAvailableWorkspaces/);
  assert.match(switcher, /alwaysShow/);
  assert.match(switcher, /!hasMultipleContexts && linkedFortresses\.length === 0 && nominatedOnly\.length === 0 && !alwaysShow/);
  assert.match(switcher, /lf-workspace-menu/);
  assert.match(switcher, /plainCurrentContext \? <div className="lf-workspace-current lf-workspace-current-label"/);
  assert.match(switcher, /const plainCurrentContext = singleCustomerContext && !founderTestLauncherAvailable/);
  assert.match(switcher, /<FounderTestLauncher current="vault" available \/>/);
  assert.match(appLayout, /founderTestLauncherAvailable=\{founderLauncherAvailable\}/);
  assert.match(switcher, /aria-expanded=\{open\}/);
  assert.match(switcher, /disabled=\{!session\}/);
  assert.match(switcher, /aria-controls=\{menuId\}/);
  assert.match(switcher, /Switch context/);
  assert.match(switcher, /lf-workspace-route-meta/);
  assert.match(switcher, /Workspace/);
  assert.match(globals, /--lf-shell-sidebar-width: 264px/);
  assert.match(globals, /--lf-shell-header-min-height: 60px/);
  assert.match(globals, /\.lf-mobile-workspace-trigger \.lf-workspace-links/);
});

test("workspace switcher uses controlled dismissal instead of sticky native details", () => {
  const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
  const appLayout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(switcher, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(switcher, /queueMicrotask\(\(\) => setOpen\(false\)\)/);
  assert.match(switcher, /document\.addEventListener\("pointerdown", onPointerDown\)/);
  assert.match(switcher, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(switcher, /event\.stopImmediatePropagation\(\)/);
  assert.match(switcher, /event\.key !== "Escape"/);
  assert.match(switcher, /triggerRef\.current\?\.focus\(\)/);
  assert.match(switcher, /window\.dispatchEvent\(new CustomEvent\("lf-admin-menu-open"/);
  assert.match(switcher, /window\.addEventListener\("lf-admin-menu-open", onOtherMenuOpen\)/);
  assert.match(switcher, /workspace\.id === "application" \? openOwnVault\(event, workspace\.href\) : closeAfterSelection\(\)/);
  assert.match(switcher, /onSelect\?\.\(\)/);
  assert.match(appLayout, /<WorkspaceSwitcher[\s\S]*?compact\s+branded\s+alwaysShow/);
  assert.match(switcher, /<BrandGlyph \/>/);
  assert.match(switcher, /name=\{branded \? "unfold_more" : "expand_more"\}/);
  assert.match(globals, /\.lf-sidebar-workspace \.lf-workspace-links \{[\s\S]*?position: absolute;[\s\S]*?left: calc\(100% \+ 16px\);/);
  assert.match(globals, /\.lf-mobile-workspace-trigger \.lf-workspace-links \{ position: fixed;/);
  assert.match(globals, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(switcher, /<details className="lf-workspace-menu"/);
  assert.doesNotMatch(switcher, /<summary className="lf-workspace-current"/);
  assert.match(globals, /\.lf-workspace-current \{\n  border: 0;\n  background: transparent;/);
});

test("workspace switcher exposes explicit identity and role context without changing authorization", () => {
  const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
  const shell = fs.readFileSync(path.join(root, "components/admin/AdminWorkspaceShell.tsx"), "utf8");
  const workspaces = fs.readFileSync(path.join(root, "lib/workspaces.ts"), "utf8");

  assert.match(switcher, /aria-label=\{plainCurrentContext \? "Current Vault" : founderTestLauncherAvailable \? "Vault contexts and TEST interfaces" : "Switch Vault"\}/);
  assert.match(switcher, /Signed in as/);
  assert.match(switcher, /formatRole\(activeRole\)/);
  assert.match(switcher, /aria-current=\{workspace\.id === currentWorkspace \? "page"/);
  assert.match(workspaces, /label: "Platform Probate Review"/);
  assert.match(shell, /workspaceHome = isInternalEnterprise \|\| isPartner \? "\/enterprise" : "\/admin"/);
  assert.doesNotMatch(switcher, /auth\.signOut|router\.(push|replace)/);
});

test("current workspace detection recognises enterprise, probate, executor, and application routes", () => {
  assert.equal(getCurrentWorkspaceForPath("/admin"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/admin/admin-users"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/admin/system-health"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/prototype/users"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/prototype/enterprise"), "enterprise_admin");
  assert.equal(getCurrentWorkspaceForPath("/application/enterprise"), "enterprise_admin");
  assert.equal(getCurrentWorkspaceForPath("/enterprise"), "enterprise_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/prototype/cases"), "probate_admin");
  assert.equal(getCurrentWorkspaceForPath("/application/admin"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/probate"), "probate_admin");
  assert.equal(getCurrentWorkspaceForPath("/contact-wallet"), "contact_wallet");
  assert.equal(getCurrentWorkspaceForPath("/executors"), "contact_wallet");
  assert.equal(getCurrentWorkspaceForPath("/user"), "application");
  assert.equal(getCurrentWorkspaceForPath("/dashboard"), "application");
});

test("enterprise-capable platform sessions retain Enterprise Operations in the switcher", () => {
  const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
  assert.match(switcher, /enterprise\.workspace\.access/);
  assert.match(switcher, /enterprise_dashboard/);
  assert.match(switcher, /roles\.push\("enterprise_admin"\)/);
});
