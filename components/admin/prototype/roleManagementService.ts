import type { AdminUser } from "./mockData.ts";
import { adminUsers } from "./mockData.ts";
import {
  buildPermissionChangeAuditEvent,
  evaluatePermissionChange,
  evaluateRoleWorkflowProposal,
  getWorkflowStateForDecision,
  getRoleTemplatePermissions,
  type AccountRole,
  type PermissionKey,
  type PlatformAdminRole,
  type RolePermissionAuditEvent,
  type RoleWorkflowActionType,
  type RoleWorkflowProposal,
  type RoleWorkflowState,
} from "../../../lib/governance/rolePermissions.ts";
import type {
  PeopleConsentScope,
  PeopleGovernanceFlags,
  PeopleContactRelationshipType,
} from "../../../lib/contacts/contactRepository.ts";
import type { ApiRequestContext } from "../../../lib/backend/domainEntities.ts";
import {
  roleApiError,
  roleApiOk,
  validateRoleChangeRequest,
  type AuditEventRepository,
  type RegisteredIndividualContract,
  type RoleChangeRequestDto,
  type RolePermissionRepository,
  type UserRepository,
  type WorkspaceContextRepository,
} from "../../../lib/backend/rolePermissionContracts.ts";
import { getAvailableWorkspaces } from "../../../lib/workspaces.ts";

export type RegisteredIndividual = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  accountOwnerStatus: "Owner" | "Linked user" | "Sub-user" | "Platform admin" | "Organisation contact";
  linkedAccountVault: { id: string; label: string; ownerId: string | null };
  platformRole: PlatformAdminRole | null;
  accountRole: AccountRole | null;
  accountPermissions: PermissionKey[];
  platformPermissions: PermissionKey[];
  childSubUsers: Array<{ id: string; name: string; role: AccountRole; status: "Active" | "Suspended" | "Pending" }>;
  parentAccountOwnerId: string | null;
  verificationStatus: "Verified" | "Pending" | "Restricted" | "Not verified";
  inviteStatus: "none" | "sent" | "pending" | "accepted" | "failed";
  accessStatus: "Active" | "Pending" | "Suspended" | "Restricted";
  workflowStatus: RoleWorkflowState;
  lastPermissionUpdate: string;
  lastAuditEvent: string;
  lastActivity: string;
  relationship_type: PeopleContactRelationshipType;
  linked_context: Array<{ type: "account" | "organisation" | "probate_case" | "platform"; id: string; label: string }>;
  consent_scope: PeopleConsentScope;
  governance_flags: PeopleGovernanceFlags & {
    accountOwnerManaged: boolean;
    platformRoleRestricted: boolean;
    deleteDisabled: boolean;
  };
  source_type: "registered_user" | "account_invitation" | "organisation_user" | "probate_party" | "platform_admin";
};

export type RoleActionState = {
  id: string;
  label: string;
  actionType: RoleWorkflowActionType;
  workflowState: RoleWorkflowState;
  decision: ReturnType<typeof evaluatePermissionChange>;
  requiredPermission: PermissionKey;
  confirmationRequired: boolean;
};

export type RoleManagementData = {
  registeredIndividuals: RegisteredIndividual[];
  summary: {
    total: number;
    accountOwners: number;
    accountSubAdmins: number;
    platformAdmins: number;
    suspendedOrRestricted: number;
  };
  currentActor: RegisteredIndividual;
  permissionAuditTimeline: RolePermissionAuditEvent[];
  workflowProposals: RoleWorkflowProposal[];
  actionStatesByUserId: Record<string, RoleActionState[]>;
  safetyRules: string[];
};

export const roleManagementServiceBoundary = {
  currentAdapter: "static_registered_individuals",
  futureAdapter: "people_role_repository_with_audit_event_pipeline",
  canonicalModel: "PeopleContactEntity + role permission templates",
  rule: "Registered individuals, invitees, sub-admins, organisation users, and platform admins are shaped through this service boundary for the prototype UI.",
  repositoryShape: [
    "readRegisteredIndividuals",
    "readRoleTemplates",
    "proposeRoleChange",
    "validatePermissionChange",
    "applyMockRoleChange",
    "emitRoleAuditEvent",
  ],
  productionBlockers: [
    "trusted auth/session actor id",
    "persistent role assignment repository",
    "append-only permission audit store",
    "account-scoped access grants",
  ],
} as const;

