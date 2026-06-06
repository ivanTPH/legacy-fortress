import type { PlatformAuditEvent } from "../audit/auditEvents.ts";
import type { PlatformRole } from "../auth/platformRoles.ts";
import {
  ACCOUNT_ROLE_LABELS,
  PERMISSION_LABELS,
  PLATFORM_ROLE_LABELS,
  type AccountRole,
  type PermissionDecision,
  type PermissionKey,
  type PlatformAdminRole,
  type RoleWorkflowActionType,
  type RoleWorkflowProposal,
  type RoleWorkflowState,
} from "../governance/rolePermissions.ts";
import type { ApiRequestContext } from "./domainEntities.ts";

export type RolePermissionApiContractId =
  | "roles.individuals.list"
  | "roles.individuals.detail"
  | "roles.templates.list"
  | "roles.change.propose"
  | "roles.change.validate"
  | "roles.change.submit"
  | "roles.user.suspend"
  | "roles.account.restrict"
  | "roles.audit.emit"
  | "roles.audit.list"
  | "roles.workspaces.list";

export type RolePermissionApiContract = {
  id: RolePermissionApiContractId;
  route: string;
  method: "GET" | "POST";
  requestDto: string;
  responseDto: string;
  requiredCapabilities: PermissionKey[];
  auditRequired: boolean;
  futurePersistence: keyof typeof ROLE_PERMISSION_PERSISTENCE_MAPPING;
};

export type RoleActorContextDto = {
  actor_id: string;
  actor_role: AccountRole | PlatformAdminRole | PlatformRole | null;
  actor_permissions: PermissionKey[];
  trusted_role_claims: boolean;
  source: "prototype" | "trusted_auth" | "system";
};

export type RoleTargetContextDto = {
  target_user_id: string;
  target_account_id: string | null;
  target_layer: "account" | "platform";
};

export type DangerousActionConfirmationDto = {
  confirmation_required: boolean;
  confirmed: boolean;
  confirmation_note?: string | null;
};

export type RoleChangeRequestDto = {
  request_id: string;
  action_type: RoleWorkflowActionType;
  actor: RoleActorContextDto;
  target: RoleTargetContextDto;
  previous_value: string | PermissionKey[];
  proposed_value: string | PermissionKey[];
  requested_permissions: PermissionKey[];
  requested_platform_role?: PlatformAdminRole | null;
  dangerous_action?: "delete_user" | "suspend_user" | null;
  confirmation?: DangerousActionConfirmationDto;
  reason: string;
};

export type RoleChangeResponseDto = {
  proposal_id: string;
  workflow_state: RoleWorkflowState;
  decision: PermissionDecision;
  audit_event_id: string;
  mock_applied: boolean;
};

export type RegisteredIndividualListRequestDto = {
  account_id?: string | null;
  include_platform_admins?: boolean;
};

export type RegisteredIndividualDetailRequestDto = {
  user_id: string;
};

export type AuditEventListRequestDto = {
  user_id?: string | null;
  account_id?: string | null;
  limit?: number;
};

export type WorkspaceContextListRequestDto = {
  roles: PlatformRole[];
  trusted_role_claims: boolean;
};

export type RoleApiResult<T> =
  | {
      ok: true;
      data: T;
      reason: string;
      policyDecision: "allowed";
      workflowState?: RoleWorkflowState;
      auditEventId?: string;
    }
  | {
      ok: false;
      error: {
        code: "invalid_payload" | "permission_denied" | "confirmation_required" | "not_found" | "prototype_only";
        message: string;
      };
      reason: string;
      policyDecision: "blocked" | "rejected";
      workflowState?: RoleWorkflowState;
      auditEventId?: string;
    };

export type RegisteredIndividualContract = {
  id: string;
  full_name: string;
  email: string;
  account_role: AccountRole | null;
  platform_role: PlatformAdminRole | null;
  permissions: PermissionKey[];
  workflow_state: RoleWorkflowState;
  access_status: string;
};

