import { NextResponse, type NextRequest } from "next/server.js";
import { canRoleAccessPath, shouldHideFromConsumerNavigation } from "../accessModel.ts";
import { canAccessAnyAdminArea } from "../auth/platformRoles.ts";
import { evaluateGovernanceAccess } from "../governance/policyEngine.ts";
import { isProductionLikeEnvironment, shouldExposeTestPersonaRoutes } from "./environment.ts";
import { resolveRequestSessionContext } from "./sessionLifecycle.ts";

export type RouteAccessDecision =
  | { allowed: true; reason: "public_route" | "role_allowed" | "non_production_test_route" }
  | { allowed: false; status: 403 | 404; reason: "admin_role_required" | "trusted_claim_required" | "test_route_hidden" };

export const roleMiddlewareReadiness = {
  currentMode: "conservative_route_guard",
  productionRule: "Production admin access must require trusted role claims from the auth provider.",
  consumerRule: "Consumer-only navigation must never expose internal admin/test routes.",
  restrictedStateRule: "Denied internal routes should not redirect to consumer UI or leak page content.",
} as const;

export function decideRouteAccess(request: Pick<NextRequest, "nextUrl" | "headers" | "cookies">): RouteAccessDecision {
  const pathname = request.nextUrl.pathname;
  if (!shouldHideFromConsumerNavigation(pathname)) return { allowed: true, reason: "public_route" };

  if (pathname.startsWith("/internal/test-login")) {
    return shouldExposeTestPersonaRoutes()
      ? { allowed: true, reason: "non_production_test_route" }
      : { allowed: false, status: 404, reason: "test_route_hidden" };
  }

  const session = resolveRequestSessionContext(request);
  const roles = session.principal?.roles ?? [];
  const governance = evaluateGovernanceAccess({
    action: "view_admin_route",
    roles,
    trustedRoleClaims: session.principal?.trustedRoleClaims ?? false,
    targetEntity: { type: "access_policy", id: pathname },
    prototypeOnly: pathname.startsWith("/internal/admin/prototype"),
  });
  if (!governance.allowed) {
    return {
      allowed: false,
      status: governance.restrictedState?.status === 404 ? 404 : 403,
      reason: governance.reason === "trusted_claim_required" ? "trusted_claim_required" : "admin_role_required",
    };
  }

  if (!canAccessAnyAdminArea(roles) || !canRoleAccessPath(roles, pathname)) {
    return { allowed: false, status: 403, reason: "admin_role_required" };
  }

  if (isProductionLikeEnvironment() && !session.principal?.trustedRoleClaims) {
    return { allowed: false, status: 403, reason: "trusted_claim_required" };
  }

  return { allowed: true, reason: "role_allowed" };
}

export function applyRoleBasedAccessMiddleware(request: NextRequest) {
  const decision = decideRouteAccess(request);
  if (decision.allowed) return NextResponse.next();
  const acceptsHtml = String(request.headers.get("accept") ?? "").includes("text/html");

  if (acceptsHtml) {
    return new NextResponse(renderRestrictedAccessHtml(decision.reason), {
      status: decision.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-legacy-fortress-access": decision.reason,
      },
    });
  }

  return new NextResponse(
    JSON.stringify({
      ok: false,
      message: "Access restricted",
      reason: decision.reason,
    }),
    {
      status: decision.status,
      headers: {
        "content-type": "application/json",
        "x-legacy-fortress-access": decision.reason,
      },
    },
  );
}

function renderRestrictedAccessHtml(reason: RouteAccessDecision extends infer Decision
  ? Decision extends { allowed: false; reason: infer Reason }
    ? Reason
    : never
  : never) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Access restricted - Legacy Fortress</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #111827; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 560px; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08); }
      p { color: #4b5563; line-height: 1.6; }
      code { background: #f3f4f6; border-radius: 8px; padding: 2px 6px; }
      a { color: #111827; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <section role="status" aria-live="polite">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;">Legacy Fortress</p>
        <h1 style="margin:0;font-size:28px;line-height:1.15;">Access restricted</h1>
        <p>This internal area is protected by role and governance checks. The current request was blocked with reason <code>${escapeHtml(String(reason))}</code>.</p>
        <p>Use a permitted admin or prototype role context, or sign in with an account that has the required access level.</p>
        <p><a href="/sign-in">Go to sign in</a></p>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}