const prototypeApiContext: ApiRequestContext = {
  requestId: "prototype-role-management",
  principal: null,
  route: "/internal/admin/prototype/users",
  environment: "test",
  governance: { prototypeOnly: true, exportEnabled: false },
};

const registeredIndividualsSeed: RegisteredIndividual[] = [
  fromAdminUser(adminUsers[0], {
    accountOwnerStatus: "Owner",
    accountRole: "account_owner",
    platformRole: null,
    verificationStatus: "Verified",
    inviteStatus: "accepted",
    accessStatus: "Active",
    childSubUsers: [
      { id: "SUB-552-1", name: "Thomas Ellis", role: "executor", status: "Active" },
      { id: "SUB-552-2", name: "Helen Murray", role: "account_sub_admin", status: "Pending" },
    ],
    relationshipType: "linked_user",
  }),
  fromAdminUser(adminUsers[1], {
    accountOwnerStatus: "Owner",
    accountRole: "account_owner",
    platformRole: null,
    verificationStatus: "Pending",
    inviteStatus: "accepted",
    accessStatus: "Pending",
    childSubUsers: [
      { id: "SUB-448-1", name: "Helen Haines", role: "executor", status: "Pending" },
    ],
    relationshipType: "linked_user",
  }),
  fromAdminUser(adminUsers[2], {
    accountOwnerStatus: "Owner",
    accountRole: "account_owner",
    platformRole: null,
    verificationStatus: "Verified",
    inviteStatus: "accepted",
    accessStatus: "Restricted",
    childSubUsers: [
      { id: "SUB-391-1", name: "Anika Shah", role: "trusted_contact", status: "Active" },
      { id: "SUB-391-2", name: "Kiran Shah", role: "family_viewer", status: "Suspended" },
    ],
    relationshipType: "linked_user",
  }),
  {
    id: "IND-ADM-001",
    full_name: "Sarah Ahmed",
    email: "sarah.ahmed@example.internal",
    phone: null,
    accountOwnerStatus: "Platform admin",
    linkedAccountVault: { id: "PLATFORM", label: "Platform administration", ownerId: null },
    platformRole: "super_admin",
    accountRole: null,
    accountPermissions: [],
    platformPermissions: getRoleTemplatePermissions("super_admin"),
    childSubUsers: [],
    parentAccountOwnerId: null,
    verificationStatus: "Verified",
    inviteStatus: "accepted",
    accessStatus: "Active",
    workflowStatus: "approved_applied",
    lastPermissionUpdate: "30 Apr 2026, 15:44",
    lastAuditEvent: "Platform admin template reviewed",
    lastActivity: "01 May 2026, 10:05",
    relationship_type: "support_contact",
    linked_context: [{ type: "platform", id: "PLATFORM", label: "Platform administration" }],
    consent_scope: consentScope(false),
    governance_flags: governanceFlags({ prototypeOnly: true, platformRoleRestricted: true }),
    source_type: "platform_admin",
  },
  {
    id: "IND-ADM-002",
    full_name: "Maya Lewis",
    email: "maya.lewis@example.internal",
    phone: null,
    accountOwnerStatus: "Platform admin",
    linkedAccountVault: { id: "PLATFORM", label: "Platform administration", ownerId: null },
    platformRole: "support_admin",
    accountRole: null,
    accountPermissions: [],
    platformPermissions: getRoleTemplatePermissions("support_admin"),
    childSubUsers: [],
    parentAccountOwnerId: null,
    verificationStatus: "Verified",
    inviteStatus: "accepted",
    accessStatus: "Active",
    workflowStatus: "pending_confirmation",
    lastPermissionUpdate: "Pending suspension confirmation",
    lastAuditEvent: "Admin suspension confirmation opened",
    lastActivity: "30 Apr 2026, 15:44",
    relationship_type: "support_contact",
    linked_context: [{ type: "platform", id: "PLATFORM", label: "Support administration" }],
    consent_scope: consentScope(false),
    governance_flags: governanceFlags({ prototypeOnly: true, platformRoleRestricted: true }),
    source_type: "platform_admin",
  },
  {
    id: "IND-ORG-1001",
    full_name: "Amelia Grant",
    email: "amelia.grant@northbridge.example",
    phone: null,
    accountOwnerStatus: "Organisation contact",
    linkedAccountVault: { id: "ORG-1001", label: "Northbridge Wealth LLP", ownerId: null },
    platformRole: null,
    accountRole: "ifa",
    accountPermissions: getRoleTemplatePermissions("ifa"),
    platformPermissions: [],
    childSubUsers: [],
    parentAccountOwnerId: null,
    verificationStatus: "Verified",
    inviteStatus: "accepted",
    accessStatus: "Active",
    workflowStatus: "approved_applied",
    lastPermissionUpdate: "01 May 2026, 09:15",
    lastAuditEvent: "Organisation role template reviewed",
    lastActivity: "01 May 2026, 09:15",
    relationship_type: "organisation_user",
    linked_context: [{ type: "organisation", id: "ORG-1001", label: "Northbridge Wealth LLP" }],
    consent_scope: consentScope(true),
    governance_flags: governanceFlags({ requiresConsentReview: true, prototypeOnly: true }),
    source_type: "organisation_user",
  },
];

