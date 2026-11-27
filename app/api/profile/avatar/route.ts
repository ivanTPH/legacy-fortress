import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { AVATAR_BUCKET_CANDIDATES } from "@/lib/profile/workspace";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";
import { saveOwnPhoto } from "@/lib/people/photos";

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

/**
 * Save a photo the signed-in person took or chose (owner, 27 Nov 2026): used by "Add a photo" prompts, e.g. after
 * adding a social media account. Their own account only; JPEG, PNG, WebP or HEIC up to 5 MB.
 */
export async function POST(request: Request) {
  const requestUser = await getRequestUser(request);
  if (!requestUser.user) return NextResponse.json({ ok: false, error: requestUser.error }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: getSupabaseAdminConfigIssue() ?? "admin_client_unavailable" }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Please choose a photo." }, { status: 400 });
  const saved = await saveOwnPhoto(admin, requestUser.user.id, await file.arrayBuffer(), file.type, "upload");
  if (!saved.ok) return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
