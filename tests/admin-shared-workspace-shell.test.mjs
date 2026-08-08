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
  assert.match(source, /Sign out/);
  assert.match(source, /aria-label="Sign out of Legacy Fortress"/);
  assert.match(source, /lf-admin-shell-account-trigger/);
  assert.match(source, /lf-admin-shell-account-popover/);
  assert.match(source, /AccountAvatar/);
  assert.match(source, /lf-topbar-user-avatar/);
  assert.match(source, /lf-topbar-user-avatar-fallback/);
  assert.match(source, /identityAvatarUrl/);
  assert.match(source, /role="menu"/);
  assert.match(source, /role="menuitem"/);
  assert.match(source, /\/account\/security/);
  assert.doesNotMatch(source, /href="\/dashboard" className="lf-admin-shell-secondary"/);
  assert.match(source, /lf-admin-shell-drawer-account/);
  assert.match(source, /lf-admin-shell-drawer-signout/);
  assert.match(source, /lf-admin-shell-drawer-close[\s\S]+lf-admin-shell-drawer-account[\s\S]+\{sidebar\}/);
  assert.match(source, /flex-wrap: wrap/);
  assert.match(source, /white-space: nowrap/);
  assert.match(source, /prefetch=\{false\}/);
  assert.match(source, /@media \(max-width: 860px\)/);
  assert.match(source, /overflow-wrap: break-word/);
  assert.match(source, /min-height: 44px/);
});

test("admin account menu uses separated avatar identity rows and avoids fused account text", () => {
  const source = read("components/admin/AdminWorkspaceShell.tsx");
  const css = source.match(/const adminShellCss = `([\s\S]+)`;/)?.[1] ?? "";

  assert.match(source, /splitIdentityDetail/);
  assert.match(source, /toDisplayRole/);
  assert.match(source, /lf-admin-shell-account-summary-copy/);
  assert.match(source, /lf-admin-shell-account-email/);
  assert.match(source, /lf-admin-shell-account-role/);
  assert.match(source, /lf-admin-shell-account-menu-section/);
  assert.match(source, /lf-admin-shell-account-signout/);
  assert.match(source, /<span>Profile<\/span>/);
  assert.match(source, /<span>Account security<\/span>/);
  assert.match(source, /<span>Sign out<\/span>/);
  assert.doesNotMatch(source, /Ivan Yardleysuper admin/);
  assert.doesNotMatch(source, /ProfileAccount securitySign out/);
  assert.match(css, /\.lf-admin-shell-account-summary-copy\s*\{[\s\S]+display: grid/);
  assert.match(css, /\.lf-admin-shell-account-menu-section\s*\{[\s\S]+border-top: 1px solid #e2e8f0/);
  assert.match(css, /\.lf-admin-shell-account-popover a > span,[\s\S]+white-space: nowrap/);
});

test("admin account menu dismisses on outside click, Escape and route change", () => {
  const source = read("components/admin/AdminWorkspaceShell.tsx");

  assert.match(source, /queueMicrotask\(\(\) => \{[\s\S]*setAccountMenuOpen\(false\);[\s\S]*setMenuOpen\(false\);/);
  assert.match(source, /document\.addEventListener\("pointerdown", onPointerDown\)/);
  assert.match(source, /document\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /accountTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\("lf-admin-menu-open"/);
  assert.match(source, /window\.addEventListener\("lf-admin-menu-open", onOtherMenuOpen\)/);
  assert.match(source, /onClick=\{\(\) => \{ setAccountMenuOpen\(false\); onSignOut\(\); \}\}/);
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
  const enterpriseOrgDetail = read("components/enterprise/EnterpriseOrganisationDetailWorkspace.tsx");
  const enterpriseLicenceDetail = read("components/enterprise/EnterpriseLicenceDetailWorkspace.tsx");
  const probatePage = read("app/admin/probate/page.tsx");

  assert.match(platform, /AdminWorkspaceShell/);
  assert.match(platform, /PLATFORM_ADMIN_NAVIGATION/);
  assert.match(platform, /workspaceLabel="Platform Administration"/);
  assert.match(enterprise, /AdminWorkspaceShell/);
  assert.match(enterprise, /ENTERPRISE_ADMIN_NAVIGATION/);
  assert.match(enterprise, /workspaceLabel="Enterprise Operations"/);
  assert.match(enterpriseOrgDetail, /AdminWorkspaceShell/);
  assert.match(enterpriseOrgDetail, /filterAdminNavigation\(ENTERPRISE_ADMIN_NAVIGATION/);
  assert.match(enterpriseLicenceDetail, /AdminWorkspaceShell/);
  assert.match(enterpriseLicenceDetail, /filterAdminNavigation\(ENTERPRISE_ADMIN_NAVIGATION/);
  assert.match(probatePage, /section="probate"/);
});

test("shared admin shell constrains long content and tables on small screens", () => {
  const source = read("components/admin/AdminWorkspaceShell.tsx");
  const globalCss = read("app/globals.css");
  assert.match(source, /overflow-x: hidden/);
  assert.match(source, /overflow-wrap: break-word/);
  assert.match(source, /lf-admin-shell-content table/);
  assert.match(source, /overflow-x: auto/);
  assert.match(source, /-webkit-overflow-scrolling: touch/);
  assert.match(globalCss, /\.lf-admin-shell\s*\{/);
  assert.match(globalCss, /grid-template-columns: 280px minmax\(0, 1fr\)/);
  assert.match(globalCss, /\.lf-admin-shell > \.lf-admin-shell-sidebar[\s\S]+display: none/);
  assert.match(globalCss, /\.lf-admin-shell-mobile-toggle[\s\S]+display: inline-flex/);
});

test("shared admin data table supports toolbar and mobile card rows", () => {
  const source = read("components/admin/AdminPrimitives.tsx");
  const globalCss = read("app/globals.css");
  assert.match(source, /description\?: ReactNode/);
  assert.match(source, /actions\?: ReactNode/);
  assert.match(source, /lf-admin-data-toolbar/);
  assert.match(source, /lf-admin-data-card-row/);
  assert.match(source, /overflow-wrap: break-word/);
  assert.match(source, /word-break: keep-all/);
  assert.match(globalCss, /\.lf-admin-data-table\s*\{/);
  assert.match(globalCss, /\.lf-admin-data-cards[\s\S]+display: none/);
  assert.match(globalCss, /@media \(max-width: 720px\)[\s\S]+\.lf-admin-data-table[\s\S]+display: none/);
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

test("admin product audit records prototype follow-up and remediated detail shells", () => {
  const audit = read("docs/admin/ADMIN_PRODUCT_AUDIT.md");
  assert.match(audit, /ADMIN-UX-004/);
  assert.match(audit, /internal\/admin\/prototype/);
  assert.match(audit, /ADMIN-NEXT-001/);
  assert.match(audit, /Remediated with `AdminWorkspaceShell`/);
  assert.match(audit, /Severity Scale/);
});