export function getRoleManagementData(): RoleManagementData {
  const registeredIndividuals = roleManagementMockDataAdapter.readRegisteredIndividualsSync();
  const currentActor = registeredIndividuals.find((person) => person.platformRole === "super_admin") ?? registeredIndividuals[0];
  const workflowProposals = buildWorkflowProposals(registeredIndividuals, currentActor);
  const permissionAuditTimeline = buildPermissionAuditTimeline(registeredIndividuals, workflowProposals);
  const actionStatesByUserId = buildActionStatesByUserId(registeredIndividuals, currentActor);
  return {
    registeredIndividuals,
    currentActor,
    summary: {
      total: registeredIndividuals.length,
      accountOwners: registeredIndividuals.filter((person) => person.accountOwnerStatus === "Owner").length,
      accountSubAdmins: registeredIndividuals.filter((person) => person.accountRole === "account_sub_admin").length
        + registeredIndividuals.reduce((sum, person) => sum + person.childSubUsers.filter((child) => child.role === "account_sub_admin").length, 0),
      platformAdmins: registeredIndividuals.filter((person) => person.platformRole).length,
      suspendedOrRestricted: registeredIndividuals.filter((person) => person.accessStatus === "Suspended" || person.accessStatus === "Restricted").length,
    },
    permissionAuditTimeline,
    workflowProposals,
    actionStatesByUserId,
    safetyRules: [
      "Account owners invite people into their own vault and assign account-level roles for that vault only.",
      "Platform and enterprise admins manage application, licensor, reporting, audit, and death-certificate access workflows only.",
      "Only Platform Owner or Super Admin can manage platform admin roles.",
      "Admins cannot grant permissions they do not already hold.",
      "Vault access for probate is unlocked only after death-certificate submission, validation, confirmation, and audit capture.",
      "Delete user remains disabled; prototype uses suspend access as a soft-delete state.",
    ],
  };
}

export function findRegisteredIndividual(individualId: string) {
  return getRoleManagementData().registeredIndividuals.find((person) => person.id === individualId) ?? null;
}

export function getRoleManagementDetail(individualId: string) {
  const data = getRoleManagementData();
  const individual = data.registeredIndividuals.find((person) => person.id === individualId) ?? null;
  return {
    ...data,
    individual,
    accountRoleDecision: individual
      ? evaluatePermissionChange({
          actorAccountRole: data.currentActor.accountRole,
          actorPlatformRole: data.currentActor.platformRole,
          actorPermissions: [...data.currentActor.accountPermissions, ...data.currentActor.platformPermissions],
          targetLayer: "account",
          requestedPermissions: individual.accountPermissions,
        })
      : null,
    platformRoleDecision: individual
      ? evaluatePermissionChange({
          actorAccountRole: data.currentActor.accountRole,
          actorPlatformRole: data.currentActor.platformRole,
          actorPermissions: [...data.currentActor.accountPermissions, ...data.currentActor.platformPermissions],
          targetLayer: "platform",
          requestedPermissions: individual.platformPermissions,
          requestedPlatformRole: individual.platformRole,
        })
      : null,
    deleteDecision: evaluatePermissionChange({
      actorAccountRole: data.currentActor.accountRole,
      actorPlatformRole: data.currentActor.platformRole,
      actorPermissions: [...data.currentActor.accountPermissions, ...data.currentActor.platformPermissions],
      targetLayer: "platform",
      requestedPermissions: ["delete_users"],
      dangerousAction: "delete_user",
    }),
    actionStates: individual ? data.actionStatesByUserId[individual.id] ?? [] : [],
  };
}

