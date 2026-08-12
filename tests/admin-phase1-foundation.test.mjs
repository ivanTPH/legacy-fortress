import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  deriveAdminRole,
  getAdminRoleCapabilities,
  hasAdminCapability,
  normalizeAdminRole,
} from "../lib/admin/capabilities.ts";

const root = process.cwd();

test("admin roles normalise to the approved Phase 1 capability model", () => {
  assert.equal(normalizeAdminRole("support-agent"), "support_agent");
  assert.equal(normalizeAdminRole("probate_reviewer"), "probate_reviewer");
  assert.equal(normalizeAdminRole("enterprise_admin"), "enterprise_admin");
  assert.equal(normalizeAdminRole("organisation_admin"), "enterprise_admin");
  assert.equal(normalizeAdminRole("unknown"), null);
  assert.equal(deriveAdminRole({ isMaster: true, role: "support_agent" }), "super_admin");
  assert.equal(deriveAdminRole({ isMaster: false, role: null }), "support_agent");

  assert.equal(hasAdminCapability("super_admin", "admin.dashboard.read"), true);
  assert.equal(hasAdminCapability("support_agent", "admin.support.summary.read"), true);
  assert.equal(hasAdminCapability("enterprise_admin", "admin.licences.summary.read"), true);
  assert.equal(hasAdminCapability("super_admin", "admin_users:manage"), true);
  assert.equal(hasAdminCapability("support_agent", "users:lookup"), true);
  assert.equal(hasAdminCapability("support_agent", "verification:decide"), false);
  assert.equal(hasAdminCapability("auditor", "audit:read"), true);
  assert.equal(hasAdminCapability("auditor", "verification:review"), false);
  assert.ok(getAdminRoleCapabilities("probate_reviewer").includes("verification:decide"));
});

test("admin Phase 1 migration adds role persistence and append-only audit events", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260630170000_admin_phase1_foundation.sql"), "utf8");
  assert.match(migration, /ALTER TABLE public\.admin_users/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS role/);
  assert.match(migration, /enterprise_admin/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.audit_events/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /prevent_audit_event_mutation/);
  assert.match(migration, /BEFORE UPDATE ON public\.audit_events/);
  assert.match(migration, /BEFORE DELETE ON public\.audit_events/);
});

