export type PlatformRole =
  | "consumer_user"
  | "executor"
  | "adviser"
  | "partner_organisation_user"
  | "probate_admin"
  | "verification_reviewer"
  | "enterprise_admin"
  | "enterprise_viewer"
  | "licensing_admin"
  | "support_admin"
  | "internal_admin"
  | "super_admin";

export type PlatformCapability =
  | "consumer_app"
  | "executor_view"
  | "adviser_view"
  | "probate_operations"
  | "verification_review"
  | "enterprise_dashboard"
  | "enterprise_reports"
  | "enterprise_licensing"
  | "support_operations"
  | "admin_view_switch";

export type TrustedRoleClaimContext = {
  roles: PlatformRole[];
  trustedRoleClaims: boolean;
};

export const PLATFORM_ROLE_CAPABILITIES: Record<PlatformRole, PlatformCapability[]> = {
  consumer_user: ["consumer_app"],
  executor: ["consumer_app", "executor_view"],
  adviser: ["consumer_app", "adviser_view"],
  partner_organisation_user: ["enterprise_dashboard", "enterprise_reports"],
  probate_admin: ["consumer_app", "probate_operations", "verification_review", "admin_view_switch"],
  verification_reviewer: ["probate_operations", "verification_review", "admin_view_switch"],
  enterprise_admin: ["consumer_app", "enterprise_dashboard", "enterprise_reports", "admin_view_switch"],
  enterprise_viewer: ["enterprise_dashboard", "enterprise_reports"],
  licensing_admin: ["consumer_app", "enterprise_dashboard", "enterprise_reports", "enterprise_licensing", "admin_view_switch"],
  support_admin: ["consumer_app", "support_operations", "admin_view_switch"],
  internal_admin: ["consumer_app", "probate_operations", "verification_review", "support_operations", "admin_view_switch"],
  super_admin: [
    "consumer_app",
    "executor_view",
    "adviser_view",
    "probate_operations",
    "verification_review",
    "enterprise_dashboard",
    "enterprise_reports",
    "enterprise_licensing",
    "support_operations",
    "admin_view_switch",
  ],
};

export function getPlatformRoleCapabilities(roles: readonly PlatformRole[]) {
  return [...new Set(roles.flatMap((role) => PLATFORM_ROLE_CAPABILITIES[role] ?? []))];
}

export function hasPlatformCapability(roles: readonly PlatformRole[], capability: PlatformCapability) {
  return getPlatformRoleCapabilities(roles).includes(capability);
}

export function canAccessConsumerApplication(roles: readonly PlatformRole[]) {
  return roles.length === 0 || hasPlatformCapability(roles, "consumer_app");
}

export function canAccessProbateOperations(roles: readonly PlatformRole[]) {
  return hasPlatformCapability(roles, "probate_operations") || hasPlatformCapability(roles, "verification_review");
}

export function canAccessEnterpriseOperations(roles: readonly PlatformRole[]) {
  return hasPlatformCapability(roles, "enterprise_dashboard") || hasPlatformCapability(roles, "enterprise_reports");
}

export function canAccessEnterpriseLicensing(roles: readonly PlatformRole[]) {
  return hasPlatformCapability(roles, "enterprise_licensing");
}

export function canAccessAnyAdminArea(roles: readonly PlatformRole[]) {
  return canAccessProbateOperations(roles)
    || canAccessEnterpriseOperations(roles)
    || canAccessEnterpriseLicensing(roles)
    || hasPlatformCapability(roles, "support_operations");
}

export function canShowAdminViewSwitcher(context: TrustedRoleClaimContext) {
  return context.trustedRoleClaims
    && hasPlatformCapability(context.roles, "admin_view_switch")
    && canAccessAnyAdminArea(context.roles);
}

export function getDefaultLandingForRoles(roles: readonly PlatformRole[]) {
  if (roles.includes("super_admin")) return "/internal/admin/prototype/enterprise";
  if (canAccessEnterpriseOperations(roles)) return "/internal/admin/prototype/enterprise";
  if (canAccessProbateOperations(roles)) return "/internal/admin/probate";
  if (hasPlatformCapability(roles, "executor_view")) return "/contact-wallet";
  return "/dashboard";
}

export function normalizePlatformRole(value: string | null | undefined): PlatformRole | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (normalized in PLATFORM_ROLE_CAPABILITIES) return normalized as PlatformRole;
  return null;
}

export function extractPlatformRolesFromMetadata(metadata: unknown): PlatformRole[] {
  if (!metadata || typeof metadata !== "object") return [];
  const record = metadata as Record<string, unknown>;
  const rawRoles = Array.isArray(record.roles)
    ? record.roles
    : Array.isArray(record.platform_roles)
      ? record.platform_roles
      : typeof record.role === "string"
        ? [record.role]
        : typeof record.platform_role === "string"
          ? [record.platform_role]
          : [];

  return [...new Set(
    rawRoles
      .map((role) => normalizePlatformRole(String(role)))
      .filter((role): role is PlatformRole => Boolean(role)),
  )];
}