export const rolePermissionRepository = {
  readRegisteredIndividuals: () => getRoleManagementData().registeredIndividuals,
  readRoleTemplates: () => ({
    account: "ACCOUNT_ROLE_PERMISSION_TEMPLATES",
    platform: "PLATFORM_ROLE_PERMISSION_TEMPLATES",
  }),
  proposeRoleChange: (proposal: RoleWorkflowProposal) => evaluateRoleWorkflowProposal(proposal),
  validatePermissionChange: evaluatePermissionChange,
  applyMockRoleChange: (proposal: RoleWorkflowProposal) => {
    const evaluated = evaluateRoleWorkflowProposal({ ...proposal, confirmationProvided: proposal.confirmationProvided ?? true });
    return {
      ...evaluated,
      workflowState: evaluated.decision.allowed ? "approved_applied" as const : evaluated.workflowState,
      persisted: false,
      mockApplied: evaluated.decision.allowed,
    };
  },
  emitRoleAuditEvent: buildPermissionChangeAuditEvent,
};

export const roleManagementUserRepository: UserRepository = {
  async listRegisteredIndividuals() {
    return roleApiOk(roleManagementMockDataAdapter.readRegisteredIndividualsSync().map(toRegisteredIndividualContract), {
      reason: "mock individuals loaded through contract adapter",
    });
  },
  async getRegisteredIndividual(input) {
    const person = roleManagementMockDataAdapter.readRegisteredIndividualsSync().find((item) => item.id === input.user_id);
    if (!person) return roleApiError("not_found", "Registered individual was not found.");
    return roleApiOk(toRegisteredIndividualContract(person));
  },
};

export const roleManagementRoleRepository: RolePermissionRepository = {
  async listRoleTemplates() {
    return roleApiOk({
      account: roleManagementMockDataAdapter.readAccountRoleTemplates(),
      platform: roleManagementMockDataAdapter.readPlatformRoleTemplates(),
    });
  },
  async proposeRoleChange(input) {
    const proposal = toWorkflowProposal(input);
    if (!proposal) return roleApiError("invalid_payload", "Role change request failed validation.");
    const evaluated = evaluateRoleWorkflowProposal(proposal);
    return roleApiOk(evaluated.proposal, { workflowState: evaluated.workflowState, reason: evaluated.decision.reason });
  },
  async validatePermissionChange(input) {
    return validateRoleWorkflowRequest(input);
  },
  async submitPermissionChange(input) {
    return validateRoleWorkflowRequest(input, true);
  },
  async suspendUser(input) {
    return validateRoleWorkflowRequest({ ...input, dangerous_action: "suspend_user" }, Boolean(input.confirmation?.confirmed));
  },
  async restrictAccountAccess(input) {
    return validateRoleWorkflowRequest({ ...input, action_type: "account_access_restriction" });
  },
};

export const roleManagementAuditRepository: AuditEventRepository = {
  async emitAuditEvent(event) {
    return roleApiOk({ stored: false, event_id: event.id }, {
      reason: "prototype audit event emitted through mock adapter",
      auditEventId: event.id,
    });
  },
  async listAuditEvents(input) {
    const events = getRoleManagementData().permissionAuditTimeline.filter((event) => {
      if (input.user_id && event.workflow.target_user_id !== input.user_id) return false;
      if (input.account_id && event.workflow.target_account_id !== input.account_id) return false;
      return true;
    });
    return roleApiOk(events.slice(0, input.limit ?? events.length));
  },
};

export const roleManagementWorkspaceRepository: WorkspaceContextRepository = {
  async listAvailableWorkspaceContexts(input) {
    return roleApiOk(getAvailableWorkspaces(input.roles, { prototype: true, includeDisabled: false }).map((workspace) => ({
      id: workspace.id,
      href: workspace.href,
      enabled: workspace.enabled,
    })));
  },
};

