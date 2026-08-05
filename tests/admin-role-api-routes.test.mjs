import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  handleGetAdminUser,
  handleListAdminUsers,
  handleListAuditEvents,
  handleListRoles,
  handleListWorkspaces,
} from "../lib/backend/adminRoleApiHandlers.ts";
import { adminApiGuardReadiness, requireAdminApiAccess } from "../lib/backend/adminApiGuard.ts";
import { createPrototypeAuditEvent } from "../lib/audit/auditEvents.ts";
import { retiredLegacyAdminMutationResponse } from "../lib/backend/legacyAdminApi.ts";

const root = process.cwd();
const prototypeSearch = "role=super_admin&admin=true&prototype=true";

function req(pathname, { method = "GET", body, headers = {} } = {}) {
  return new Request(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response) {
  return response.json();
}

test("admin API route files exist for user, role, workspace, and audit contracts", () => {
  for (const routePath of [
    "app/api/admin/users/route.ts",
    "app/api/admin/users/[userId]/route.ts",
    "app/api/admin/roles/route.ts",
    "app/api/admin/roles/propose-change/route.ts",
    "app/api/admin/roles/validate-change/route.ts",
    "app/api/admin/roles/submit-change/route.ts",
    "app/api/admin/users/[userId]/suspend/route.ts",
    "app/api/admin/accounts/[accountId]/restrict/route.ts",
    "app/api/admin/audit/route.ts",
    "app/api/admin/workspaces/route.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, routePath)), true, routePath);
  }
});

test("guard blocks unauthorised admin API calls and production query-param escalation", async () => {
  assert.match(adminApiGuardReadiness.productionRule, /query parameters never grant production admin access/);
  const denied = requireAdminApiAccess(req("/api/admin/users"));
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? "" : denied.reason, "admin_role_required");

  const previous = process.env.LEGACY_FORTRESS_ENV;
  process.env.LEGACY_FORTRESS_ENV = "production";
  try {
    const prodDenied = requireAdminApiAccess(req(`/api/admin/users?${prototypeSearch}`));
    assert.equal(prodDenied.ok, false);
    assert.equal(prodDenied.ok ? "" : prodDenied.reason, "admin_role_required");
  } finally {
    if (previous === undefined) delete process.env.LEGACY_FORTRESS_ENV;
    else process.env.LEGACY_FORTRESS_ENV = previous;
  }
});

test("GET admin API routes return standard mock envelopes", async () => {
  const users = await json(await handleListAdminUsers(req(`/api/admin/users?${prototypeSearch}`)));
  assert.equal(users.ok, true);
  assert.equal(users.mock, true);
  assert.equal(users.persistence, "mock_only");
  assert.ok(users.data.length >= 1);

  const detail = await json(await handleGetAdminUser(req(`/api/admin/users/USR-552?${prototypeSearch}`), "USR-552"));
  assert.equal(detail.ok, true);
  assert.equal(detail.data.id, "USR-552");

  const roles = await json(await handleListRoles(req(`/api/admin/roles?${prototypeSearch}`)));
  assert.equal(roles.ok, true);
  assert.ok(roles.data.platform.super_admin.includes("manage_platform_admins"));

  const audit = await json(await handleListAuditEvents(req(`/api/admin/audit?${prototypeSearch}&userId=USR-552`)));
  assert.equal(audit.ok, true);
  assert.equal(audit.mock, true);

  const workspaces = await json(await handleListWorkspaces(req(`/api/admin/workspaces?${prototypeSearch}`)));
  assert.equal(workspaces.ok, true);
  assert.ok(workspaces.data.some((item) => item.id === "super_admin"));
});

test("legacy /api/admin mutation endpoints are retired instead of returning mock success", async () => {
  for (const [action, canonicalPath] of [
    ["propose_role_change", "/api/internal/admin/admin-users"],
    ["validate_role_change", "/api/internal/admin/admin-users"],
    ["submit_role_change", "/api/internal/admin/admin-users"],
    ["suspend_user", "/api/internal/admin/admin-users"],
    ["restrict_account", "/api/internal/admin/admin-users"],
    ["emit_audit_event", "/api/internal/admin/audit-history"],
  ]) {
    const response = await retiredLegacyAdminMutationResponse({ action, canonicalPath });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("cache-control"), "private, no-cache, no-store, max-age=0, must-revalidate");
    const body = await json(response);
    assert.equal(body.ok, false);
    assert.equal(body.code, "LEGACY_ADMIN_API_RETIRED");
    assert.equal(body.action, action);
    assert.equal(body.canonicalPath, canonicalPath);
    assert.equal(body.databaseChanged, false);
  }
});

test("legacy audit read remains mock-backed while audit writes are retired", async () => {
  const event = createPrototypeAuditEvent({
    id: "api-audit-1",
    category: "admin_review",
    actor: { id: "IND-ADM-001", type: "admin", displayName: "Sarah Ahmed", role: "super_admin" },
    action: "API audit route regression",
    result: "preview_only",
    resource: { type: "access_policy", id: "USR-552", label: "Role policy" },
    context: { surface: "role_permission_management", route: "/api/admin/audit" },
    governance: { prototypeOnly: true, exportEnabled: false },
  });
  assert.equal(Boolean(event.id), true);
  const audit = await json(await handleListAuditEvents(req(`/api/admin/audit?${prototypeSearch}&userId=USR-552`)));
  assert.equal(audit.ok, true);
  assert.equal(audit.mock, true);
});
