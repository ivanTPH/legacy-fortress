import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Edge auth redirect is intentionally disabled. Protected route checks happen
  // in app layout/pages using Supabase session validation, not cookie heuristics.
  void request;

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|brand/|logos/|icons/|api/).*)",
  ],
};