export const roleManagementMockRepositories = {
  users: roleManagementUserRepository,
  roles: roleManagementRoleRepository,
  audit: roleManagementAuditRepository,
  workspaces: roleManagementWorkspaceRepository,
} as const;

export function getRoleManagementContractData() {
  return {
    individuals: roleManagementUserRepository.listRegisteredIndividuals({}, prototypeApiContext),
    templates: roleManagementRoleRepository.listRoleTemplates(prototypeApiContext),
  };
}

const roleManagementMockDataAdapter = {
  readRegisteredIndividualsSync: () => registeredIndividualsSeed,
  readAccountRoleTemplates: () => ({
    account_owner: getRoleTemplatePermissions("account_owner"),
    executor: getRoleTemplatePermissions("executor"),
    ifa: getRoleTemplatePermissions("ifa"),
    solicitor: getRoleTemplatePermissions("solicitor"),
    family_viewer: getRoleTemplatePermissions("family_viewer"),
    trusted_contact: getRoleTemplatePermissions("trusted_contact"),
    account_sub_admin: getRoleTemplatePermissions("account_sub_admin"),
  }),
  readPlatformRoleTemplates: () => ({
    platform_owner: getRoleTemplatePermissions("platform_owner"),
    super_admin: getRoleTemplatePermissions("super_admin"),
    admin: getRoleTemplatePermissions("admin"),
    support_admin: getRoleTemplatePermissions("support_admin"),
    compliance_auditor: getRoleTemplatePermissions("compliance_auditor"),
    readonly_auditor: getRoleTemplatePermissions("readonly_auditor"),
  }),
};

function toRegisteredIndividualContract(person: RegisteredIndividual): RegisteredIndividualContract {
  return {
    id: person.id,
    full_name: person.full_name,
    email: person.email,
    account_role: person.accountRole,
    platform_role: person.platformRole,
    permissions: [...person.accountPermissions, ...person.platformPermissions],
    workflow_state: person.workflowStatus,
    access_status: person.accessStatus,
  };
}

function toWorkflowProposal(input: RoleChangeRequestDto): RoleWorkflowProposal | null {
  if (!validateRoleChangeRequest(input)) return null;
  return {
    proposalId: input.request_id,
    actionType: input.action_type,
    workflowState: "draft_change",
    actor: {
      id: input.actor.actor_id,
      role: input.actor.actor_role as AccountRole | PlatformAdminRole | null,
      permissions: input.actor.actor_permissions,
    },
    target: {
      userId: input.target.target_user_id,
      accountId: input.target.target_account_id,
      layer: input.target.target_layer,
    },
    previousValue: input.previous_value,
    proposedValue: input.proposed_value,
    requestedPermissions: input.requested_permissions,
    requestedPlatformRole: input.requested_platform_role,
    dangerousAction: input.dangerous_action,
    confirmationProvided: input.confirmation?.confirmed,
    reason: input.reason,
  };
}

function validateRoleWorkflowRequest(input: RoleChangeRequestDto, submit = false) {
  const proposal = toWorkflowProposal(input);
  if (!proposal) return roleApiError("invalid_payload", "Role change request failed validation.");
  const evaluated = rolePermissionRepository.applyMockRoleChange({ ...proposal, confirmationProvided: submit || proposal.confirmationProvided });
  const auditEventId = `ROLE-CONTRACT-${input.request_id}`;
  if (!evaluated.decision.allowed) {
    return roleApiError(
      evaluated.decision.confirmationRequired ? "confirmation_required" : "permission_denied",
      evaluated.decision.reason,
      { workflowState: evaluated.workflowState, auditEventId },
    );
  }
  return roleApiOk({
    proposal_id: proposal.proposalId,
    workflow_state: evaluated.workflowState,
    decision: evaluated.decision,
    audit_event_id: auditEventId,
    mock_applied: evaluated.mockApplied,
  }, { workflowState: evaluated.workflowState, auditEventId });
}

