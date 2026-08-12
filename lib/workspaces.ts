import {
  canAccessEnterpriseOperations,
  canAccessProbateOperations,
  hasPlatformCapability,
  type PlatformRole,
} from "./auth/platformRoles.ts";

export type WorkspaceId =
  | "application"
  | "contact_wallet"
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

const ENTERPRISE_WORKSPACE_ROLES = new Set<PlatformRole>([
  "enterprise_admin",
  "enterprise_viewer",
  "partner_organisation_user",
  "licensing_admin",
]);

export function buildPrototypeWorkspaceUrl(workspace: WorkspaceId, options: WorkspaceRouteOptions = {}) {
  if (workspace === "application") {
    if (options.prototype && options.currentRole) {
      return withPrototypeParams("/user", options.currentRole);
    }
    return "/user";
  }

  if (workspace === "contact_wallet") return "/contact-wallet";

  if (workspace === "super_admin") {
    return "/admin";
  }

  if (workspace === "enterprise_admin") {
    return "/application/enterprise";
  }

  return "/admin/probate";
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
  if (pathname === "/admin/probate" || pathname.startsWith("/admin/probate/")) return "probate_admin";
  if (pathname === "/admin/verification" || pathname.startsWith("/admin/verification/")) return "probate_admin";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "super_admin";
  if (pathname === "/internal/admin" || pathname.startsWith("/internal/admin/ops")) return "super_admin";
  if (pathname.startsWith("/internal/admin/prototype/users")) return "super_admin";
  if (pathname.startsWith("/internal/admin/prototype/enterprise")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/organisations")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/licences")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/reports")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin/prototype/campaigns")) return "enterprise_admin";
  if (pathname.startsWith("/application/enterprise")) return "enterprise_admin";
  if (pathname.startsWith("/application/admin")) return "super_admin";
  if (pathname.startsWith("/internal/admin/probate")) return "probate_admin";
  if (pathname.startsWith("/user")) return "application";
  if (pathname.startsWith("/internal/admin/prototype")) return "probate_admin";
  if (pathname.startsWith("/contact-wallet") || pathname.startsWith("/executors")) return "contact_wallet";
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
      id: "contact_wallet",
      label: "Contact Wallet",
      shortLabel: "Wallet",
      description: "Supporting relationships, responsibilities, and explicitly authorised records.",
      href: buildPrototypeWorkspaceUrl("contact_wallet", options),
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
      description: "Your authorised enterprise organisation context, licensing, reporting, and commercial signals.",
      href: buildPrototypeWorkspaceUrl("enterprise_admin", { ...options, currentRole: primaryRole }),
      enabled: roles.some((role) => ENTERPRISE_WORKSPACE_ROLES.has(role)) && canAccessEnterpriseOperations(roles),
      requiredRole: "enterprise_admin, enterprise_viewer, partner_organisation_user, or licensing_admin",
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
  if (roleSet.has("super_admin")) return filtered.filter((route) => route.id !== "contact_wallet");
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