test("admin command dashboard foundation has protected route, access denied page and safe aggregate API", () => {
  const adminPage = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  const deniedPage = fs.readFileSync(path.join(root, "app/admin/access-denied/page.tsx"), "utf8");
  const dashboardRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/dashboard-summary/route.ts"), "utf8");
  const dashboardService = fs.readFileSync(path.join(root, "lib/admin/dashboardSummary.ts"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminControlPlaneWorkspace.tsx"), "utf8");

  assert.match(adminPage, /AdminControlPlaneWorkspace/);
  assert.match(deniedPage, /Access not available/);
  assert.match(deniedPage, /Return to your vault/);
  assert.match(dashboardRoute, /requireAdminAccess\(request\)/);
  assert.match(dashboardRoute, /requireAdminCapability\(admin\.access, "admin\.dashboard\.read"\)/);
  assert.match(dashboardRoute, /Admin dashboard summary opened/);
  assert.match(dashboardService, /loadAdminDashboardSummary/);
  assert.match(dashboardService, /section_key", "legal"/);
  assert.match(dashboardService, /category_key", "wills"/);
  assert.match(dashboardService, /value: number \| null/);
  assert.match(dashboardService, /available: false/);
  assert.match(dashboardService, /Do not|unavailable|could not be queried/i);
  assert.doesNotMatch(dashboardRoute, /document_path|signedUrl|password|service_role/i);
  assert.match(workspace, /\/api\/internal\/admin\/dashboard-summary/);
  assert.match(workspace, /Customer vault contents and private documents are not shown here/);
  assert.match(workspace, /\/admin\/admin-users/);
  assert.match(workspace, /\/admin\/probate/);
  assert.match(workspace, /\/admin\/system-health/);
  assert.match(workspace, /High-risk settings remain read-only/);
  assert.doesNotMatch(workspace, /local-role-override/);
  assert.doesNotMatch(workspace, /Local UAT role testing/);
  assert.doesNotMatch(deniedPage, /local-role-override/);
});

test("admin access rejects invalid role rows and keeps hosted roles server resolved", () => {
  const access = fs.readFileSync(path.join(root, "lib/admin/access.ts"), "utf8");

  assert.match(access, /invalid_admin_role/);
  assert.match(access, /normalizeAdminRole\(adminRow\.role\)/);
  assert.match(access, /getAdminRoleCapabilities\(effectiveRole\)/);
  assert.doesNotMatch(access, /queryRole|admin=true|prototype=true/);
});

test("internal admin API routes enforce capabilities and audit existing sensitive actions", () => {
  const adminUsersRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/admin-users/route.ts"), "utf8");
  const auditHistoryRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/audit-history/route.ts"), "utf8");
  const usersRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/users/route.ts"), "utf8");
  const verificationRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/verifications/route.ts"), "utf8");
  const supportRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/support/route.ts"), "utf8");
  const operations = fs.readFileSync(path.join(root, "lib/admin/operations.ts"), "utf8");

  assert.match(adminUsersRoute, /requireAdminCapability\(admin\.access, "admin_users:manage"\)/);
  assert.match(adminUsersRoute, /recordAdminAuditEvent/);
  assert.match(adminUsersRoute, /export async function PATCH/);
  assert.match(adminUsersRoute, /planAdminUserLifecycleUpdate/);
  assert.match(adminUsersRoute, /applyAdminUserLifecycleUpdate/);
  assert.match(adminUsersRoute, /noStoreJson/);
  assert.match(adminUsersRoute, /checkAdminLifecycleRateLimit/);
  assert.match(adminUsersRoute, /safeAdminErrorResponse/);
  assert.match(adminUsersRoute, /reason_present/);
  assert.doesNotMatch(adminUsersRoute, /error instanceof Error \? error\.message/);
  assert.match(auditHistoryRoute, /export async function GET/);
  assert.doesNotMatch(auditHistoryRoute, /export async function POST|export async function PUT|export async function PATCH|export async function DELETE/);
  assert.match(auditHistoryRoute, /requireAdminCapability\(admin\.access, "audit:read"\)/);
  assert.match(auditHistoryRoute, /loadAuditHistory/);
  assert.match(operations, /normalizeAuditHistoryLimit/);
  assert.match(operations, /Math\.min\(Math\.max\(parsed, 1\), 100\)/);
  assert.match(operations, /select\("id,category,action,result,actor_email_normalized,actor_role,resource_type,resource_label,route,policy_decision,created_at"\)/);
  assert.doesNotMatch(operations, /select\("[^"]*metadata/);
  assert.doesNotMatch(operations, /actor_user_id/);
  assert.doesNotMatch(operations, /resource_id/);
  assert.match(usersRoute, /requireAdminCapability\(admin\.access, "users:lookup"\)/);
  assert.match(usersRoute, /Admin user lookup/);
  assert.match(supportRoute, /requireAdminCapability\(admin\.access, "support:read"\)/);
  assert.match(verificationRoute, /requireAdminCapability\(admin\.access, "verification:read"\)/);
  assert.match(verificationRoute, /verification:decide/);
  assert.match(verificationRoute, /Decision notes are required/);
  assert.match(verificationRoute, /recordAdminAuditEvent/);
});

test("admin operations exposes audited lifecycle controls and section navigation", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminOpsWorkspace.tsx"), "utf8");
  const operations = fs.readFileSync(path.join(root, "lib/admin/operations.ts"), "utf8");

  assert.match(workspace, /aria-label="Admin sections"/);
  assert.match(workspace, /id="admin-users"/);
  assert.match(workspace, /id="support-tools"/);
  assert.match(workspace, /id="user-lookup"/);
  assert.match(workspace, /id="verification-queue"/);
  assert.match(workspace, /id="probate-cases"/);
  assert.match(workspace, /id="audit-history"/);
  assert.match(workspace, /method: "PATCH"/);
  assert.match(workspace, /change_role/);
  assert.match(workspace, /Deactivate/);
  assert.match(workspace, /Activate/);
  assert.match(workspace, /Synthetic staging admin/);
  assert.match(operations, /assertAnotherActiveMasterAdminExists/);
  assert.match(operations, /ADMIN_LAST_SUPER_ADMIN/);
  assert.match(operations, /ADMIN_SELF_ACTION_BLOCKED/);
  assert.match(operations, /ADMIN_PROTECTED_ACCOUNT/);
  assert.match(operations, /ADMIN_AUDIT_FAILED/);
  assert.match(operations, /missing_lifecycle_reason/);
});

test("admin control plane splits live admin operations into permission-aware routes", () => {
  const controlPlane = fs.readFileSync(path.join(root, "components/admin/AdminControlPlaneWorkspace.tsx"), "utf8");
  const adminShell = fs.readFileSync(path.join(root, "components/admin/AdminWorkspaceShell.tsx"), "utf8");
  const adminPage = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  const adminUsersPage = fs.readFileSync(path.join(root, "app/admin/admin-users/page.tsx"), "utf8");
  const usersPage = fs.readFileSync(path.join(root, "app/admin/users/page.tsx"), "utf8");
  const supportPage = fs.readFileSync(path.join(root, "app/admin/support/page.tsx"), "utf8");
  const auditPage = fs.readFileSync(path.join(root, "app/admin/audit/page.tsx"), "utf8");
  const healthPage = fs.readFileSync(path.join(root, "app/admin/system-health/page.tsx"), "utf8");
  const settingsPage = fs.readFileSync(path.join(root, "app/admin/settings/page.tsx"), "utf8");

  assert.match(adminPage, /AdminControlPlaneWorkspace section="overview"/);
  assert.match(adminUsersPage, /AdminControlPlaneWorkspace section="admin-users"/);
  assert.match(usersPage, /AdminControlPlaneWorkspace section="users"/);
  assert.match(supportPage, /AdminControlPlaneWorkspace section="support"/);
  assert.match(auditPage, /AdminControlPlaneWorkspace section="audit"/);
  assert.match(healthPage, /AdminControlPlaneWorkspace section="system-health"/);
  assert.match(settingsPage, /AdminControlPlaneWorkspace section="settings"/);

  assert.match(controlPlane, /workspaceLabel=\{section === "probate" \|\| section === "probate-detail" \? "Probate Review" : "Platform Administration"\}/);
  assert.match(controlPlane, /AdminWorkspaceShell/);
  assert.match(adminShell, /aria-label=\{`\$\{workspaceLabel\} navigation`\}/);
  assert.match(adminShell, /WorkspaceSwitcher/);
  assert.match(controlPlane, /\/api\/internal\/admin\/session/);
  assert.match(controlPlane, /\/api\/internal\/admin\/admin-users/);
  assert.match(controlPlane, /\/api\/internal\/admin\/support/);
  assert.match(controlPlane, /\/api\/internal\/admin\/verifications/);
  assert.match(controlPlane, /\/api\/internal\/admin\/probate-cases/);
  assert.match(controlPlane, /\/api\/internal\/admin\/audit-history\?limit=50/);
  assert.match(controlPlane, /\/api\/internal\/admin\/system-health/);
  assert.match(controlPlane, /Synthetic staging admin/);
  assert.match(controlPlane, /No summary metrics are available/);
  assert.match(controlPlane, /No audit events match this filter/);
  assert.match(controlPlane, /This page intentionally avoids a generic key\/value editor/);
  assert.doesNotMatch(controlPlane, /mockData|prototypeDataService|adminUsers\]/);
});

test("admin audit history is read-only in the workspace", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminOpsWorkspace.tsx"), "utf8");

  assert.match(workspace, /const canReadAudit = capabilities\.includes\("audit:read"\)/);
  assert.match(workspace, /authFetch\("\/api\/internal\/admin\/audit-history\?limit=25"\)/);
  assert.match(workspace, /<h2 style=\{h2Style\}>Audit history<\/h2>/);
  assert.match(workspace, /Read-only view of recent admin audit events/);
  assert.match(workspace, /Payload metadata and internal secrets are not shown/);
  assert.doesNotMatch(workspace, /actOnAudit|saveAudit|deleteAudit|removeAudit|approveAudit|revokeAudit/);
});

test("hosted admin routes use app session checks unless the edge guard is explicitly enabled", () => {
  const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");
  assert.match(proxy, /pathname\.startsWith\("\/application\/admin"\)/);
  assert.match(proxy, /pathname\.startsWith\("\/application\/enterprise"\)/);
  assert.match(proxy, /return false;/);
  assert.match(proxy, /process\.env\[INTERNAL_ADMIN_EDGE_GUARD_FLAG\] === "true"/);
  assert.match(proxy, /applyRoleBasedAccessMiddleware/);
});