function fromAdminUser(user: AdminUser, options: {
  accountOwnerStatus: RegisteredIndividual["accountOwnerStatus"];
  accountRole: AccountRole | null;
  platformRole: PlatformAdminRole | null;
  verificationStatus: RegisteredIndividual["verificationStatus"];
  inviteStatus: RegisteredIndividual["inviteStatus"];
  accessStatus: RegisteredIndividual["accessStatus"];
  childSubUsers: RegisteredIndividual["childSubUsers"];
  relationshipType: PeopleContactRelationshipType;
}): RegisteredIndividual {
  return {
    id: user.id,
    full_name: user.name,
    email: user.email,
    phone: null,
    accountOwnerStatus: options.accountOwnerStatus,
    linkedAccountVault: { id: `VAULT-${user.id.replace("USR-", "")}`, label: `${user.name} vault`, ownerId: user.id },
    platformRole: options.platformRole,
    accountRole: options.accountRole,
    accountPermissions: getRoleTemplatePermissions(options.accountRole),
    platformPermissions: getRoleTemplatePermissions(options.platformRole),
    childSubUsers: options.childSubUsers,
    parentAccountOwnerId: null,
    verificationStatus: options.verificationStatus,
    inviteStatus: options.inviteStatus,
    accessStatus: options.accessStatus,
    workflowStatus: options.accessStatus === "Restricted" ? "blocked" : options.accessStatus === "Pending" ? "pending_confirmation" : "approved_applied",
    lastPermissionUpdate: options.accessStatus === "Pending" ? "Pending confirmation" : "01 May 2026, 10:28",
    lastAuditEvent: options.accessStatus === "Restricted" ? "Blocked access review" : "Role template reviewed",
    lastActivity: user.lastLogin,
    relationship_type: options.relationshipType,
    linked_context: [{ type: "account", id: user.id, label: `${user.name} account` }],
    consent_scope: consentScope(false),
    governance_flags: governanceFlags({
      requiresVerification: options.verificationStatus !== "Verified",
      accountOwnerManaged: true,
      platformRoleRestricted: false,
    }),
    source_type: "registered_user",
  };
}

function consentScope(inheritedFromContext: boolean): PeopleConsentScope {
  return {
    adviserInsights: null,
    marketing: null,
    explicitDelegation: inheritedFromContext,
    inheritedFromContext,
  };
}

function governanceFlags(overrides: Partial<RegisteredIndividual["governance_flags"]> = {}): RegisteredIndividual["governance_flags"] {
  return {
    exportRestricted: true,
    requiresConsentReview: false,
    requiresVerification: false,
    prototypeOnly: true,
    organisationRestricted: false,
    accountOwnerManaged: false,
    platformRoleRestricted: false,
    deleteDisabled: true,
    ...overrides,
  };
}

function buildWorkflowProposals(people: RegisteredIndividual[], actor: RegisteredIndividual): RoleWorkflowProposal[] {
  const target = people.find((person) => person.childSubUsers.length > 0) ?? people[0];
  const supportAdmin = people.find((person) => person.platformRole === "support_admin") ?? actor;
  const restrictedUser = people.find((person) => person.accessStatus === "Restricted") ?? target;
  const actorPermissions = [...actor.accountPermissions, ...actor.platformPermissions];

  return [
    {
      proposalId: "ROLE-WF-001",
      actionType: "permission_toggle",
      workflowState: "submitted",
      actor: { id: actor.id, role: actor.platformRole ?? actor.accountRole, permissions: actorPermissions },
      target: { userId: target.id, accountId: target.linkedAccountVault.id, layer: "account" },
      previousValue: ["view_account"],
      proposedValue: target.accountPermissions,
      requestedPermissions: target.accountPermissions,
      reason: "Owner requested account-level sub-admin access review.",
    },
    {
      proposalId: "ROLE-WF-002",
      actionType: "admin_suspension",
      workflowState: "pending_confirmation",
      actor: { id: actor.id, role: actor.platformRole ?? actor.accountRole, permissions: actorPermissions },
      target: { userId: supportAdmin.id, accountId: supportAdmin.linkedAccountVault.id, layer: "platform" },
      previousValue: supportAdmin.accessStatus,
      proposedValue: "Suspended",
      requestedPermissions: ["suspend_users"],
      dangerousAction: "suspend_user",
      confirmationProvided: false,
      reason: "Admin suspension requires explicit confirmation and audit capture.",
    },
    {
      proposalId: "ROLE-WF-003",
      actionType: "role_assignment",
      workflowState: "blocked",
      actor: { id: target.id, role: "account_owner", permissions: getRoleTemplatePermissions("account_owner") },
      target: { userId: supportAdmin.id, accountId: supportAdmin.linkedAccountVault.id, layer: "platform" },
      previousValue: "None",
      proposedValue: "Admin",
      requestedPermissions: ["manage_platform_admins"],
      requestedPlatformRole: "admin",
      reason: "Blocked because account owners cannot grant platform administration rights.",
    },
    {
      proposalId: "ROLE-WF-004",
      actionType: "soft_delete_request",
      workflowState: "blocked",
      actor: { id: actor.id, role: actor.platformRole ?? actor.accountRole, permissions: actorPermissions },
      target: { userId: restrictedUser.id, accountId: restrictedUser.linkedAccountVault.id, layer: "platform" },
      previousValue: restrictedUser.accessStatus,
      proposedValue: "Deleted",
      requestedPermissions: ["delete_users"],
      dangerousAction: "delete_user",
      confirmationProvided: true,
      reason: "Delete remains disabled; suspend access is the prototype soft-delete path.",
    },
  ];
}

