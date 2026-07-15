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
        : getSafeSchemaErrorDetail(sectionEntries.error)
      : "ok",
  });

  const profileAvatar = await admin.from("user_profiles").select("avatar_path", { head: true }).limit(1);
  checks.push({
    key: "user_profiles.avatar_path",
    ok: !profileAvatar.error,
    detail: profileAvatar.error
      ? isMissingColumnError(profileAvatar.error, "avatar_path")
        ? "missing_column"
        : getSafeSchemaErrorDetail(profileAvatar.error)
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

function getSafeSchemaErrorDetail(error: { status?: number; code?: string; message?: string }) {
  const status = Number(error.status ?? 0);
  const code = String(error.code ?? "").trim().toUpperCase();
  const message = String(error.message ?? "").toLowerCase();

  if (status === 401 || status === 403 || message.includes("jwt") || message.includes("signature")) {
    return "authentication_failed";
  }

  if (status >= 500 || message.includes("fetch failed") || message.includes("connection")) {
    return "supabase_unreachable";
  }

  if (code.startsWith("42") || message.includes("schema cache")) {
    return "migration_mismatch";
  }

  return "query_failed";
}
