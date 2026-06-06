import {
  createPrototypeAuditEvent,
  type PlatformAuditEvent,
} from "../audit/auditEvents.ts";

export type AccountRole =
  | "account_owner"
  | "executor"
  | "ifa"
  | "solicitor"
  | "family_viewer"
  | "trusted_contact"
  | "account_sub_admin";

export type PlatformAdminRole =
  | "platform_owner"
  | "super_admin"
  | "admin"
  | "support_admin"
  | "compliance_auditor"
  | "readonly_auditor";

export type PermissionKey =
  | "view_account"
  | "edit_account_details"
  | "add_contacts"
  | "delete_contacts"
  | "assign_account_roles"
  | "upload_documents"
  | "download_documents"
  | "run_reports"
  | "export_data"
  | "approve_executor_access"
  | "edit_billing_licensing"
  | "view_audit_logs"
  | "manage_organisations"
  | "manage_platform_admins"
  | "suspend_users"
  | "delete_users";

export type PermissionDecision = {
  allowed: boolean;
  reason: string;
  restricted: boolean;
  confirmationRequired?: boolean;
  blockedStatus?: "insufficient_permissions" | "platform_role_restricted" | "prototype_soft_delete_only" | "confirmation_required";
};

export type RoleWorkflowState =
  | "draft_change"
  | "pending_confirmation"
  | "submitted"
  | "approved_applied"
  | "blocked"
  | "failed"
  | "reverted";

export type RoleWorkflowActionType =
  | "role_assignment"
  | "permission_toggle"
  | "sub_user_suspension"
  | "admin_suspension"
  | "account_access_restriction"
  | "soft_delete_request";

export type RoleWorkflowProposal = {
  proposalId: string;
  actionType: RoleWorkflowActionType;
  workflowState: RoleWorkflowState;
  actor: {
    id: string;
    role: AccountRole | PlatformAdminRole | null;
    permissions: PermissionKey[];
  };
  target: {
    userId: string;
    accountId: string | null;
    layer: "account" | "platform";
  };
  previousValue: string | PermissionKey[];
  proposedValue: string | PermissionKey[];
  requestedPermissions: PermissionKey[];
  requestedPlatformRole?: PlatformAdminRole | null;
  dangerousAction?: "delete_user" | "suspend_user" | null;
  confirmationProvided?: boolean;
  reason: string;
};

export type PermissionChangeAuditInput = {
  id: string;
  actor: { id: string; displayName: string; role: string | null };
  targetUser: { id: string; displayName: string };
  affectedAccount: { id: string | null; label: string | null };
  previousRoles: string[];
  newRoles: string[];
  previousPermissions: PermissionKey[];
  newPermissions: PermissionKey[];
  reason: string;
  decision: PermissionDecision;
  actionType?: RoleWorkflowActionType;
  workflowState?: RoleWorkflowState;
  previousValue?: string | PermissionKey[];
  proposedValue?: string | PermissionKey[];
  timestamp?: string;
};

export type RolePermissionAuditEvent = PlatformAuditEvent & {
  workflow: {
    event_id: string;
    actor_id: string;
    actor_role: string | null;
    target_user_id: string;
    target_account_id: string | null;
    action_type: RoleWorkflowActionType;
    previous_value: string | PermissionKey[];
    proposed_value: string | PermissionKey[];
    decision: "allowed" | "blocked";
    reason: string;
    timestamp: string;
    workflow_state: RoleWorkflowState;
    restricted_flag: boolean;
    source_module: "role_permission_management";
  };
  permissionChange: {
    targetUser: { id: string; displayName: string };
    affectedAccount: { id: string | null; label: string | null };
    previousRoles: string[];
    newRoles: string[];
    previousPermissions: PermissionKey[];
    newPermissions: PermissionKey[];
    reason: string;
    decision: PermissionDecision;
  };
};

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  account_owner: "Account owner",
  executor: "Executor",
  ifa: "IFA",
  solicitor: "Solicitor",
  family_viewer: "Family Viewer",
  trusted_contact: "Trusted Contact",
  account_sub_admin: "Account Sub-Admin",
};

export const PLATFORM_ROLE_LABELS: Record<PlatformAdminRole, string> = {
  platform_owner: "Platform Owner",
  super_admin: "Super Admin",
  admin: "Admin",
  support_admin: "Support Admin",
  compliance_auditor: "Compliance Auditor",
  readonly_auditor: "Read-only Auditor",
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_account: "View account",
  edit_account_details: "Edit account details",
  add_contacts: "Add contacts",
  delete_contacts: "Delete contacts",
  assign_account_roles: "Assign account roles",
  upload_documents: "Upload documents",
  download_documents: "Download documents",
  run_reports: "Run reports",
  export_data: "Export data",
  approve_executor_access: "Approve executor access",
  edit_billing_licensing: "Edit billing/licensing",
  view_audit_logs: "View audit logs",
  manage_organisations: "Manage organisations",
  manage_platform_admins: "Manage platform admins",
  suspend_users: "Suspend users",
  delete_users: "Delete users",
};