function buildActionStatesByUserId(people: RegisteredIndividual[], actor: RegisteredIndividual): Record<string, RoleActionState[]> {
  const actorPermissions = [...actor.accountPermissions, ...actor.platformPermissions];
  return people.reduce<Record<string, RoleActionState[]>>((acc, person) => {
    const roleDecision = evaluatePermissionChange({
      actorAccountRole: actor.accountRole,
      actorPlatformRole: actor.platformRole,
      actorPermissions,
      targetLayer: person.platformRole ? "platform" : "account",
      requestedPermissions: [...person.accountPermissions, ...person.platformPermissions],
      requestedPlatformRole: person.platformRole,
    });
    const suspendDecision = evaluatePermissionChange({
      actorAccountRole: actor.accountRole,
      actorPlatformRole: actor.platformRole,
      actorPermissions,
      targetLayer: person.platformRole ? "platform" : "account",
      requestedPermissions: ["suspend_users"],
      dangerousAction: "suspend_user",
      confirmationProvided: false,
    });
    const deleteDecision = evaluatePermissionChange({
      actorAccountRole: actor.accountRole,
      actorPlatformRole: actor.platformRole,
      actorPermissions,
      targetLayer: person.platformRole ? "platform" : "account",
      requestedPermissions: ["delete_users"],
      dangerousAction: "delete_user",
      confirmationProvided: true,
    });

    acc[person.id] = [
      {
        id: `${person.id}-role-change`,
        label: "Role change",
        actionType: "role_assignment",
        workflowState: getWorkflowStateForDecision(roleDecision),
        decision: roleDecision,
        requiredPermission: person.platformRole ? "manage_platform_admins" : "assign_account_roles",
        confirmationRequired: false,
      },
      {
        id: `${person.id}-suspend`,
        label: "Suspend access",
        actionType: person.platformRole ? "admin_suspension" : "sub_user_suspension",
        workflowState: getWorkflowStateForDecision(suspendDecision),
        decision: suspendDecision,
        requiredPermission: "suspend_users",
        confirmationRequired: true,
      },
      {
        id: `${person.id}-soft-delete`,
        label: "Soft-delete request",
        actionType: "soft_delete_request",
        workflowState: getWorkflowStateForDecision(deleteDecision, true),
        decision: deleteDecision,
        requiredPermission: "delete_users",
        confirmationRequired: true,
      },
    ];
    return acc;
  }, {});
}

