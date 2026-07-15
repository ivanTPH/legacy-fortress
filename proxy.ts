import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyRoleBasedAccessMiddleware } from "./lib/backend/rbacMiddleware.ts";

const INTERNAL_ADMIN_EDGE_GUARD_FLAG = "ENABLE_INTERNAL_ADMIN_EDGE_GUARD";

function shouldApplyRoleBasedAccess(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/internal/test-login")) {
    return true;
  }

  if (!pathname.startsWith("/internal/admin")) {
    return pathname.startsWith("/application/admin") || pathname.startsWith("/application/enterprise");
  }

  if (pathname.startsWith("/internal/admin/prototype")) {
    return true;
  }

  const hasTrustedClaims = request.headers.get("x-lf-trusted-role-claims") === "true";

  if (process.env[INTERNAL_ADMIN_EDGE_GUARD_FLAG] === "true") {
    return true;
  }

  return hasTrustedClaims;
}

export function proxy(request: NextRequest) {
  // Edge auth redirect is intentionally disabled. Protected route checks happen
  // in app layout/pages using Supabase session validation, not cookie heuristics.
  if (shouldApplyRoleBasedAccess(request)) {
    return applyRoleBasedAccessMiddleware(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|brand/|logos/|icons/|api/).*)",
  ],
};
