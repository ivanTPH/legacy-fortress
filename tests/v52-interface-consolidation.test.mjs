import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ENTERPRISE_ADMIN_NAVIGATION, filterAdminNavigation, labelPartnerNavigation } from "../components/admin/adminNavigation.ts";
import { getPwaStartUrl } from "../lib/pwa/startUrl.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Partner labels only change permitted navigation presentation", () => {
  const capabilities = ["enterprise.workspace.access", "enterprise.membership.read", "enterprise.invitation.manage"];
  const permitted = filterAdminNavigation(ENTERPRISE_ADMIN_NAVIGATION, capabilities);
  const partner = labelPartnerNavigation(permitted);
  assert.deepEqual(partner.flatMap((group) => group.items.map((item) => item.key)), [
    "enterprise-overview", "enterprise-users", "enterprise-invitations", "enterprise-settings",
  ]);
  assert.equal(partner[0].items.find((item) => item.key === "enterprise-users")?.label, "Team & seats");
  assert.equal(ENTERPRISE_ADMIN_NAVIGATION[0].items.find((item) => item.key === "enterprise-users")?.label, "Users and seats");
});

test("organisation scope comes from the authorised Enterprise API on root and details", () => {
  const api = read("app/api/internal/admin/enterprise/route.ts");
  const licence = read("components/enterprise/EnterpriseLicenceDetailWorkspace.tsx");
  const organisation = read("components/enterprise/EnterpriseOrganisationDetailWorkspace.tsx");
  assert.equal((api.match(/organisationScoped: admin\.access\.enterpriseScope\?\.organisationScoped \?\? false/g) ?? []).length, 3);
  assert.match(licence, /setPartnerMode\(!platformAdmin && json\.uiAccess\?\.organisationScoped === true\)/);
  assert.match(organisation, /setPartnerMode\(json\.uiAccess\?\.organisationScoped === true\)/);
  assert.match(licence, /partnerMode \? "Partner Portal" : "Enterprise Operations"/);
  assert.match(organisation, /partnerMode \? "Partner Portal" : "Enterprise Operations"/);
});

test("mobile account controls expose Sign out and failed sign out does not navigate", () => {
  const vault = read("app/(app)/layout.tsx");
  const shell = read("components/admin/AdminWorkspaceShell.tsx");
  const admin = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const enterprise = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");
  assert.match(vault, /lf-mobile-drawer-signout/);
  assert.match(shell, /lf-admin-shell-drawer-signout/);
  for (const source of [vault, admin, enterprise]) {
    assert.match(source, /const \{ error \} = await supabase\.auth\.signOut\(\)/);
    assert.match(source, /if \(error\) \{?[\s\S]*?return;[\s\S]*?router\.replace\("\/sign-in"\)/);
  }
  assert.doesNotMatch(shell, /<WorkspaceSwitcher/);
  assert.match(shell, /<FounderTestLauncher/);
  assert.match(read("app/manifest.ts"), /start_url: getPwaStartUrl/);
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: "https://supabase-test.mylegacyfortress.com", environments: ["test"] }), "/pwa-entry");
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: "https://supabase-test.mylegacyfortress.com", environments: ["production"] }), "/");
});
