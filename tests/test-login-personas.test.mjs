import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("internal test login exposes safe mock personas without touching production auth", () => {
  const personaCatalog = read("lib/testPersonas.ts");
  const testLoginPage = read("app/internal/test-login/page.tsx");
  const personaDetailPage = read("app/internal/test-login/[persona]/page.tsx");
  const banner = read("components/internal/TestPersonaBanner.tsx");
  const diagnostics = read("components/internal/PrototypeSessionDiagnostics.tsx");
  const workspaceSwitcher = read("components/navigation/WorkspaceSwitcher.tsx");
  const workspaces = read("lib/workspaces.ts");
  const layout = read("app/layout.tsx");
  const authEntry = read("components/auth/PublicAuthEntry.tsx");
  const routeManifest = read("config/routeManifest.tsx");
  const adminShell = read("components/admin/prototype/AdminPrototypeShell.tsx");

  assert.match(testLoginPage, /Beta test access — mock role preview/);
  assert.match(testLoginPage, /WorkspaceSwitcher/);
  assert.match(testLoginPage, /Assigned roles/);
  assert.match(testLoginPage, /This is not production authentication/);
  assert.match(testLoginPage, /No Supabase auth bypass/);
  assert.match(testLoginPage, /Hidden from consumer navigation/);
  assert.match(testLoginPage, /isTestPersonaAccessEnabled/);
  assert.match(testLoginPage, /Test persona access is disabled/);
  assert.match(testLoginPage, /NEXT_PUBLIC_ENABLE_TEST_PERSONAS=true/);
  assert.match(testLoginPage, /window\.localStorage\.setItem\(TEST_PERSONA_STORAGE_KEY, persona\.id\)/);
  assert.match(testLoginPage, /window\.location\.assign\(persona\.previewHref\)/);

  assert.match(personaDetailPage, /Persona not found/);
  assert.match(personaDetailPage, /Open preview route/);
  assert.match(personaDetailPage, /does not alter real authentication/);
  assert.match(personaDetailPage, /Restricted-access behaviour/);
  assert.match(personaDetailPage, /isTestPersonaAccessEnabled/);

  assert.match(banner, /Test persona mode/);
  assert.match(banner, /mock role preview only/);
  assert.match(banner, /Real authentication and production permissions are unchanged/);
  assert.match(banner, /TEST_PERSONA_STORAGE_KEY/);
  assert.match(banner, /TEST_PERSONA_QUERY_PARAM/);
  assert.match(banner, /isTestPersonaAccessEnabled/);
  assert.match(banner, /Clear preview/);
  assert.doesNotMatch(banner, /supabase|bootstrapAuthenticatedUser|auth\.getSession/);

  assert.match(layout, /TestPersonaBanner/);
  assert.doesNotMatch(authEntry, /TEST_PERSONA|test-login|mock role preview/);
  assert.doesNotMatch(routeManifest, /\/internal\/test-login/);

  for (const id of [
    "free-subscriber",
    "paid-subscriber",
    "executor",
    "adviser",
    "partner-organisation-user",
    "commercial-admin",
    "probate-admin",
    "super-admin",
  ]) {
    assert.match(personaCatalog, new RegExp(`id: "${id}"`));
  }

  assert.match(personaCatalog, /Free consumer subscriber/);
  assert.match(personaCatalog, /export const TEST_PERSONA_ENABLE_ENV = "NEXT_PUBLIC_ENABLE_TEST_PERSONAS"/);
  assert.match(personaCatalog, /function buildPrototypePreviewHref/);
  assert.match(personaCatalog, /function getPrototypeDashboardLinks/);
  assert.match(personaCatalog, /getAvailableWorkspaces/);
  assert.match(personaCatalog, /admin: "true"/);
  assert.match(personaCatalog, /prototype: "true"/);
  assert.match(personaCatalog, /roles: \["super_admin"\]/);
  assert.match(personaCatalog, /process\.env\.NEXT_PUBLIC_ENABLE_TEST_PERSONAS === "true"/);
  assert.match(personaCatalog, /process\.env\.NODE_ENV !== "production"/);
  assert.match(personaCatalog, /function getAdminPrototypeRoleForTestPersona/);
  assert.match(personaCatalog, /case "partner-organisation-user":\s*return "enterprise_admin"/);
  assert.match(personaCatalog, /case "commercial-admin":\s*return "licensing_admin"/);
  assert.match(personaCatalog, /case "probate-admin":\s*return "probate_admin"/);
  assert.match(personaCatalog, /case "super-admin":\s*return "super_admin"/);
  assert.match(personaCatalog, /Paid consumer subscriber/);
  assert.match(personaCatalog, /Executor/);
  assert.match(personaCatalog, /Adviser/);
  assert.match(personaCatalog, /Partner organisation user/);
  assert.match(personaCatalog, /Commercial admin/);
  assert.match(personaCatalog, /Probate admin/);
  assert.match(personaCatalog, /Super admin/);

  assert.match(personaCatalog, /\/dashboard\?testPersona=free-subscriber/);
  assert.match(personaCatalog, /\/dashboard\?testPersona=paid-subscriber/);
  assert.match(personaCatalog, /\/dashboard\?testPersona=executor/);
  assert.match(personaCatalog, /\/dashboard\?testPersona=adviser/);
  assert.match(personaCatalog, /buildPrototypePreviewHref\("\/internal\/admin\/prototype\/enterprise", "enterprise_admin"\)/);
  assert.match(personaCatalog, /buildPrototypePreviewHref\("\/internal\/admin\/prototype\/enterprise", "licensing_admin"\)/);
  assert.match(personaCatalog, /buildPrototypePreviewHref\("\/internal\/admin\/prototype\/cases", "probate_admin"\)/);
  assert.match(personaCatalog, /\/internal\/admin\/prototype\/enterprise", "super_admin"/);

  assert.match(diagnostics, /Prototype session diagnostics/);
  assert.match(diagnostics, /Current access context/);
  assert.match(workspaceSwitcher, /lf-workspace-switcher/);
  assert.match(workspaceSwitcher, /Prototype session/);
  assert.match(workspaceSwitcher, /Switch role preview/);
  assert.match(workspaces, /export function resolveWorkspaceRoutes/);
  assert.match(workspaces, /export function buildPrototypeWorkspaceUrl/);
  assert.match(workspaces, /Platform Administration/);
  assert.match(workspaces, /Enterprise Operations/);
  assert.match(workspaces, /Probate Review/);
  assert.match(workspaces, /Personal Vault/);
  assert.match(workspaces, /Executor Workspace/);
  assert.match(workspaces, /Enterprise Operations/);
  assert.match(workspaces, /Probate Review/);
  assert.match(workspaces, /Platform Administration/);
  assert.match(diagnostics, /ivanyardley is not super_admin/);
  assert.match(diagnostics, /Exports, campaigns, billing, and production admin bypasses remain disabled/);

  assert.match(adminShell, /Access restricted/);
  assert.match(adminShell, /WorkspaceSwitcher/);
  assert.match(adminShell, /governanceContext/);
  assert.match(adminShell, /hasAccess \? children : <AccessRestricted/);
  assert.match(adminShell, /roleParam/);
  assert.match(adminShell, /getAdminPrototypeRoleForTestPersona/);
  assert.match(adminShell, /TEST_PERSONA_STORAGE_KEY/);
});

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
