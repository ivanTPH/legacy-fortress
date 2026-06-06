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
import {
  getRoleManagementData,
  getRoleManagementDetail,
  rolePermissionRepository,
  roleManagementServiceBoundary,
} from "../components/admin/prototype/roleManagementService.ts";

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

test("role management service exposes registered individuals and persistence-ready workflow previews", () => {
  assert.equal(roleManagementServiceBoundary.futureAdapter, "people_role_repository_with_audit_event_pipeline");
  assert.ok(roleManagementServiceBoundary.repositoryShape.includes("proposeRoleChange"));
  assert.ok(roleManagementServiceBoundary.repositoryShape.includes("emitRoleAuditEvent"));

  const data = getRoleManagementData();
  assert.ok(data.registeredIndividuals.length >= 6);
  assert.ok(data.summary.accountOwners >= 3);
  assert.ok(data.summary.platformAdmins >= 2);
  assert.ok(data.registeredIndividuals.some((person) => person.childSubUsers.length > 0));
  assert.ok(data.registeredIndividuals.some((person) => person.platformRole === "super_admin"));
  assert.ok(data.permissionAuditTimeline.some((event) => event.permissionChange.decision.restricted));
  assert.ok(data.permissionAuditTimeline.every((event) => event.workflow.source_module === "role_permission_management"));
  assert.ok(data.workflowProposals.some((proposal) => proposal.workflowState === "pending_confirmation"));
  assert.ok(data.workflowProposals.some((proposal) => proposal.actionType === "soft_delete_request"));
  assert.ok(Object.values(data.actionStatesByUserId).flat().some((action) => action.confirmationRequired));

  const detail = getRoleManagementDetail(data.registeredIndividuals[0].id);
  assert.equal(detail.individual?.id, data.registeredIndividuals[0].id);
  assert.equal(detail.deleteDecision.allowed, false);
  assert.ok(detail.actionStates.some((action) => action.workflowState === "pending_confirmation" || action.workflowState === "blocked"));
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

test("repository boundary validates, applies mock changes, and keeps blocked attempts auditable", () => {
  const proposal = {
    proposalId: "wf-test",
    actionType: "admin_suspension",
    workflowState: "pending_confirmation",
    actor: {
      id: "support-1",
      role: "support_admin",
      permissions: PLATFORM_ROLE_PERMISSION_TEMPLATES.support_admin,
    },
    target: {
      userId: "admin-2",
      accountId: "PLATFORM",
      layer: "platform",
    },
    previousValue: "Active",
    proposedValue: "Suspended",
    requestedPermissions: ["suspend_users"],
    dangerousAction: "suspend_user",
    confirmationProvided: false,
    reason: "Regression suspension workflow",
  };

  const evaluated = evaluateRoleWorkflowProposal(proposal);
  assert.equal(evaluated.workflowState, "pending_confirmation");
  assert.equal(evaluated.decision.confirmationRequired, true);

  const applied = rolePermissionRepository.applyMockRoleChange({ ...proposal, confirmationProvided: true });
  assert.equal(applied.persisted, false);
  assert.equal(applied.mockApplied, false);
  assert.equal(applied.decision.allowed, false);
});

test("admin users pages use central role service and do not define page-level permission logic", () => {
  const usersPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/page.tsx"), "utf8");
  const detailPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/[userId]/page.tsx"), "utf8");
  const assignmentConsole = fs.readFileSync(path.join(root, "components/admin/prototype/RoleAssignmentConsole.tsx"), "utf8");

  assert.match(usersPage, /getRoleManagementData/);
  assert.match(usersPage, /Registered individuals/);
  assert.match(usersPage, /RoleAssignmentConsole/);
  assert.match(assignmentConsole, /Registered account access console/);
  assert.match(assignmentConsole, /Registered account holders and users/);
  assert.match(assignmentConsole, /Permission boundary/);
  assert.match(assignmentConsole, /Personal vault roles are normally invited and assigned by the vault owner/);
  assert.match(assignmentConsole, /Open/);
  assert.match(assignmentConsole, /ACCOUNT_ROLE_LABELS/);
  assert.match(assignmentConsole, /PLATFORM_ROLE_LABELS/);
  assert.match(assignmentConsole, /permissionGroups/);
  assert.match(assignmentConsole, /evaluatePermissionChange/);
  assert.match(assignmentConsole, /Apply selected mock changes/);
  assert.match(assignmentConsole, /queued for owner approval and audit review/);
  assert.match(detailPage, /getRoleManagementDetail/);
  assert.match(detailPage, /Permission toggle matrix/);
  assert.match(detailPage, /RoleAssignmentConsole/);
  assert.match(detailPage, /Account-vault permissions belong to the account owner invitation flow/);
  assert.match(detailPage, /Child \/ sub-user relationships/);
  assert.match(detailPage, /Permission change audit timeline/);
  assert.match(detailPage, /Permission action states/);
  assert.match(usersPage, /Last permission update/);
  assert.match(usersPage, /Last audit event/);
  assert.doesNotMatch(usersPage, /ACCOUNT_ROLE_PERMISSION_TEMPLATES/);
  assert.doesNotMatch(detailPage, /ACCOUNT_ROLE_PERMISSION_TEMPLATES/);
});

test("users and permissions area is discoverable from admin navigation and enterprise dashboard", () => {
  const shell = fs.readFileSync(path.join(root, "components/admin/prototype/AdminPrototypeShell.tsx"), "utf8");
  const enterprisePage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/enterprise/page.tsx"), "utf8");
  const usersPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/page.tsx"), "utf8");
  const detailPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/[userId]/page.tsx"), "utf8");

  assert.match(shell, /Users & Permissions/);
  assert.match(shell, /canViewUsersAndPermissions/);
  assert.match(shell, /requiresUsersAndPermissions/);
  assert.match(shell, /buildPrototypePreviewHref\(href, role\)/);
  assert.match(enterprisePage, /Manage registered individuals/);
  assert.match(enterprisePage, /Review roles & permissions/);
  assert.match(enterprisePage, /Grant or revoke admin rights/);
  assert.match(enterprisePage, /Select registered account holders/);
  assert.match(enterprisePage, /toggle tailored permissions/);
  assert.match(enterprisePage, /buildPrototypePreviewHref\("\/internal\/admin\/prototype\/users", currentRole\)/);
  assert.match(usersPage, /Back to Enterprise Dashboard/);
  assert.match(usersPage, /platform roles and account-level roles are managed here/i);
  assert.match(usersPage, /Super Admins can grant or revoke admin rights/);
  assert.match(usersPage, /account owners can manage sub-users only within their own account/i);
  assert.match(detailPage, /Assign account role/);
  assert.match(detailPage, /Edit permission toggles/);
  assert.match(detailPage, /Manage admin rights/);
  assert.match(detailPage, /Suspend access/);
  assert.match(detailPage, /View audit trail/);
  assert.match(detailPage, /Back to Users & Permissions/);
  assert.match(detailPage, /buildPrototypePreviewHref\("\/internal\/admin\/prototype\/enterprise", currentRole\)/);
});
