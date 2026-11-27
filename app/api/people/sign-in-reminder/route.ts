import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { sendSignInReminder } from "@/lib/people/signInReminder";
import { siteBase } from "@/lib/admin/supportActions";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "@/lib/supabaseAdmin";

/** The owner sends a content-free sign-in reminder to someone who accepted their invitation (27 Nov 2026). */
export async function POST(request: Request) {
  const requestUser = await getRequestUser(request);
  if (!requestUser.user) return NextResponse.json({ ok: false, error: requestUser.error }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: getSupabaseAdminConfigIssue() ?? "admin_client_unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { contactId?: string } | null;
  const contactId = String(body?.contactId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return NextResponse.json({ ok: false, error: "We couldn't find that person." }, { status: 400 });
  const base = siteBase();
  const result = await sendSignInReminder(admin, requestUser.user.id, contactId, base);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
