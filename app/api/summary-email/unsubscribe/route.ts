import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

/** POST { token } — "Turn off" from the summary email. Only switches the summary off; signs no one in. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });
  const result = await admin.rpc("lf_summary_unsubscribe", { p_token: token });
  return NextResponse.json({ ok: !result.error && result.data === true }, { status: result.error ? 503 : 200 });
}