export const ACCOUNT_ROLE_PERMISSION_TEMPLATES: Record<AccountRole, PermissionKey[]> = {
  account_owner: [
    "view_account",
    "edit_account_details",
    "add_contacts",
    "delete_contacts",
    "assign_account_roles",
    "upload_documents",
    "download_documents",
    "view_audit_logs",
    "suspend_users",
  ],
  executor: ["view_account", "download_documents", "approve_executor_access"],
  ifa: ["view_account", "run_reports"],
  solicitor: ["view_account", "download_documents", "approve_executor_access"],
  family_viewer: ["view_account"],
  trusted_contact: ["view_account"],
  account_sub_admin: [
    "view_account",
    "edit_account_details",
    "add_contacts",
    "assign_account_roles",
    "upload_documents",
    "download_documents",
  ],
};

export const PLATFORM_ROLE_PERMISSION_TEMPLATES: Record<PlatformAdminRole, PermissionKey[]> = {
  platform_owner: [
    "view_account",
    "run_reports",
    "export_data",
    "approve_executor_access",
    "edit_billing_licensing",
    "view_audit_logs",
    "manage_organisations",
    "manage_platform_admins",
    "suspend_users",
    "delete_users",
  ],
  super_admin: [
    "view_account",
    "run_reports",
    "export_data",
    "approve_executor_access",
    "edit_billing_licensing",
    "view_audit_logs",
    "manage_organisations",
    "manage_platform_admins",
    "suspend_users",
    "delete_users",
  ],
  admin: [
    "view_account",
    "run_reports",
    "approve_executor_access",
    "view_audit_logs",
    "manage_organisations",
    "suspend_users",
  ],
  support_admin: ["view_account", "view_audit_logs", "suspend_users"],
  compliance_auditor: ["view_account", "run_reports", "view_audit_logs"],
  readonly_auditor: ["view_account", "view_audit_logs"],
};

export const ROLE_PERMISSION_MANAGEMENT_READINESS = {
  currentAdapter: "prototype_static_role_service",
  futureAdapter: "production_auth_claims_and_role_repository",
  rule: "Account owners manage their own account-level invites and vault delegation; platform and enterprise roles manage application, licensor, reporting, audit, and death-certificate access workflows only.",
  softDeleteRule: "Prototype user deletion is represented as suspend access only until production identity lifecycle controls exist.",
} as const;

export function getAccountRoleLabel(role: AccountRole | null | undefined) {
  return role ? ACCOUNT_ROLE_LABELS[role] : "None";
}

export function getPlatformRoleLabel(role: PlatformAdminRole | null | undefined) {
  return role ? PLATFORM_ROLE_LABELS[role] : "None";
}

export function getPermissionLabel(permission: PermissionKey) {
  return PERMISSION_LABELS[permission];
}

export function getRoleTemplatePermissions(role: AccountRole | PlatformAdminRole | null | undefined) {
  if (!role) return [];
  if (role in ACCOUNT_ROLE_PERMISSION_TEMPLATES) {
    return ACCOUNT_ROLE_PERMISSION_TEMPLATES[role as AccountRole];
  }
  return PLATFORM_ROLE_PERMISSION_TEMPLATES[role as PlatformAdminRole] ?? [];
}

export function canAssignAccountRole(actor: {
  accountRole?: AccountRole | null;
  platformRole?: PlatformAdminRole | null;
  permissions: PermissionKey[];
}) {
  return Boolean(
    actor.accountRole === "account_owner"
      || actor.platformRole === "platform_owner"
      || actor.platformRole === "super_admin"
      || actor.permissions.includes("assign_account_roles"),
  );
}

export function canAssignPlatformRole(actor: {
  platformRole?: PlatformAdminRole | null;
  permissions: PermissionKey[];
}) {
  return Boolean(
    (actor.platformRole === "platform_owner" || actor.platformRole === "super_admin")
      && actor.permissions.includes("manage_platform_admins"),
  );
}

export function canGrantPermission(actorPermissions: PermissionKey[], permission: PermissionKey) {
  return actorPermissions.includes(permission);
}

