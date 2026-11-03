import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { clientAsUser } from "@/lib/suggestions/service";
import { sendSummaryTo, type SummaryPreference } from "@/lib/summaryEmail/service";

/** GET — the signed-in person's summary frequency. */
export async function GET(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const row = await clientAsUser(request).from("summary_email_preferences").select("frequency,chosen_at,last_sent_at").maybeSingle();
  if (row.error) return NextResponse.json({ ok: false, available: false });
  return NextResponse.json({ ok: true, available: true, frequency: row.data?.frequency ?? "monthly", lastSentAt: row.data?.last_sent_at ?? null });
}

/** POST { frequency } to change it, or { action: "preview" } to email yourself one now (counts only). */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as { frequency?: string; action?: string };
  const asPerson = clientAsUser(request);
  if (body.action === "preview") {
    const row = await access.admin.from("summary_email_preferences").select("user_id,frequency,chosen_at,last_sent_at,unsubscribe_token").eq("user_id", access.user.id).maybeSingle();
    let preference = row.data as SummaryPreference | null;
    if (!preference) {
      const created = await asPerson.rpc("lf_set_summary_frequency", { p_frequency: "monthly" });
      if (created.error) return NextResponse.json({ ok: false, message: "The summary email isn’t available yet." }, { status: 503 });
      preference = (await access.admin.from("summary_email_preferences").select("user_id,frequency,chosen_at,last_sent_at,unsubscribe_token").eq("user_id", access.user.id).maybeSingle()).data as SummaryPreference | null;
    }
    if (!preference) return NextResponse.json({ ok: false, message: "The summary email isn’t available yet." }, { status: 503 });
    const outcome = await sendSummaryTo(access.admin, preference, new Date(), { force: true });
    const message = outcome.sent ? "Sent. Check your inbox." : outcome.reason === "not_deliverable" ? "This account’s email address can’t receive mail." : outcome.reason === "email_not_configured" ? "Email isn’t set up on this server." : "It couldn’t be sent. Try again later.";
    return NextResponse.json({ ok: outcome.sent, message }, { status: outcome.sent ? 200 : 502 });
  }
  const frequency = String(body.frequency ?? "");
  if (!["monthly", "weekly", "off"].includes(frequency)) return NextResponse.json({ ok: false, message: "Choose Monthly, Weekly or Off." }, { status: 400 });
  const saved = await asPerson.rpc("lf_set_summary_frequency", { p_frequency: frequency });
  if (saved.error) return NextResponse.json({ ok: false, message: "That didn’t save. Try again." }, { status: 502 });
  return NextResponse.json({ ok: true, frequency });
}
