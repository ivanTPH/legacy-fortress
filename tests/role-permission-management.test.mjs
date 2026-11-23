import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ACCOUNT_ROLE_PERMISSION_TEMPLATES,
  PLATFORM_ROLE_PERMISSION_TEMPLATES,
  ROLE_PERMISSION_MANAGEMENT_READINESS,
  buildPermissionChangeAuditEvent,
  canAssignAccountRole,
  canAssignPlatformRole,
  evaluatePermissionChange,
  evaluateRoleWorkflowProposal,
} from "../lib/governance/rolePermissions.ts";

const root = process.cwd();

test("role hierarchy separates account-level and platform-level permissions", () => {
  assert.ok(ACCOUNT_ROLE_PERMISSION_TEMPLATES.executor.includes("approve_executor_access"));
  assert.ok(ACCOUNT_ROLE_PERMISSION_TEMPLATES.account_sub_admin.includes("assign_account_roles"));
  assert.ok(!ACCOUNT_ROLE_PERMISSION_TEMPLATES.account_owner.includes("manage_platform_admins"));

  assert.ok(PLATFORM_ROLE_PERMISSION_TEMPLATES.super_admin.includes("manage_platform_admins"));
  assert.ok(PLATFORM_ROLE_PERMISSION_TEMPLATES.super_admin.includes("approve_executor_access"));
  assert.ok(!PLATFORM_ROLE_PERMISSION_TEMPLATES.super_admin.includes("edit_account_details"));
  assert.ok(!PLATFORM_ROLE_PERMISSION_TEMPLATES.super_admin.includes("add_contacts"));
  assert.ok(!PLATFORM_ROLE_PERMISSION_TEMPLATES.admin.includes("assign_account_roles"));
  assert.ok(PLATFORM_ROLE_PERMISSION_TEMPLATES.admin.includes("manage_organisations"));
  assert.ok(!PLATFORM_ROLE_PERMISSION_TEMPLATES.readonly_auditor.includes("edit_account_details"));
  assert.match(ROLE_PERMISSION_MANAGEMENT_READINESS.rule, /Account owners manage their own account-level invites/);
  assert.match(ROLE_PERMISSION_MANAGEMENT_READINESS.rule, /death-certificate access workflows/);
});

test("permission decisions block unsafe role escalation and prototype deletes", () => {
  assert.equal(canAssignAccountRole({
    accountRole: "account_owner",
    platformRole: null,
    permissions: ACCOUNT_ROLE_PERMISSION_TEMPLATES.account_owner,
  }), true);

  assert.equal(canAssignPlatformRole({
    platformRole: null,
    permissions: ACCOUNT_ROLE_PERMISSION_TEMPLATES.account_owner,
  }), false);

  const platformEscalation = evaluatePermissionChange({
    actorAccountRole: "account_owner",
    actorPlatformRole: null,
    actorPermissions: ACCOUNT_ROLE_PERMISSION_TEMPLATES.account_owner,
    targetLayer: "platform",
    requestedPermissions: ["manage_platform_admins"],
    requestedPlatformRole: "admin",
  });
  assert.equal(platformEscalation.allowed, false);
  assert.equal(platformEscalation.blockedStatus, "platform_role_restricted");

  const deleteDecision = evaluatePermissionChange({
    actorAccountRole: null,
    actorPlatformRole: "super_admin",
    actorPermissions: PLATFORM_ROLE_PERMISSION_TEMPLATES.super_admin,
    targetLayer: "platform",
    requestedPermissions: ["delete_users"],
    dangerousAction: "delete_user",
  });
  assert.equal(deleteDecision.allowed, false);
  assert.equal(deleteDecision.blockedStatus, "prototype_soft_delete_only");
});

test("permission change audit event captures actor, target, account, previous/new permissions, and blocked state", () => {
  const blocked = evaluatePermissionChange({
    actorAccountRole: "account_owner",
    actorPlatformRole: null,
    actorPermissions: ACCOUNT_ROLE_PERMISSION_TEMPLATES.account_owner,
    targetLayer: "platform",
    requestedPermissions: ["manage_platform_admins"],
  });

  const event = buildPermissionChangeAuditEvent({
    id: "role-test",
    actor: { id: "actor-1", displayName: "Owner", role: "account_owner" },
    targetUser: { id: "target-1", displayName: "Target user" },
    affectedAccount: { id: "vault-1", label: "Vault one" },
    previousRoles: ["Trusted Contact"],
    newRoles: ["Admin"],
    previousPermissions: ["view_account"],
    newPermissions: ["manage_platform_admins"],
    reason: "Regression test",
    decision: blocked,
  });

  assert.equal(event.actor.id, "actor-1");
  assert.equal(event.permissionChange.targetUser.id, "target-1");
  assert.equal(event.permissionChange.affectedAccount.id, "vault-1");
  assert.deepEqual(event.permissionChange.previousPermissions, ["view_account"]);
  assert.deepEqual(event.permissionChange.newPermissions, ["manage_platform_admins"]);
  assert.equal(event.result, "blocked");
  assert.equal(event.governance?.exportEnabled, false);
  assert.equal(event.workflow.event_id, "role-test");
  assert.equal(event.workflow.actor_id, "actor-1");
  assert.equal(event.workflow.target_user_id, "target-1");
  assert.equal(event.workflow.target_account_id, "vault-1");
  assert.equal(event.workflow.workflow_state, "blocked");
  assert.equal(event.workflow.restricted_flag, true);
});

