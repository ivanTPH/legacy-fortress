import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { resolveWorkspaceAccountLinks } = await import("../lib/navigation/workspaceAccountLinks.ts");

const hrefs = (links) => links.map((link) => link.href);

test("Vault shows no Admin or Partner links without a verified admin session", () => {
  assert.deepEqual(hrefs(resolveWorkspaceAccountLinks("vault", null)), []);
});

test("master admin in the Vault can open Platform Admin and Partner Portal", () => {
  assert.deepEqual(hrefs(resolveWorkspaceAccountLinks("vault", { isMasterAdmin: true, role: "super_admin", capabilities: [] })), ["/admin", "/enterprise"]);
});

test("Admin shell links back to My Vault and does not repeat itself", () => {
  assert.deepEqual(hrefs(resolveWorkspaceAccountLinks("admin", { isMasterAdmin: true, role: "super_admin", capabilities: [] })), ["/dashboard", "/enterprise"]);
});

test("enterprise-only admin sees Partner Portal but not Platform Admin", () => {
  assert.deepEqual(hrefs(resolveWorkspaceAccountLinks("vault", { isMasterAdmin: false, role: "enterprise_admin", capabilities: ["organisation:view"] })), ["/enterprise"]);
  assert.deepEqual(hrefs(resolveWorkspaceAccountLinks("partner", { isMasterAdmin: false, role: "enterprise_admin", capabilities: ["organisation:view"] })), ["/dashboard"]);
});

test("a person with their own Vault lands in it even when they hold admin roles", () => {
  const source = fs.readFileSync(new URL("../lib/auth/bootstrap.ts", import.meta.url), "utf8");
  assert.match(source, /roles\.length > 0 && !onboarding\.is_completed \? getDefaultLandingForRoles\(roles\) : completedDestination/);
});

test("Vault and Admin account menus render the verified workspace links", () => {
  const layout = fs.readFileSync(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8");
  const shell = fs.readFileSync(new URL("../components/admin/AdminWorkspaceShell.tsx", import.meta.url), "utf8");
  assert.match(layout, /<WorkspaceAccountLinks current="vault"/);
  assert.match(shell, /<WorkspaceAccountLinks current=/);
});