export type UserRepository = {
  listRegisteredIndividuals(input: RegisteredIndividualListRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RegisteredIndividualContract[]>>;
  getRegisteredIndividual(input: RegisteredIndividualDetailRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RegisteredIndividualContract>>;
};

export type RolePermissionRepository = {
  listRoleTemplates(context: ApiRequestContext): Promise<RoleApiResult<{ account: Record<AccountRole, PermissionKey[]>; platform: Record<PlatformAdminRole, PermissionKey[]> }>>;
  proposeRoleChange(input: RoleChangeRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RoleWorkflowProposal>>;
  validatePermissionChange(input: RoleChangeRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RoleChangeResponseDto>>;
  submitPermissionChange(input: RoleChangeRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RoleChangeResponseDto>>;
  suspendUser(input: RoleChangeRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RoleChangeResponseDto>>;
  restrictAccountAccess(input: RoleChangeRequestDto, context: ApiRequestContext): Promise<RoleApiResult<RoleChangeResponseDto>>;
};

export type AuditEventRepository = {
  emitAuditEvent(event: PlatformAuditEvent, context: ApiRequestContext): Promise<RoleApiResult<{ stored: boolean; event_id: string }>>;
  listAuditEvents(input: AuditEventListRequestDto, context: ApiRequestContext): Promise<RoleApiResult<PlatformAuditEvent[]>>;
};

export type WorkspaceContextRepository = {
  listAvailableWorkspaceContexts(input: WorkspaceContextListRequestDto, context: ApiRequestContext): Promise<RoleApiResult<Array<{ id: string; href: string; enabled: boolean }>>>;
};

export const ROLE_PERMISSION_API_CONTRACTS: RolePermissionApiContract[] = [
  contract("roles.individuals.list", "/api/internal/roles/individuals", "GET", "RegisteredIndividualListRequestDto", "RegisteredIndividualContract[]", ["view_account"], "users"),
  contract("roles.individuals.detail", "/api/internal/roles/individuals/:userId", "GET", "RegisteredIndividualDetailRequestDto", "RegisteredIndividualContract", ["view_account"], "users"),
  contract("roles.templates.list", "/api/internal/roles/templates", "GET", "ApiRequestContext", "RolePermissionTemplates", ["view_audit_logs"], "permissions"),
  contract("roles.change.propose", "/api/internal/roles/changes/propose", "POST", "RoleChangeRequestDto", "RoleWorkflowProposal", ["assign_account_roles"], "role_assignments"),
  contract("roles.change.validate", "/api/internal/roles/changes/validate", "POST", "RoleChangeRequestDto", "RoleChangeResponseDto", ["assign_account_roles"], "role_assignments"),
  contract("roles.change.submit", "/api/internal/roles/changes/submit", "POST", "RoleChangeRequestDto", "RoleChangeResponseDto", ["assign_account_roles"], "role_assignments"),
  contract("roles.user.suspend", "/api/internal/roles/users/suspend", "POST", "RoleChangeRequestDto", "RoleChangeResponseDto", ["suspend_users"], "role_assignments"),
  contract("roles.account.restrict", "/api/internal/roles/accounts/restrict", "POST", "RoleChangeRequestDto", "RoleChangeResponseDto", ["assign_account_roles"], "account_memberships"),
  contract("roles.audit.emit", "/api/internal/roles/audit", "POST", "PlatformAuditEvent", "AuditWriteResult", ["view_audit_logs"], "audit_events"),
  contract("roles.audit.list", "/api/internal/roles/audit", "GET", "AuditEventListRequestDto", "PlatformAuditEvent[]", ["view_audit_logs"], "audit_events"),
  contract("roles.workspaces.list", "/api/internal/roles/workspaces", "GET", "WorkspaceContextListRequestDto", "WorkspaceRoute[]", ["view_account"], "workspace_contexts"),
];

export const ROLE_PERMISSION_PERSISTENCE_MAPPING = {
  users: "users",
  accounts: "accounts_vaults",
  account_memberships: "account_memberships",
  platform_roles: "platform_roles",
  account_roles: "account_roles",
  permissions: "permissions",
  role_assignments: "role_assignments",
  audit_events: "audit_events",
  workspace_contexts: "workspace_contexts",
} as const;

export const rolePermissionContractReadiness = {
  currentAdapter: "mock_repository_adapter",
  futureAdapter: "database_backed_role_permission_api",
  rule: "UI pages must call service functions; services validate DTOs before repository actions and emit audit-compatible results.",
  noLivePersistenceYet: true,
} as const;

export function validateRoleIdentifier(value: unknown): value is AccountRole | PlatformAdminRole {
  return typeof value === "string" && (value in ACCOUNT_ROLE_LABELS || value in PLATFORM_ROLE_LABELS);
}

export function validatePermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && value in PERMISSION_LABELS;
}

export function validateWorkflowState(value: unknown): value is RoleWorkflowState {
  return typeof value === "string" && [
    "draft_change",
    "pending_confirmation",
    "submitted",
    "approved_applied",
    "blocked",
    "failed",
    "reverted",
  ].includes(value);
}

export function validateActorContext(value: unknown): value is RoleActorContextDto {
  const input = value as Partial<RoleActorContextDto>;
  return Boolean(
    input
      && typeof input.actor_id === "string"
      && (input.actor_role === null || validateRoleIdentifier(input.actor_role))
      && Array.isArray(input.actor_permissions)
      && input.actor_permissions.every(validatePermissionKey)
      && typeof input.trusted_role_claims === "boolean"
      && (input.source === "prototype" || input.source === "trusted_auth" || input.source === "system"),
  );
}

export function validateTargetContext(value: unknown): value is RoleTargetContextDto {
  const input = value as Partial<RoleTargetContextDto>;
  return Boolean(
    input
      && typeof input.target_user_id === "string"
      && (input.target_account_id === null || typeof input.target_account_id === "string")
      && (input.target_layer === "account" || input.target_layer === "platform"),
  );
}

export function validateDangerousConfirmation(value: unknown): value is DangerousActionConfirmationDto {
  const input = value as Partial<DangerousActionConfirmationDto>;
  return Boolean(
    input
      && typeof input.confirmation_required === "boolean"
      && typeof input.confirmed === "boolean"
      && (input.confirmation_note === undefined || input.confirmation_note === null || typeof input.confirmation_note === "string"),
  );
}

export function validateRoleChangeRequest(value: unknown): value is RoleChangeRequestDto {
  const input = value as Partial<RoleChangeRequestDto>;
  return Boolean(
    input
      && typeof input.request_id === "string"
      && typeof input.action_type === "string"
      && validateActorContext(input.actor)
      && validateTargetContext(input.target)
      && Array.isArray(input.requested_permissions)
      && input.requested_permissions.every(validatePermissionKey)
      && (input.requested_platform_role === undefined || input.requested_platform_role === null || validateRoleIdentifier(input.requested_platform_role))
      && (input.confirmation === undefined || validateDangerousConfirmation(input.confirmation))
      && typeof input.reason === "string"
      && input.reason.length > 0,
  );
}

export function validateAuditEventPayload(value: unknown): value is PlatformAuditEvent {
  const input = value as Partial<PlatformAuditEvent>;
  return Boolean(
    input
      && typeof input.id === "string"
      && typeof input.timestamp === "string"
      && typeof input.action === "string"
      && input.actor
      && input.resource
      && input.context,
  );
}

export function roleApiOk<T>(data: T, extras: { reason?: string; workflowState?: RoleWorkflowState; auditEventId?: string } = {}): RoleApiResult<T> {
  return {
    ok: true,
    data,
    reason: extras.reason ?? "allowed",
    policyDecision: "allowed",
    workflowState: extras.workflowState,
    auditEventId: extras.auditEventId,
  };
}

export function roleApiError<T = never>(
  code: "invalid_payload" | "permission_denied" | "confirmation_required" | "not_found" | "prototype_only",
  message: string,
  extras: { reason?: string; workflowState?: RoleWorkflowState; auditEventId?: string; policyDecision?: "blocked" | "rejected" } = {},
): RoleApiResult<T> {
  return {
    ok: false,
    error: { code, message },
    reason: extras.reason ?? message,
    policyDecision: extras.policyDecision ?? "blocked",
    workflowState: extras.workflowState,
    auditEventId: extras.auditEventId,
  };
}

export function getRolePermissionApiContract(id: RolePermissionApiContractId) {
  return ROLE_PERMISSION_API_CONTRACTS.find((item) => item.id === id) ?? null;
}

function contract(
  id: RolePermissionApiContractId,
  route: string,
  method: RolePermissionApiContract["method"],
  requestDto: string,
  responseDto: string,
  requiredCapabilities: PermissionKey[],
  futurePersistence: keyof typeof ROLE_PERMISSION_PERSISTENCE_MAPPING,
): RolePermissionApiContract {
  return {
    id,
    route,
    method,
    requestDto,
    responseDto,
    requiredCapabilities,
    auditRequired: true,
    futurePersistence,
  };
}