export function evaluatePermissionChange(input: {
  actorAccountRole?: AccountRole | null;
  actorPlatformRole?: PlatformAdminRole | null;
  actorPermissions: PermissionKey[];
  targetLayer: "account" | "platform";
  requestedPermissions: PermissionKey[];
  requestedPlatformRole?: PlatformAdminRole | null;
  dangerousAction?: "delete_user" | "suspend_user" | null;
  confirmationProvided?: boolean;
}): PermissionDecision {
  if (input.dangerousAction === "delete_user") {
    return {
      allowed: false,
      restricted: true,
      blockedStatus: "prototype_soft_delete_only",
      reason: "Deleting users is disabled in the prototype. Use suspend access as the soft-delete path.",
    };
  }

  if (input.dangerousAction === "suspend_user" && !input.confirmationProvided) {
    return {
      allowed: false,
      restricted: true,
      confirmationRequired: true,
      blockedStatus: "confirmation_required",
      reason: "Suspending access requires explicit confirmation before the workflow can be submitted.",
    };
  }

  if (input.targetLayer === "platform" && !canAssignPlatformRole({
    platformRole: input.actorPlatformRole,
    permissions: input.actorPermissions,
  })) {
    return {
      allowed: false,
      restricted: true,
      blockedStatus: "platform_role_restricted",
      reason: "Only Platform Owner or Super Admin users with manage platform admins permission can change platform roles.",
    };
  }

  if (input.targetLayer === "account" && !canAssignAccountRole({
    accountRole: input.actorAccountRole,
    platformRole: input.actorPlatformRole,
    permissions: input.actorPermissions,
  })) {
    return {
      allowed: false,
      restricted: true,
      blockedStatus: "insufficient_permissions",
      reason: "Actor does not have assign account roles permission for this account.",
    };
  }

  const missingGrant = input.requestedPermissions.find((permission) => !canGrantPermission(input.actorPermissions, permission));
  if (missingGrant && input.actorPlatformRole !== "platform_owner" && input.actorPlatformRole !== "super_admin") {
    return {
      allowed: false,
      restricted: true,
      blockedStatus: "insufficient_permissions",
      reason: `Actor cannot grant ${getPermissionLabel(missingGrant)} because they do not already hold it.`,
    };
  }

  return {
    allowed: true,
    restricted: false,
    reason: "Permission change allowed by current prototype governance rules.",
  };
}

export function buildPermissionChangeAuditEvent(input: PermissionChangeAuditInput): RolePermissionAuditEvent {
  const workflowState = input.workflowState ?? (input.decision.allowed ? "submitted" : "blocked");
  const actionType = input.actionType ?? "role_assignment";
  const timestamp = input.timestamp ?? "Static preview timestamp";
  const event = createPrototypeAuditEvent({
    id: input.id,
    category: "admin_review",
    timestamp,
    actor: {
      id: input.actor.id,
      type: "admin",
      displayName: input.actor.displayName,
      role: input.actor.role,
    },
    action: "Role or permission change previewed",
    result: input.decision.allowed ? "preview_only" : "blocked",
    policyDecision: input.decision.allowed ? "allowed" : "blocked",
    resource: {
      type: "contact",
      id: input.targetUser.id,
      label: input.targetUser.displayName,
    },
    context: {
      surface: "role_permission_management",
      route: "/internal/admin/prototype/users",
    },
    governance: {
      policyDecision: input.decision.allowed ? "allowed" : "blocked",
      restrictedReason: input.decision.restricted ? input.decision.reason : undefined,
      exportEnabled: false,
    },
  });

  return {
    ...event,
    permissionChange: {
      targetUser: input.targetUser,
      affectedAccount: input.affectedAccount,
      previousRoles: input.previousRoles,
      newRoles: input.newRoles,
      previousPermissions: input.previousPermissions,
      newPermissions: input.newPermissions,
      reason: input.reason,
      decision: input.decision,
    },
    workflow: {
      event_id: input.id,
      actor_id: input.actor.id,
      actor_role: input.actor.role,
      target_user_id: input.targetUser.id,
      target_account_id: input.affectedAccount.id,
      action_type: actionType,
      previous_value: input.previousValue ?? input.previousPermissions,
      proposed_value: input.proposedValue ?? input.newPermissions,
      decision: input.decision.allowed ? "allowed" : "blocked",
      reason: input.reason,
      timestamp,
      workflow_state: workflowState,
      restricted_flag: input.decision.restricted,
      source_module: "role_permission_management",
    },
  };
}

export function getWorkflowStateForDecision(decision: PermissionDecision, confirmed = false): RoleWorkflowState {
  if (decision.blockedStatus === "confirmation_required") return "pending_confirmation";
  if (decision.restricted) return "blocked";
  return confirmed ? "approved_applied" : "submitted";
}

export function evaluateRoleWorkflowProposal(proposal: RoleWorkflowProposal): {
  proposal: RoleWorkflowProposal;
  decision: PermissionDecision;
  workflowState: RoleWorkflowState;
} {
  const decision = evaluatePermissionChange({
    actorAccountRole: isAccountRole(proposal.actor.role) ? proposal.actor.role : null,
    actorPlatformRole: isPlatformRole(proposal.actor.role) ? proposal.actor.role : null,
    actorPermissions: proposal.actor.permissions,
    targetLayer: proposal.target.layer,
    requestedPermissions: proposal.requestedPermissions,
    requestedPlatformRole: proposal.requestedPlatformRole,
    dangerousAction: proposal.dangerousAction,
    confirmationProvided: proposal.confirmationProvided,
  });

  return {
    proposal,
    decision,
    workflowState: getWorkflowStateForDecision(decision, proposal.confirmationProvided),
  };
}

function isAccountRole(role: AccountRole | PlatformAdminRole | null): role is AccountRole {
  return Boolean(role && role in ACCOUNT_ROLE_PERMISSION_TEMPLATES);
}

function isPlatformRole(role: AccountRole | PlatformAdminRole | null): role is PlatformAdminRole {
  return Boolean(role && role in PLATFORM_ROLE_PERMISSION_TEMPLATES);
}
