import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("access_token");
  const fallback = new URL("/sign-in", request.url);
  if (!token) {
    fallback.searchParams.set("error", "session");
    return NextResponse.redirect(fallback);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    fallback.searchParams.set("error", "config");
    return NextResponse.redirect(fallback);
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    fallback.searchParams.set("error", "session");
    return NextResponse.redirect(fallback);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
