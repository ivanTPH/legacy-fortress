import type { NextRequest } from "next/server";
import {
  normalizePlatformRole,
  type PlatformRole,
  type PlatformCapability,
  getPlatformRoleCapabilities,
} from "../auth/platformRoles.ts";
import type { PlatformSessionPrincipal } from "./domainEntities.ts";
import { isProductionLikeEnvironment } from "./environment.ts";

export type SessionLifecycleState =
  | "anonymous"
  | "authenticated_untrusted_roles"
  | "authenticated_trusted_roles"
  | "expired"
  | "revoked";

export type SessionLifecycleContext = {
  state: SessionLifecycleState;
  principal: PlatformSessionPrincipal | null;
  capabilities: PlatformCapability[];
  source: "none" | "trusted_header" | "prototype_cookie" | "prototype_query" | "future_provider";
};

const ROLE_HEADER = "x-lf-platform-roles";
const TRUSTED_HEADER = "x-lf-trusted-role-claims";
const PROTOTYPE_ROLE_COOKIE = "lf_test_persona_role";

export const sessionLifecycleReadiness = {
  currentProvider: "supabase_client_session_plus_prototype_context",
  futureProvider: "server_verified_auth_provider_claims",
  trustedClaimRequirement: "Admin view switching and middleware access must require trusted provider role claims in production-like environments.",
  lifecycleStates: ["anonymous", "authenticated_untrusted_roles", "authenticated_trusted_roles", "expired", "revoked"],
} as const;

export function parsePlatformRoles(value: string | null | undefined): PlatformRole[] {
  return [...new Set(
    String(value ?? "")
      .split(",")
      .map((role) => normalizePlatformRole(role))
      .filter((role): role is PlatformRole => Boolean(role)),
  )];
}

export function resolveRequestSessionContext(request: Pick<NextRequest, "headers" | "cookies" | "nextUrl">): SessionLifecycleContext {
  const trustedHeader = request.headers.get(TRUSTED_HEADER) === "true";
  const headerRoles = parsePlatformRoles(request.headers.get(ROLE_HEADER));
  const prototypeRole = normalizePlatformRole(request.cookies.get(PROTOTYPE_ROLE_COOKIE)?.value);
  const productionLike = isProductionLikeEnvironment();
  const prototypeQueryRole = resolvePrototypeQueryRole(request, productionLike);
  const roles = headerRoles.length > 0
    ? headerRoles
    : !productionLike && prototypeRole
      ? [prototypeRole]
      : prototypeQueryRole
        ? [prototypeQueryRole]
        : [];
  const trustedRoleClaims = trustedHeader && headerRoles.length > 0;
  const source = trustedRoleClaims
    ? "trusted_header"
    : headerRoles.length > 0
      ? "trusted_header"
      : prototypeRole
        ? "prototype_cookie"
        : prototypeQueryRole
          ? "prototype_query"
          : "none";

  if (roles.length === 0) {
    return { state: "anonymous", principal: null, capabilities: [], source: "none" };
  }

  const principal: PlatformSessionPrincipal = {
    userId: request.headers.get("x-lf-user-id") || "prototype-user",
    email: request.headers.get("x-lf-user-email"),
    roles,
    trustedRoleClaims,
    sessionId: request.headers.get("x-lf-session-id"),
  };

  return {
    state: trustedRoleClaims ? "authenticated_trusted_roles" : "authenticated_untrusted_roles",
    principal,
    capabilities: getPlatformRoleCapabilities(roles),
    source,
  };
}

function resolvePrototypeQueryRole(
  request: Pick<NextRequest, "nextUrl">,
  productionLike: boolean,
): PlatformRole | null {
  if (productionLike) return null;
  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith("/internal/admin/prototype")
    && !pathname.startsWith("/application/admin")
    && !pathname.startsWith("/application/enterprise")
    && !pathname.startsWith("/enterprise")) return null;
  if (searchParams.get("admin") !== "true" || searchParams.get("prototype") !== "true") return null;
  return normalizePlatformRole(searchParams.get("role"));
}
