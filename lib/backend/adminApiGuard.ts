import { NextResponse } from "next/server.js";
import {
  getPlatformRoleCapabilities,
  normalizePlatformRole,
  type PlatformRole,
} from "../auth/platformRoles.ts";
import { isProductionLikeEnvironment, getRuntimeEnvironment } from "./environment.ts";
import type { ApiRequestContext, PlatformSessionPrincipal } from "./domainEntities.ts";

export type AdminApiGuardResult =
  | { ok: true; context: ApiRequestContext; roles: PlatformRole[]; source: "trusted_header" | "prototype_query" }
  | { ok: false; response: NextResponse; reason: "admin_role_required" | "trusted_claim_required" | "invalid_prototype_context" };

export const adminApiGuardReadiness = {
  currentMode: "mock_api_guard",
  productionRule: "Production admin API access requires trusted role claims; query parameters never grant production admin access.",
  prototypeRule: "Non-production mock access requires role plus admin=true and prototype=true query flags or trusted role headers.",
} as const;

export function requireAdminApiAccess(request: Request): AdminApiGuardResult {
  const url = new URL(request.url);
  const trusted = request.headers.get("x-lf-trusted-role-claims") === "true";
  const headerRoles = parseRoles(request.headers.get("x-lf-platform-roles"));
  const productionLike = isProductionLikeEnvironment();
  const prototypeRole = !productionLike && url.searchParams.get("admin") === "true" && url.searchParams.get("prototype") === "true"
    ? normalizePlatformRole(url.searchParams.get("role"))
    : null;
  const roles = headerRoles.length ? headerRoles : prototypeRole ? [prototypeRole] : [];
  const trustedRoleClaims = trusted && headerRoles.length > 0;
  const source = trustedRoleClaims ? "trusted_header" : prototypeRole ? "prototype_query" : null;

  if (roles.length === 0) {
    return denied("admin_role_required", "Admin API access requires an admin role context.");
  }

  if (productionLike && !trustedRoleClaims) {
    return denied("trusted_claim_required", "Production admin API access requires trusted role claims.");
  }

  const capabilities = getPlatformRoleCapabilities(roles);
  const hasAdminCapability = capabilities.some((capability) => [
    "probate_operations",
    "verification_review",
    "enterprise_dashboard",
    "enterprise_reports",
    "enterprise_licensing",
    "support_operations",
    "admin_view_switch",
  ].includes(capability));

  if (!hasAdminCapability || !source) {
    return denied("invalid_prototype_context", "The request did not include a permitted admin API context.");
  }

  const principal: PlatformSessionPrincipal = {
    userId: request.headers.get("x-lf-user-id") || "prototype-admin-api-user",
    email: request.headers.get("x-lf-user-email"),
    roles,
    trustedRoleClaims,
    sessionId: request.headers.get("x-lf-session-id"),
  };

  return {
    ok: true,
    roles,
    source,
    context: {
      requestId: request.headers.get("x-lf-request-id") || `admin-api-${Date.now()}`,
      principal,
      route: url.pathname,
      environment: getRuntimeEnvironment(),
      governance: {
        prototypeOnly: source === "prototype_query",
        exportEnabled: false,
        policyDecision: "allowed",
      },
    },
  };
}

function parseRoles(value: string | null) {
  return [...new Set(
    String(value ?? "")
      .split(",")
      .map((role) => normalizePlatformRole(role))
      .filter((role): role is PlatformRole => Boolean(role)),
  )];
}

function denied(reason: AdminApiGuardResult extends infer Result
  ? Result extends { ok: false; reason: infer Reason }
    ? Reason
    : never
  : never, message: string): AdminApiGuardResult {
  return {
    ok: false,
    reason,
    response: NextResponse.json({
      ok: false,
      error: { code: reason, message },
      reason: message,
      policyDecision: "blocked",
      mock: true,
    }, { status: 403 }),
  };
}
