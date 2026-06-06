import {
  canAccessEnterpriseOperations,
  canAccessProbateOperations,
  hasPlatformCapability,
  type PlatformRole,
} from "./auth/platformRoles.ts";

export type WorkspaceId =
  | "application"
  | "executor"
  | "super_admin"
  | "enterprise_admin"
  | "probate_admin";

export type WorkspaceRoute = {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  enabled: boolean;
  requiredRole: string;
  roleContext: PlatformRole | null;
};

export type WorkspaceRouteOptions = {
  prototype?: boolean;
  currentRole?: PlatformRole | null;
};

export function buildPrototypeWorkspaceUrl(workspace: WorkspaceId, options: WorkspaceRouteOptions = {}) {
  if (workspace === "application") {
    if (options.prototype && options.currentRole) {
      return withPrototypeParams("/dashboard", options.currentRole);
    }
    return "/dashboard";
  }

  if (workspace === "executor") return "/executors";

  if (workspace === "super_admin") {
    return withPrototypeParams("/internal/admin/prototype/users", "super_admin");
  }

  if (workspace === "enterprise_admin") {
    const role = options.currentRole === "licensing_admin" ? "licensing_admin" : "enterprise_admin";
    return withPrototypeParams("/internal/admin/prototype/enterprise", role);
  }

  return withPrototypeParams("/internal/admin/prototype/cases", "probate_admin");
}

export function getPrimaryWorkspaceRole(roles: readonly PlatformRole[]) {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("licensing_admin")) return "licensing_admin";
  if (roles.includes("enterprise_admin")) return "enterprise_admin";
  if (roles.includes("probate_admin")) return "probate_admin";
  if (roles.includes("verification_reviewer")) return "verification_reviewer";
  if (roles.includes("executor")) return "executor";
  if (roles.includes("adviser")) return "adviser";
  return roles[0] ?? null;
}

export function getCurrentWorkspaceForPath(pathname: string): WorkspaceId {
  if (pathname.startsWith("/internal/admin/prototype/users")) return "super_admin";
  if (pathname.startsWith("/internal/admin/prototype/enterprise")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/organisations")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/licences")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/reports")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/campaigns")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype")) return "probate_admin";
  if (pathname.startsWith("/internal/admin/probate")) return "probate_admin";
  if (pathname.startsWith("/executors")) return "executor";
  return "application";
}

export function getAvailableWorkspaces(
  roles: readonly PlatformRole[],
  options: WorkspaceRouteOptions & { includeDisabled?: boolean } = {},
): WorkspaceRoute[] {
  const roleSet = new Set(roles);
  const primaryRole = options.currentRole ?? getPrimaryWorkspaceRole(roles);
  const consumerEnabled = roles.length === 0 || hasPlatformCapability(roles, "consumer_app");
  const routes: WorkspaceRoute[] = [
    {
      id: "application",
      label: "Personal Vault",
      shortLabel: "Personal Vault",
      description: "Your Legacy Fortress vault and consumer dashboard.",
      href: buildPrototypeWorkspaceUrl("application", { prototype: options.prototype, currentRole: primaryRole }),
      enabled: consumerEnabled,
      requiredRole: "consumer_user or consumer-enabled operational role",
      roleContext: primaryRole,
    },
    {
      id: "executor",
      label: "Executor Workspace",
      shortLabel: "Executor",
      description: "Executor and trusted-access workspace.",
      href: buildPrototypeWorkspaceUrl("executor", options),
      enabled: roleSet.has("executor") || hasPlatformCapability(roles, "executor_view"),
      requiredRole: "executor",
      roleContext: "executor",
    },
    {
      id: "super_admin",
      label: "Platform Administration",
      shortLabel: "Platform Admin",
      description: "Users, permissions, role changes, and platform governance.",
      href: buildPrototypeWorkspaceUrl("super_admin", options),
      enabled: roleSet.has("super_admin"),
      requiredRole: "super_admin",
      roleContext: "super_admin",
    },
    {
      id: "enterprise_admin",
      label: "Enterprise Operations",
      shortLabel: "Enterprise",
      description: "Organisation licensing, reporting, and commercial signals.",
      href: buildPrototypeWorkspaceUrl("enterprise_admin", { ...options, currentRole: primaryRole }),
      enabled: canAccessEnterpriseOperations(roles),
      requiredRole: "enterprise_admin, licensing_admin, or super_admin",
      roleContext: primaryRole === "licensing_admin" ? "licensing_admin" : "enterprise_admin",
    },
    {
      id: "probate_admin",
      label: "Probate Review",
      shortLabel: "Probate",
      description: "Probate cases, verification queues, users, access, and audit.",
      href: buildPrototypeWorkspaceUrl("probate_admin", options),
      enabled: canAccessProbateOperations(roles),
      requiredRole: "probate_admin, verification_reviewer, or super_admin",
      roleContext: "probate_admin",
    },
  ];

  const filtered = options.includeDisabled ? routes : routes.filter((route) => route.enabled);
  if (roleSet.has("super_admin")) return filtered.filter((route) => route.id !== "executor");
  return filtered.filter((route) => route.id !== "super_admin");
}

export function resolveWorkspaceRoutes(roles: readonly PlatformRole[], options: WorkspaceRouteOptions = {}) {
  return getAvailableWorkspaces(roles, { ...options, includeDisabled: false });
}

function withPrototypeParams(pathname: string, role: PlatformRole) {
  const params = new URLSearchParams({
    role,
    admin: "true",
    prototype: "true",
  });
  return `${pathname}?${params.toString()}`;
}
