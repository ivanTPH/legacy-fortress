import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { getContactPhotos } from "@/lib/people/photos";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";

/** The signed-in person's own contacts' photos (only contacts who accepted and linked their account). */
export async function GET(request: Request) {
  const requestUser = await getRequestUser(request);
  if (!requestUser.user) return NextResponse.json({ ok: false, error: requestUser.error }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: getSupabaseAdminConfigIssue() ?? "admin_client_unavailable" }, { status: 503 });
  const photos = await getContactPhotos(admin, requestUser.user.id);
  return NextResponse.json({ ok: true, photos }, { headers: { "Cache-Control": "no-store" } });
}
