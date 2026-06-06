import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ROLE_PERMISSION_API_CONTRACTS,
  ROLE_PERMISSION_PERSISTENCE_MAPPING,
  getRolePermissionApiContract,
  rolePermissionContractReadiness,
  validateActorContext,
  validateAuditEventPayload,
  validatePermissionKey,
  validateRoleChangeRequest,
  validateRoleIdentifier,
  validateWorkflowState,
} from "../lib/backend/rolePermissionContracts.ts";
import {
  roleManagementMockRepositories,
  roleManagementRoleRepository,
  roleManagementUserRepository,
} from "../components/admin/prototype/roleManagementService.ts";
import { createPrototypeAuditEvent } from "../lib/audit/auditEvents.ts";

const root = process.cwd();
const context = {
  requestId: "role-contract-test",
  principal: null,
  route: "/internal/admin/prototype/users",
  environment: "test",
  governance: { prototypeOnly: true, exportEnabled: false },
};

function validRoleChange(overrides = {}) {
  return {
    request_id: "role-contract-1",
    action_type: "permission_toggle",
    actor: {
      actor_id: "IND-ADM-001",
      actor_role: "super_admin",
      actor_permissions: ["view_account", "assign_account_roles", "manage_platform_admins", "suspend_users"],
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
    reason: "Regression contract validation",
    ...overrides,
  };
}

test("role permission API contracts cover user, role, workflow, audit, and workspace boundaries", () => {
  assert.ok(ROLE_PERMISSION_API_CONTRACTS.length >= 11);
  assert.equal(getRolePermissionApiContract("roles.individuals.list")?.route, "/api/internal/roles/individuals");
  assert.equal(getRolePermissionApiContract("roles.change.submit")?.requestDto, "RoleChangeRequestDto");
  assert.equal(getRolePermissionApiContract("roles.audit.emit")?.futurePersistence, "audit_events");
  assert.equal(rolePermissionContractReadiness.noLivePersistenceYet, true);
});

test("validation schemas accept valid payloads and reject invalid roles or permissions", () => {
  assert.equal(validateRoleIdentifier("super_admin"), true);
  assert.equal(validateRoleIdentifier("not_admin"), false);
  assert.equal(validatePermissionKey("view_account"), true);
  assert.equal(validatePermissionKey("root_access"), false);
  assert.equal(validateWorkflowState("pending_confirmation"), true);
  assert.equal(validateWorkflowState("half_done"), false);
  assert.equal(validateActorContext(validRoleChange().actor), true);
  assert.equal(validateRoleChangeRequest(validRoleChange()), true);
  assert.equal(validateRoleChangeRequest(validRoleChange({ requested_permissions: ["root_access"] })), false);
});

test("mock repositories satisfy contract interfaces and return structured blocked results", async () => {
  assert.equal(Boolean(roleManagementMockRepositories.users), true);
  const list = await roleManagementUserRepository.listRegisteredIndividuals({}, context);
  assert.equal(list.ok, true);
  assert.ok(list.ok && list.data.length >= 1);

  const templates = await roleManagementRoleRepository.listRoleTemplates(context);
  assert.equal(templates.ok, true);
  assert.ok(templates.ok && templates.data.platform.super_admin.includes("manage_platform_admins"));

  const blocked = await roleManagementRoleRepository.validatePermissionChange(validRoleChange({
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
  }), context);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok ? "" : blocked.error.code, "permission_denied");
  assert.equal(blocked.policyDecision, "blocked");
  assert.equal(blocked.workflowState, "blocked");
  assert.ok(blocked.auditEventId);
});

test("audit event payloads conform to role/audit schema and future persistence mapping is explicit", () => {
  const event = createPrototypeAuditEvent({
    id: "role-audit-contract",
    category: "admin_review",
    actor: { id: "IND-ADM-001", type: "admin", displayName: "Sarah Ahmed", role: "super_admin" },
    action: "Role contract audit emitted",
    result: "preview_only",
    resource: { type: "access_policy", id: "USR-552", label: "Role policy" },
    context: { surface: "role_permission_management", route: "/internal/admin/prototype/users" },
    governance: { prototypeOnly: true, exportEnabled: false },
  });
  assert.equal(validateAuditEventPayload(event), true);
  assert.equal(ROLE_PERMISSION_PERSISTENCE_MAPPING.role_assignments, "role_assignments");
  assert.equal(ROLE_PERMISSION_PERSISTENCE_MAPPING.audit_events, "audit_events");
});

test("service layer uses contract repositories without exposing repositories to pages", () => {
  const service = fs.readFileSync(path.join(root, "components/admin/prototype/roleManagementService.ts"), "utf8");
  const usersPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/page.tsx"), "utf8");
  const detailPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/[userId]/page.tsx"), "utf8");

  assert.match(service, /UserRepository/);
  assert.match(service, /RolePermissionRepository/);
  assert.match(service, /validateRoleChangeRequest/);
  assert.doesNotMatch(usersPage, /roleManagementUserRepository|roleManagementRoleRepository/);
  assert.doesNotMatch(detailPage, /roleManagementUserRepository|roleManagementRoleRepository/);
});
