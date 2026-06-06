import {
  canAccessAnyAdminArea,
  canAccessEnterpriseOperations,
  canAccessProbateOperations,
  canShowAdminViewSwitcher,
  type PlatformRole,
} from "./auth/platformRoles.ts";

export type AccessArea = "consumer" | "probate_admin" | "enterprise_admin" | "test_preview";

export type AccessModelRoute = {
  area: AccessArea;
  routePrefix: string;
  visibility: "normal_user" | "authorised_role_only" | "development_or_staging_only";
  landing: string;
  description: string;
};

export const ACCESS_MODEL_ROUTES: AccessModelRoute[] = [
  {
    area: "consumer",
    routePrefix: "/dashboard",
    visibility: "normal_user",
    landing: "/dashboard",
    description: "Consumer users sign in and land in the Legacy Fortress application dashboard.",
  },
  {
    area: "probate_admin",
    routePrefix: "/internal/admin",
    visibility: "authorised_role_only",
    landing: "/internal/admin",
    description: "Live operational admin access is role controlled and separate from consumer navigation.",
  },
  {
    area: "enterprise_admin",
    routePrefix: "/internal/admin/prototype",
    visibility: "authorised_role_only",
    landing: "/internal/admin/prototype",
    description: "Static probate and enterprise prototype routes are direct-access only and permission gated by mock role.",
  },
  {
    area: "test_preview",
    routePrefix: "/internal/test-login",
    visibility: "development_or_staging_only",
    landing: "/internal/test-login",
    description: "Beta persona switching is for mock preview only and must not replace production authentication.",
  },
];

export const ACCESS_MODEL_SUMMARY = {
  preferredModel: "one_authentication_system_with_role_permissions",
  consumerDefaultLanding: "/dashboard",
  adminDefaultLanding: "/internal/admin",
  prototypeDefaultLanding: "/internal/admin/prototype",
  consumerNavigationRule: "Consumer-only users should not see internal admin or test routes in app navigation.",
  authorisedSwitcherRule: "Authorised operational users may switch between Application view and Admin dashboard when their role permits.",
  productionAuthRule: "Admin access should be permission-controlled through the same production authentication system, not a separate insecure shortcut.",
  consumerToAdminSwitchRule: "Only show a consumer-side Admin dashboard switch when trusted production role claims include an admin capability.",
} as const;

export function isInternalAccessRoute(pathname: string) {
  return pathname.startsWith("/internal/admin") || pathname.startsWith("/internal/test-login");
}

export function getAccessAreaForPath(pathname: string): AccessArea {
  if (pathname.startsWith("/internal/test-login")) return "test_preview";
  if (pathname.startsWith("/internal/admin/prototype")) return "enterprise_admin";
  if (pathname.startsWith("/internal/admin")) return "probate_admin";
  return "consumer";
}

export function shouldHideFromConsumerNavigation(pathname: string) {
  return isInternalAccessRoute(pathname);
}

export function canRoleAccessArea(roles: readonly PlatformRole[], area: AccessArea) {
  if (area === "consumer") return true;
  if (area === "probate_admin") return canAccessProbateOperations(roles);
  if (area === "enterprise_admin") return canAccessEnterpriseOperations(roles);
  return false;
}

export function canRoleAccessPath(roles: readonly PlatformRole[], pathname: string) {
  return canRoleAccessArea(roles, getAccessAreaForPath(pathname));
}

export function canShowApplicationToAdminSwitch({
  roles,
  trustedRoleClaims,
}: {
  roles: readonly PlatformRole[];
  trustedRoleClaims: boolean;
}) {
  return canShowAdminViewSwitcher({ roles: [...roles], trustedRoleClaims }) && canAccessAnyAdminArea(roles);
}
