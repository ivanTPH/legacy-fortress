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
    area: "consumer",
    routePrefix: "/user",
    visibility: "normal_user",
    landing: "/dashboard",
    description: "Hosted-UAT friendly customer entry path that resolves to the canonical consumer dashboard.",
  },
  {
    area: "probate_admin",
    routePrefix: "/application/admin",
    visibility: "authorised_role_only",
    landing: "/admin",
    description: "Hosted-UAT friendly application admin entry path that resolves to the canonical admin dashboard.",
  },
  {
    area: "enterprise_admin",
    routePrefix: "/enterprise",
    visibility: "authorised_role_only",
    landing: "/enterprise",
    description: "Canonical enterprise operations entry point; access remains organisation and capability controlled.",
  },
  {
    area: "enterprise_admin",
    routePrefix: "/application/enterprise",
    visibility: "authorised_role_only",
    landing: "/application/enterprise",
    description: "Hosted-UAT friendly enterprise entry path that resolves to the canonical enterprise workspace.",
  },
  {
    area: "probate_admin",
    routePrefix: "/internal/admin",
    visibility: "authorised_role_only",
    landing: "/internal/admin",
    description: "Live operational admin access is role controlled and separate from consumer navigation.",
  },
  {
    area: "test_preview",
    routePrefix: "/internal/admin/prototype",
    visibility: "development_or_staging_only",
    landing: "/internal/admin/prototype",
    description: "Static probate and enterprise prototype routes are quarantined outside explicit local-development preview.",
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
  adminDefaultLanding: "/admin",
  prototypeDefaultLanding: null,
  consumerNavigationRule: "Consumer-only users should not see internal admin or test routes in app navigation.",
  authorisedSwitcherRule: "Authorised operational users may switch between Application view and Admin dashboard when their role permits.",
  productionAuthRule: "Admin access should be permission-controlled through the same production authentication system, not a separate insecure shortcut.",
  consumerToAdminSwitchRule: "Only show a consumer-side Admin dashboard switch when trusted production role claims include an admin capability.",
} as const;

export function isInternalAccessRoute(pathname: string) {
  return pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname.startsWith("/internal/admin")
    || pathname.startsWith("/internal/test-login")
    || pathname.startsWith("/application/admin")
    || pathname.startsWith("/application/enterprise")
    || pathname === "/enterprise"
    || pathname.startsWith("/enterprise/");
}

export function getAccessAreaForPath(pathname: string): AccessArea {
  if (pathname.startsWith("/internal/test-login")) return "test_preview";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "probate_admin";
  if (pathname.startsWith("/application/enterprise")) return "enterprise_admin";
  if (pathname === "/enterprise" || pathname.startsWith("/enterprise/")) return "enterprise_admin";
  if (pathname.startsWith("/application/admin")) return "probate_admin";
  if (pathname.startsWith("/internal/admin/prototype")) return "test_preview";
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
