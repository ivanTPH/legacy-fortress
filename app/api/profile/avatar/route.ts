import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { AVATAR_BUCKET_CANDIDATES } from "@/lib/profile/workspace";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const requestUser = await getRequestUser(request);
  if (!requestUser.user) {
    return NextResponse.json({ ok: false, error: requestUser.error }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: getSupabaseAdminConfigIssue() ?? "admin_client_unavailable" },
      { status: 503 },
    );
  }

  const profileRes = await admin
    .from("user_profiles")
    .select("avatar_path")
    .eq("user_id", requestUser.user.id)
    .maybeSingle();

  if (profileRes.error) {
    return NextResponse.json({ ok: false, error: profileRes.error.message }, { status: 500 });
  }

  const avatarPath = String((profileRes.data as { avatar_path?: string | null } | null)?.avatar_path ?? "").trim();
  if (!avatarPath) {
    return NextResponse.json({ ok: false, error: "avatar_not_found" }, { status: 404 });
  }

  for (const bucket of AVATAR_BUCKET_CANDIDATES) {
    const file = await admin.storage.from(bucket).download(avatarPath);
    if (!file.error && file.data) {
      return new Response(file.data, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": file.data.type || "image/jpeg",
        },
      });
    }
  }

  return NextResponse.json({ ok: false, error: "avatar_file_unavailable" }, { status: 404 });
}