function buildPermissionAuditTimeline(people: RegisteredIndividual[], proposals = buildWorkflowProposals(people, people[0])): RolePermissionAuditEvent[] {
  const superAdmin = people.find((person) => person.platformRole === "super_admin") ?? people[0];
  const actorPermissions = [...superAdmin.accountPermissions, ...superAdmin.platformPermissions];
  const target = people.find((person) => person.childSubUsers.length > 0) ?? people[0];
  const supportAdmin = people.find((person) => person.platformRole === "support_admin") ?? superAdmin;

  const accountDecision = evaluatePermissionChange({
    actorAccountRole: superAdmin.accountRole,
    actorPlatformRole: superAdmin.platformRole,
    actorPermissions,
    targetLayer: "account",
    requestedPermissions: target.accountPermissions,
  });
  const platformDecision = evaluatePermissionChange({
    actorAccountRole: superAdmin.accountRole,
    actorPlatformRole: superAdmin.platformRole,
    actorPermissions,
    targetLayer: "platform",
    requestedPermissions: supportAdmin.platformPermissions,
    requestedPlatformRole: supportAdmin.platformRole,
  });
  const blockedDecision = evaluatePermissionChange({
    actorAccountRole: "account_owner",
    actorPlatformRole: null,
    actorPermissions: getRoleTemplatePermissions("account_owner"),
    targetLayer: "platform",
    requestedPermissions: ["manage_platform_admins"],
    requestedPlatformRole: "admin",
  });

  return [
    buildPermissionChangeAuditEvent({
      id: "ROLE-AUD-001",
      actor: { id: superAdmin.id, displayName: superAdmin.full_name, role: superAdmin.platformRole },
      targetUser: { id: target.id, displayName: target.full_name },
      affectedAccount: target.linkedAccountVault,
      previousRoles: ["Trusted Contact"],
      newRoles: [target.accountRole ?? "No account role"],
      previousPermissions: ["view_account"],
      newPermissions: target.accountPermissions,
      reason: "Owner requested account-level sub-admin access review.",
      decision: accountDecision,
      actionType: "permission_toggle",
      workflowState: evaluateRoleWorkflowProposal(proposals[0]).workflowState,
      previousValue: proposals[0]?.previousValue,
      proposedValue: proposals[0]?.proposedValue,
      timestamp: "01 May 2026, 10:28",
    }),
    buildPermissionChangeAuditEvent({
      id: "ROLE-AUD-002",
      actor: { id: superAdmin.id, displayName: superAdmin.full_name, role: superAdmin.platformRole },
      targetUser: { id: supportAdmin.id, displayName: supportAdmin.full_name },
      affectedAccount: supportAdmin.linkedAccountVault,
      previousRoles: ["Read-only Auditor"],
      newRoles: [supportAdmin.platformRole ?? "No platform role"],
      previousPermissions: ["view_account", "view_audit_logs"],
      newPermissions: supportAdmin.platformPermissions,
      reason: "Platform owner delegated support administration template.",
      decision: platformDecision,
      actionType: "admin_suspension",
      workflowState: evaluateRoleWorkflowProposal(proposals[1]).workflowState,
      previousValue: proposals[1]?.previousValue,
      proposedValue: proposals[1]?.proposedValue,
      timestamp: "30 Apr 2026, 15:44",
    }),
    buildPermissionChangeAuditEvent({
      id: "ROLE-AUD-003",
      actor: { id: target.id, displayName: target.full_name, role: target.accountRole },
      targetUser: { id: supportAdmin.id, displayName: supportAdmin.full_name },
      affectedAccount: supportAdmin.linkedAccountVault,
      previousRoles: [],
      newRoles: ["Admin"],
      previousPermissions: [],
      newPermissions: ["manage_platform_admins"],
      reason: "Blocked because account owners cannot grant platform administration rights.",
      decision: blockedDecision,
      actionType: "role_assignment",
      workflowState: evaluateRoleWorkflowProposal(proposals[2]).workflowState,
      previousValue: proposals[2]?.previousValue,
      proposedValue: proposals[2]?.proposedValue,
      timestamp: "29 Apr 2026, 11:20",
    }),
    buildPermissionChangeAuditEvent({
      id: "ROLE-AUD-004",
      actor: { id: superAdmin.id, displayName: superAdmin.full_name, role: superAdmin.platformRole },
      targetUser: { id: target.id, displayName: target.full_name },
      affectedAccount: target.linkedAccountVault,
      previousRoles: [target.accessStatus],
      newRoles: ["Deleted"],
      previousPermissions: target.accountPermissions,
      newPermissions: target.accountPermissions,
      reason: "Delete remains disabled; suspend access is the prototype soft-delete path.",
      decision: evaluateRoleWorkflowProposal(proposals[3]).decision,
      actionType: "soft_delete_request",
      workflowState: evaluateRoleWorkflowProposal(proposals[3]).workflowState,
      previousValue: proposals[3]?.previousValue,
      proposedValue: proposals[3]?.proposedValue,
      timestamp: "28 Apr 2026, 14:10",
    }),
  ];
}
