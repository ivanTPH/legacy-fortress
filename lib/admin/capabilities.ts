export type AdminRole =
  | "super_admin"
  | "support_agent"
  | "verification_reviewer"
  | "probate_reviewer"
  | "auditor"
  | "enterprise_admin";

export type AdminCapability =
  | "admin.dashboard.read"
  | "admin.users.summary.read"
  | "admin.vaults.summary.read"
  | "admin.invitations.summary.read"
  | "admin.email.summary.read"
  | "admin.probate.summary.read"
  | "admin.support.summary.read"
  | "admin.audit.read"
  | "admin.audit.read_limited"
  | "admin.reporting.summary.read"
  | "admin.enterprise.summary.read"
  | "admin.organisations.summary.read"
  | "admin.licences.summary.read"
  | "admin.roles.test"
  | "admin_shell:view"
  | "admin_users:manage"
  | "users:lookup"
  | "support:read"
  | "verification:read"
  | "verification:review"
  | "verification:decide"
  | "audit:read"
  | "audit:write"
  | "prototype:view"
  | "organisation:view"
  | "organisation:manage"
  | "licence:view"
  | "licence:create"
  | "licence:edit"
  | "licence:seats"
  | "licence:renew"
  | "licence:lifecycle"
  | "licence:audit"
  | "enterprise.invitation.manage"
  | "enterprise.licence.manage"
  | "enterprise.report.read"
  | "enterprise.export.request";

const ADMIN_ROLE_CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  super_admin: [
    "admin.dashboard.read",
    "admin.users.summary.read",
    "admin.vaults.summary.read",
    "admin.invitations.summary.read",
    "admin.email.summary.read",
    "admin.probate.summary.read",
    "admin.support.summary.read",
    "admin.audit.read",
    "admin.audit.read_limited",
    "admin.reporting.summary.read",
    "admin.enterprise.summary.read",
    "admin.organisations.summary.read",
    "admin.licences.summary.read",
    "admin.roles.test",
    "admin_shell:view",
    "admin_users:manage",
    "users:lookup",
    "support:read",
    "verification:read",
    "verification:review",
    "verification:decide",
    "audit:read",
    "audit:write",
    "prototype:view",
    "organisation:view",
    "organisation:manage",
    "licence:view",
    "licence:create",
    "licence:edit",
    "licence:seats",
    "licence:renew",
    "licence:lifecycle",
    "licence:audit",
    "enterprise.invitation.manage",
    "enterprise.licence.manage",
    "enterprise.report.read",
    "enterprise.export.request",
  ],
  support_agent: [
    "admin.dashboard.read",
    "admin.users.summary.read",
    "admin.vaults.summary.read",
    "admin.invitations.summary.read",
    "admin.email.summary.read",
    "admin.support.summary.read",
    "admin_shell:view",
    "users:lookup",
    "support:read",
    "audit:write",
  ],
  verification_reviewer: [
    "admin.dashboard.read",
    "admin.invitations.summary.read",
    "admin.probate.summary.read",
    "admin.audit.read_limited",
    "admin_shell:view",
    "verification:read",
    "verification:review",
    "audit:write",
  ],
  probate_reviewer: [
    "admin.dashboard.read",
    "admin.invitations.summary.read",
    "admin.probate.summary.read",
    "admin.audit.read_limited",
    "admin_shell:view",
    "verification:read",
    "verification:review",
    "verification:decide",
    "audit:write",
  ],
  auditor: [
    "admin.dashboard.read",
    "admin.audit.read",
    "admin.reporting.summary.read",
    "admin_shell:view",
    "audit:read",
    "organisation:view",
    "enterprise.report.read",
    "licence:view",
    "licence:audit",
  ],
  enterprise_admin: [
    "admin.dashboard.read",
    "admin.enterprise.summary.read",
    "admin.organisations.summary.read",
    "admin.licences.summary.read",
    "admin_shell:view",
    "organisation:view",
    "organisation:manage",
    "licence:view",
    "licence:create",
    "licence:edit",
    "licence:seats",
    "licence:renew",
    "licence:lifecycle",
    "licence:audit",
    "enterprise.invitation.manage",
    "enterprise.licence.manage",
    "enterprise.report.read",
    "enterprise.export.request",
    "audit:write",
  ],
};

export const ADMIN_ROLES = Object.keys(ADMIN_ROLE_CAPABILITIES) as AdminRole[];

export function normalizeAdminRole(value: string | null | undefined): AdminRole | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "organisation_admin") return "enterprise_admin";
  return ADMIN_ROLES.includes(normalized as AdminRole) ? normalized as AdminRole : null;
}

export function getAdminRoleCapabilities(role: AdminRole) {
  return ADMIN_ROLE_CAPABILITIES[role] ?? [];
}

export function hasAdminCapability(role: AdminRole, capability: AdminCapability) {
  return getAdminRoleCapabilities(role).includes(capability);
}

export function deriveAdminRole(input: {
  isMaster?: boolean | null;
  role?: string | null;
}): AdminRole {
  if (input.isMaster) return "super_admin";
  return normalizeAdminRole(input.role) ?? "support_agent";
}

export function getDeniedAdminCapabilityMessage(capability: AdminCapability) {
  const label = capability.replace(/[:_]/g, " ");
  return `This admin action requires ${label} permission.`;
}
