import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildPrototypeWorkspaceUrl,
  getAvailableWorkspaces,
  getCurrentWorkspaceForPath,
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
    "enterprise_admin",
    "probate_admin",
  ]);
  assert.deepEqual(superAdmin.map((workspace) => workspace.label), [
    "Personal Vault",
    "Platform Administration",
    "Enterprise Operations",
    "Probate Review",
  ]);
  assert.deepEqual(superAdmin.map((workspace) => workspace.href), [
    "/user?role=super_admin&admin=true&prototype=true",
    "/admin",
    "/application/enterprise",
    "/internal/admin/probate",
  ]);
  assert.equal(
    buildPrototypeWorkspaceUrl("application", { prototype: true, currentRole: "super_admin" }),
    "/user?role=super_admin&admin=true&prototype=true",
  );
  assert.equal(
    buildPrototypeWorkspaceUrl("super_admin"),
    "/admin",
  );

  const enterprise = getAvailableWorkspaces(["enterprise_admin"], { prototype: true });
  assert.deepEqual(enterprise.map((workspace) => workspace.id), ["application", "enterprise_admin"]);

  const probate = getAvailableWorkspaces(["probate_admin"], { prototype: true });
  assert.deepEqual(probate.map((workspace) => workspace.id), ["application", "probate_admin"]);

  const consumer = getAvailableWorkspaces(["consumer_user"], { prototype: true });
  assert.deepEqual(consumer.map((workspace) => workspace.id), ["application"]);

  const executor = getAvailableWorkspaces(["executor"], { prototype: true });
  assert.deepEqual(executor.map((workspace) => workspace.id), ["application", "contact_wallet"]);
  assert.deepEqual(executor.map((workspace) => workspace.label), ["Personal Vault", "Contact Wallet"]);
  assert.equal(buildPrototypeWorkspaceUrl("contact_wallet"), "/contact-wallet");
});

test("master admin email keeps application and enterprise workspaces visible together", () => {
  const roles = mergePlatformRoles(["consumer_user"], getMasterAdminRolesForEmail("IVANYARDLEY@ME.COM"));
  assert.deepEqual(roles, ["consumer_user", "super_admin"]);
  assert.deepEqual(getAvailableWorkspaces(roles).map((workspace) => workspace.id), [
    "application",
    "super_admin",
    "enterprise_admin",
    "probate_admin",
  ]);
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
  assert.match(appLayout, /Mobile navigation · role-aware workspace switch/);
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
  assert.match(switcher, /getAvailableWorkspaces/);
  assert.match(switcher, /alwaysShow/);
  assert.match(switcher, /!hasMultipleContexts && !alwaysShow/);
  assert.match(switcher, /lf-workspace-menu/);
  assert.match(switcher, /aria-haspopup="menu"/);
  assert.match(switcher, /aria-expanded=\{open\}/);
  assert.match(switcher, /Switch workspace/);
  assert.match(switcher, /lf-workspace-route-meta/);
  assert.match(switcher, /Workspace/);
  assert.match(globals, /--lf-shell-sidebar-width: 286px/);
  assert.match(globals, /--lf-shell-header-min-height: 76px/);
  assert.match(globals, /max-width: 700px\)[\s\S]*\.lf-mobile-drawer \.lf-workspace-switcher[\s\S]*display: block/);
});

test("workspace switcher uses controlled dismissal instead of sticky native details", () => {
  const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
  const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(switcher, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(switcher, /queueMicrotask\(\(\) => setOpen\(false\)\)/);
  assert.match(switcher, /document\.addEventListener\("pointerdown", onPointerDown\)/);
  assert.match(switcher, /document\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(switcher, /event\.key !== "Escape"/);
  assert.match(switcher, /triggerRef\.current\?\.focus\(\)/);
  assert.match(switcher, /window\.dispatchEvent\(new CustomEvent\("lf-admin-menu-open"/);
  assert.match(switcher, /window\.addEventListener\("lf-admin-menu-open", onOtherMenuOpen\)/);
  assert.doesNotMatch(switcher, /<details className="lf-workspace-menu"/);
  assert.doesNotMatch(switcher, /<summary className="lf-workspace-current"/);
  assert.match(globals, /\.lf-workspace-current \{\n  border: 0;\n  background: transparent;/);
});

test("current workspace detection recognises enterprise, probate, executor, and application routes", () => {
  assert.equal(getCurrentWorkspaceForPath("/admin"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/admin/admin-users"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/admin/system-health"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/prototype/users"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/prototype/enterprise"), "enterprise_admin");
  assert.equal(getCurrentWorkspaceForPath("/application/enterprise"), "enterprise_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/prototype/cases"), "probate_admin");
  assert.equal(getCurrentWorkspaceForPath("/application/admin"), "super_admin");
  assert.equal(getCurrentWorkspaceForPath("/internal/admin/probate"), "probate_admin");
  assert.equal(getCurrentWorkspaceForPath("/contact-wallet"), "contact_wallet");
  assert.equal(getCurrentWorkspaceForPath("/executors"), "contact_wallet");
  assert.equal(getCurrentWorkspaceForPath("/user"), "application");
  assert.equal(getCurrentWorkspaceForPath("/dashboard"), "application");
});
