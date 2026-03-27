import { NextResponse } from "next/server";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";
import { isMissingColumnError, isMissingRelationError } from "@/lib/supabaseErrors";

export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    const issue = getSupabaseAdminConfigIssue();
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase admin client unavailable",
        issue,
        checks: [],
      },
      { status: 503 },
    );
  }

  const checks: Array<{ key: string; ok: boolean; detail: string }> = [];

  const sectionEntries = await admin.from("section_entries").select("id", { count: "exact", head: true }).limit(1);
  checks.push({
    key: "section_entries",
    ok: !sectionEntries.error,
    detail: sectionEntries.error
      ? isMissingRelationError(sectionEntries.error, "section_entries")
        ? "missing_relation"
        : "query_error"
      : "ok",
  });

  const profileAvatar = await admin.from("user_profiles").select("avatar_path", { head: true }).limit(1);
  checks.push({
    key: "user_profiles.avatar_path",
    ok: !profileAvatar.error,
    detail: profileAvatar.error
      ? isMissingColumnError(profileAvatar.error, "avatar_path")
        ? "missing_column"
        : "query_error"
      : "ok",
  });

  const allOk = checks.every((item) => item.ok);
  return NextResponse.json(
    {
      ok: allOk,
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
