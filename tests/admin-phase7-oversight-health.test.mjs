import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("system health uses an authenticated internal admin endpoint", () => {
  const route = read("app/api/internal/admin/system-health/route.ts");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(route, /requireAdminAccess\(request\)/);
  assert.match(route, /requireAdminCapability\(admin\.access, "admin\.dashboard\.read"\)/);
  assert.match(route, /noStoreJson/);
  assert.match(route, /Admin system health opened/);
  assert.match(workspace, /\/api\/internal\/admin\/system-health/);
  assert.doesNotMatch(workspace, /fetch\("\/api\/health"\)/);
  assert.doesNotMatch(workspace, /fetch\("\/api\/health\/schema"\)/);
});

test("system health reports real safe subsystem checks without exposing secrets", () => {
  const route = read("app/api/internal/admin/system-health/route.ts");

  for (const table of ["audit_events", "admin_users", "contact_invitations", "verification_requests", "probate_cases", "probate_case_evidence"]) {
    assert.match(route, new RegExp(`countTable\\(admin\\.adminClient, "${table}"`));
  }

  assert.match(route, /Email delivery configuration/);
  assert.match(route, /Values are intentionally hidden/);
  assert.match(route, /Delivery must still be proven with a staging mailbox/);
  assert.doesNotMatch(route, /process\.env\[[^\]]+\]\s*[,}]/);
  assert.doesNotMatch(route, /service_role_key.*detail/i);
  assert.doesNotMatch(route, /signedUrl|document_path|raw_token|token_hash|password/i);
});

test("oversight UI renders deployment identity and structured subsystem rows", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(workspace, /Subsystem checks/);
  assert.match(workspace, /Build ID/);
  assert.match(workspace, /Commit SHA/);
  assert.match(workspace, /Secret exposure/);
  assert.match(workspace, /AdminStatusBadge status=\{check\.status\}/);
  assert.match(workspace, /Counts are aggregate metadata only/);
  assert.match(workspace, /System health checks are unavailable/);
});

test("audit history remains read-only and uses the canonical audit endpoint", () => {
  const auditRoute = read("app/api/internal/admin/audit-history/route.ts");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(auditRoute, /export async function GET/);
  assert.doesNotMatch(auditRoute, /export async function POST|export async function PUT|export async function PATCH|export async function DELETE/);
  assert.match(auditRoute, /requireAdminCapability\(admin\.access, "audit:read"\)/);
  assert.match(workspace, /\/api\/internal\/admin\/audit-history\?limit=50/);
  assert.match(workspace, /No audit events match this filter/);
});

test("admin destructive actions use accessible in-app confirmations instead of native browser dialogs", () => {
  const controlPlane = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const legacyOps = read("components/admin/AdminOpsWorkspace.tsx");

  assert.doesNotMatch(controlPlane, /window\.(confirm|prompt|alert)/);
  assert.doesNotMatch(legacyOps, /window\.(confirm|prompt|alert)/);
  assert.match(controlPlane, /role="alertdialog"/);
  assert.match(controlPlane, /requestConfirmation/);
  assert.match(legacyOps, /AdminReasonDialog/);
  assert.match(legacyOps, /role="dialog"/);
});
