import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { getProfileAvatarPreview, resolveProfileIdentityDisplayName } from "@/lib/profile/workspace";
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

  const userId = requestUser.user.id;
  const email = requestUser.user.email ?? "";
  const profileRes = await admin
    .from("user_profiles")
    .select("display_name,avatar_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileRes.error) {
    return NextResponse.json({ ok: false, error: profileRes.error.message }, { status: 500 });
  }

  const profile = (profileRes.data ?? null) as {
    display_name?: string | null;
    avatar_path?: string | null;
  } | null;
  const avatar = profile?.avatar_path ? await getProfileAvatarPreview(admin, profile.avatar_path) : null;
  const contactRes = await admin
    .from("contact_details")
    .select("telephone,mobile_number")
    .eq("user_id", userId)
    .maybeSingle();
  const contact = (!contactRes.error ? (contactRes.data ?? null) : null) as {
    telephone?: string | null;
    mobile_number?: string | null;
  } | null;

  return NextResponse.json(
    {
      ok: true,
      displayName: resolveProfileIdentityDisplayName(profile?.display_name, email),
      avatarUrl: avatar?.signedUrl ?? "",
      telephone: String(contact?.telephone ?? contact?.mobile_number ?? "").trim(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
