import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeliverableAddress } from "../identity-verification/resultEmail.ts";
import { validateStagingSender } from "../auth/sendEmailHook.ts";
import { loadVaultFacts } from "../readiness/vaultFacts.ts";
import { buildNextSteps, emailLines } from "../readiness/nextSteps.ts";
import { normalizeVaultPreferences } from "../vaultPreferences.ts";

/**
 * Monthly summary email (V5.2 m3; AGENTS rule 40). Counts only, a button to the normal sign-in,
 * Change frequency and Turn off links. Never names, record titles, values, documents or sign-in links.
 *
 * Who gets it: people whose frequency is Monthly or Weekly and who have at least one thing to do or
 * update. Until SUMMARY_EMAIL_DEFAULT_SEND=true is set (production, after owner sign-off), only people
 * who chose a frequency themselves are emailed (owner decision 3 Nov 2026: on TEST, only the owner).
 */
export type Frequency = "monthly" | "weekly" | "off";
export type SummaryPreference = { user_id: string; frequency: Frequency; chosen_at: string | null; last_sent_at: string | null; unsubscribe_token: string };

export function periodStart(frequency: Frequency, now: Date) {
  if (frequency === "weekly") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

/** Monthly: once per calendar month, from the 1st. Weekly: once every 7 days. */
export function isDue(preference: Pick<SummaryPreference, "frequency" | "last_sent_at">, now: Date) {
  if (preference.frequency === "off") return false;
  if (!preference.last_sent_at) return true;
  const last = new Date(preference.last_sent_at);
  if (preference.frequency === "weekly") return now.getTime() - last.getTime() >= 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;
  return last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth();
}

export function mayEmail(preference: Pick<SummaryPreference, "chosen_at">, defaultSend = process.env.SUMMARY_EMAIL_DEFAULT_SEND === "true") {
  return defaultSend || Boolean(preference.chosen_at);
}

function plural(count: number, one: string, many: string) { return `${count} ${count === 1 ? one : many}`; }

/**
 * `steps` are the next steps from the shared rule (lib/readiness/nextSteps.ts), in their general email
 * wording: "Remember to invite your executors", never names, records or values (owner decision 4 Nov 2026).
 */
export function renderSummaryEmail(input: { todo: number; updates: number; since: Date; frequency: Frequency; appUrl: string; token: string; steps?: string[] }) {
  const steps = (input.steps ?? []).slice(0, 5);
  const sinceLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(input.since);
  const lines = [
    input.todo ? plural(input.todo, "decision waiting for you", "decisions waiting for you") : null,
    input.updates ? `${plural(input.updates, "update", "updates")} since ${sinceLabel}` : null,
  ].filter(Boolean) as string[];
  const subject = input.frequency === "weekly" ? "Your weekly Legacy Fortress summary" : "Your monthly Legacy Fortress summary";
  const signIn = `${input.appUrl}/sign-in`;
  const change = `${input.appUrl}/account/communications-preferences`;
  const off = `${input.appUrl}/email/summary-off?token=${encodeURIComponent(input.token)}`;
  const text = [
    `Here’s what’s waiting in your Vault: ${lines.join(" and ") || "nothing new"}.`,
    ...(steps.length ? [`Next steps:\n${steps.map((step) => `• ${step}`).join("\n")}`] : []),
    `Sign in to see it: ${signIn}`,
    "For your security this email never includes names, records or values.",
    `Change how often you get this: ${change}`,
    `Turn it off: ${off}`,
  ].join("\n\n");
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2B1714;max-width:520px">
<p style="font-size:17px;font-weight:600;margin:0 0 12px">Here’s what’s waiting in your Vault</p>
<ul style="font-size:16px;line-height:24px;padding-left:20px;margin:0 0 20px">${(lines.length ? lines : ["Nothing new"]).map((line) => `<li>${escape(line)}</li>`).join("")}</ul>
${steps.length ? `<p style="font-size:17px;font-weight:600;margin:0 0 8px">Next steps</p><ul style="font-size:16px;line-height:24px;padding-left:20px;margin:0 0 20px">${steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ul>` : ""}
<p style="margin:0 0 24px"><a href="${escape(signIn)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2B1714;color:#fff;text-decoration:none;font-weight:600">Sign in to Legacy Fortress</a></p>
<p style="font-size:14px;color:#6B5F5A;margin:0 0 16px">For your security this email never includes names, records or values.</p>
<p style="font-size:14px;color:#6B5F5A;margin:0"><a href="${escape(change)}" style="color:#7A3D27">Change frequency</a> · <a href="${escape(off)}" style="color:#7A3D27">Turn off</a></p>
</div>`;
  return { subject, text, html };
}

/** The scheduler signs "<timestamp>" with the server's service key; the key itself is never sent. */
export function signSchedulerRequest(timestamp: string, key: string) {
  return createHmac("sha256", key).update(`lf-summary-email:${timestamp}`).digest("hex");
}

export function verifySchedulerRequest(request: Request, key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""), now = Date.now()) {
  const timestamp = request.headers.get("x-lf-timestamp") ?? "";
  const signature = request.headers.get("x-lf-signature") ?? "";
  if (!key || !/^\d{10,13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const millis = timestamp.length === 13 ? Number(timestamp) : Number(timestamp) * 1000;
  if (Math.abs(now - millis) > 5 * 60 * 1000) return false;
  const expected = Buffer.from(signSchedulerRequest(timestamp, key), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function appBaseUrl() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com").replace(/\/$/, "");
}

export async function sendSummaryTo(admin: SupabaseClient, preference: SummaryPreference, now: Date, options: { force?: boolean } = {}) {
  const frequency: Frequency = preference.frequency === "off" ? "monthly" : preference.frequency;
  const since = periodStart(frequency, now);
  const counts = await admin.rpc("lf_summary_counts", { p_user: preference.user_id, p_since: since.toISOString() });
  const row = Array.isArray(counts.data) ? counts.data[0] as { todo_count: number; update_count: number } : null;
  if (counts.error || !row) return { sent: false, reason: "counts_unavailable" as const };
  // The same next steps the person sees in To do, in general wording.
  const [facts, profile] = await Promise.all([
    loadVaultFacts(admin, preference.user_id).catch(() => null),
    admin.from("user_profiles").select("vault_preferences").eq("user_id", preference.user_id).maybeSingle(),
  ]);
  const steps = facts ? emailLines(buildNextSteps(facts, normalizeVaultPreferences((profile.data as { vault_preferences?: unknown } | null)?.vault_preferences ?? null), now)) : [];
  if (!options.force && row.todo_count + row.update_count === 0 && steps.length === 0) return { sent: false, reason: "nothing_new" as const };
  const user = await admin.auth.admin.getUserById(preference.user_id);
  const email = user.data.user?.email ?? null;
  if (!isDeliverableAddress(email)) return { sent: false, reason: "not_deliverable" as const };
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return { sent: false, reason: "email_not_configured" as const };
  const message = renderSummaryEmail({ todo: row.todo_count, updates: row.update_count, since, frequency, appUrl: appBaseUrl(), token: preference.unsubscribe_token, steps });
  const period = frequency === "weekly" ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 7);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-summary/${preference.user_id}/${options.force ? `preview-${now.getTime()}` : period}` },
    body: JSON.stringify({ from: validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? "")), to: [email], subject: message.subject, text: message.text, html: message.html }),
  }).catch(() => null);
  if (!response?.ok) return { sent: false, reason: "send_failed" as const };
  if (!options.force) await admin.from("summary_email_preferences").update({ last_sent_at: now.toISOString() }).eq("user_id", preference.user_id);
  return { sent: true, reason: "sent" as const };
}

/** Daily run: email everyone due. Returns counts only. */
export async function runSummaryEmails(admin: SupabaseClient, now = new Date()) {
  const defaultSend = process.env.SUMMARY_EMAIL_DEFAULT_SEND === "true";
  const { data, error } = await admin.from("summary_email_preferences").select("user_id,frequency,chosen_at,last_sent_at,unsubscribe_token").neq("frequency", "off").limit(5000);
  if (error) return { ok: false as const, error: "preferences_unavailable" };
  const result = { ok: true as const, considered: 0, sent: 0, skipped: 0 };
  for (const preference of (data ?? []) as SummaryPreference[]) {
    if (!mayEmail(preference, defaultSend) || !isDue(preference, now)) continue;
    result.considered += 1;
    const outcome = await sendSummaryTo(admin, preference, now);
    if (outcome.sent) result.sent += 1; else result.skipped += 1;
  }
  return result;
}
