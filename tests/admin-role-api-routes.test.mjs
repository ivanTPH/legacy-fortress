import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  handleEmitAuditEvent,
  handleGetAdminUser,
  handleListAdminUsers,
  handleListAuditEvents,
  handleListRoles,
  handleListWorkspaces,
  handleProposeRoleChange,
  handleRestrictAccount,
  handleSubmitRoleChange,
  handleSuspendUser,
  handleValidateRoleChange,
} from "../lib/backend/adminRoleApiHandlers.ts";
import { adminApiGuardReadiness, requireAdminApiAccess } from "../lib/backend/adminApiGuard.ts";
import { createPrototypeAuditEvent } from "../lib/audit/auditEvents.ts";

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

function roleChange(overrides = {}) {
  return {
    request_id: "api-role-1",
    action_type: "permission_toggle",
    actor: {
      actor_id: "IND-ADM-001",
      actor_role: "super_admin",
      actor_permissions: ["view_account", "assign_account_roles", "manage_platform_admins", "suspend_users", "delete_users"],
      trusted_role_claims: false,
      source: "prototype",
    },
    target: {
      target_user_id: "USR-552",
      target_account_id: "VAULT-552",
      target_layer: "account",
    },
    previous_value: ["view_account"],
    proposed_value: ["view_account", "assign_account_roles"],
    requested_permissions: ["view_account", "assign_account_roles"],
    reason: "API route regression",
    ...overrides,
  };
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

test("POST role routes validate payloads and return blocked decisions through contract envelopes", async () => {
  const invalid = await handleValidateRoleChange(req(`/api/admin/roles/validate-change?${prototypeSearch}`, {
    method: "POST",
    body: { nope: true },
  }));
  assert.equal(invalid.status, 400);
  const invalidPayload = await json(invalid);
  assert.equal(invalidPayload.ok, false);
  assert.equal(invalidPayload.error.code, "invalid_payload");

  const proposed = await json(await handleProposeRoleChange(req(`/api/admin/roles/propose-change?${prototypeSearch}`, {
    method: "POST",
    body: roleChange(),
  })));
  assert.equal(proposed.ok, true);
  assert.equal(proposed.workflowState, "submitted");

  const blocked = await json(await handleSubmitRoleChange(req(`/api/admin/roles/submit-change?${prototypeSearch}`, {
    method: "POST",
    body: roleChange({
      actor: {
        actor_id: "USR-552",
        actor_role: "account_owner",
        actor_permissions: ["view_account", "assign_account_roles"],
        trusted_role_claims: false,
        source: "prototype",
      },
      target: {
        target_user_id: "IND-ADM-002",
        target_account_id: "PLATFORM",
        target_layer: "platform",
      },
      requested_permissions: ["manage_platform_admins"],
      proposed_value: "Admin",
      requested_platform_role: "admin",
    }),
  })));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.policyDecision, "blocked");
  assert.equal(blocked.workflowState, "blocked");
  assert.ok(blocked.auditEventId);
});

test("suspend, restrict, and audit routes stay mock-backed and audit shaped", async () => {
  const suspend = await json(await handleSuspendUser(req(`/api/admin/users/IND-ADM-002/suspend?${prototypeSearch}`, {
    method: "POST",
    body: roleChange({
      target: { target_user_id: "IND-ADM-002", target_account_id: "PLATFORM", target_layer: "platform" },
      requested_permissions: ["suspend_users"],
      dangerous_action: "suspend_user",
      confirmation: { confirmation_required: true, confirmed: false },
    }),
  }), "IND-ADM-002"));
  assert.equal(suspend.ok, false);
  assert.equal(suspend.error.code, "confirmation_required");

  const restrict = await json(await handleRestrictAccount(req(`/api/admin/accounts/VAULT-552/restrict?${prototypeSearch}`, {
    method: "POST",
    body: roleChange({
      action_type: "account_access_restriction",
      target: { target_user_id: "USR-552", target_account_id: "VAULT-552", target_layer: "account" },
    }),
  }), "VAULT-552"));
  assert.equal(restrict.ok, true);
  assert.equal(restrict.mock, true);

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
  const audit = await json(await handleEmitAuditEvent(req(`/api/admin/audit?${prototypeSearch}`, {
    method: "POST",
    body: event,
  })));
  assert.equal(audit.ok, true);
  assert.equal(audit.data.stored, false);
  assert.equal(audit.auditEventId, "api-audit-1");
});
