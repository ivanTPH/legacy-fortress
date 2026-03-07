import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/legal",
  "/finances",
  "/personal",
  "/property",
  "/business",
  "/cars-transport",
  "/employment",
  "/support",
  "/settings",
  "/vault",
  "/profile",
  "/account",
];

const AUTH_PAGES = new Set(["/signin", "/signup", "/forgot-password", "/onboarding"]);

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => /sb-.*-auth-token(\.\d+)?/.test(cookie.name));
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAuth = hasSupabaseAuthCookie(request);

  if (isProtectedPath(pathname) && !hasAuth) {
    const signin = new URL("/signin", request.url);
    signin.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signin);
  }

  if (AUTH_PAGES.has(pathname) && hasAuth && pathname !== "/onboarding") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|brand/|logos/|icons/|api/).*)",
  ],
};
