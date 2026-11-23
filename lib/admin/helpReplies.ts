import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeliverableAddress } from "../identity-verification/resultEmail.ts";
import { validateStagingSender } from "../auth/sendEmailHook.ts";

/**
 * Replies to Help messages (stage 3, 20 Nov 2026). A customer's message (section_entries · support/help_requests)
 * gets a reply stored as their own row (support/help_replies), written by the service role, so it shows on their
 * Help page and as a to-do in their Inbox until they read it. No migration: owner-only RLS already covers the row.
 * The optional email is content-free: it never includes the message or the reply, only that one is waiting.
 */
export const HELP_REPLY_MAX = 4000;

export type HelpReplyResult =
  | { ok: true; replyId: string; userId: string; emailed: boolean }
  | { ok: false; status: number; message: string };

export function cleanReplyText(value: unknown) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, HELP_REPLY_MAX);
}

export async function sendHelpReply(
  client: SupabaseClient,
  input: { messageId: string; text: string; adminUserId: string; sendEmail?: boolean },
): Promise<HelpReplyResult> {
  const text = cleanReplyText(input.text);
  if (!text) return { ok: false, status: 400, message: "Write a reply first." };
  const original = await client.from("section_entries").select("id,user_id,title,details")
    .eq("id", input.messageId).eq("section_key", "support").eq("category_key", "help_requests").maybeSingle();
  if (original.error || !original.data) return { ok: false, status: 404, message: "That message couldn’t be found." };
  const row = original.data as { id: string; user_id: string; title: string | null; details: Record<string, unknown> | null };
  const now = new Date().toISOString();
  const insert = await client.from("section_entries").insert({
    user_id: row.user_id,
    section_key: "support",
    category_key: "help_replies",
    title: `Re: ${String(row.title ?? "Your message").slice(0, 120)}`,
    summary: text,
    estimated_value: 0,
    // "place" says where the conversation lives: Vault Help, or the Partner Portal's Help (23 Nov 2026).
    details: { reply_to: row.id, replied_by: input.adminUserId, read_at: null, source: "admin_inbox", place: (row.details ?? {}).source === "partner_portal" ? "partner_portal" : "help_page" },
    updated_at: now,
  }).select("id").single();
  if (insert.error || !insert.data) return { ok: false, status: 503, message: "The reply couldn’t be saved. Try again." };
  const replies = Number((row.details ?? {}).reply_count ?? 0) + 1;
  await client.from("section_entries").update({ details: { ...(row.details ?? {}), replied_at: now, reply_count: replies } }).eq("id", row.id);
  let emailed = false;
  if (input.sendEmail !== false) {
    try { emailed = (await sendHelpReplyEmail(client, { userId: row.user_id, replyId: String(insert.data.id), partner: (row.details ?? {}).source === "partner_portal" })).sent; } catch { emailed = false; }
  }
  return { ok: true, replyId: String(insert.data.id), userId: row.user_id, emailed };
}

/** Content-free: says a reply is waiting and where to read it. Never the message, the reply or any Vault detail. */
export function renderHelpReplyEmail(appUrl: string, partner = false) {
  const link = `${appUrl.replace(/\/$/, "")}${partner ? "/enterprise?tab=help#messages" : "/help#messages"}`;
  return {
    subject: "We’ve replied to your message",
    text: `We’ve replied to the message you sent us from Help in Legacy Fortress.\n\nSign in to read it: ${link}`,
    html: `<p>We’ve replied to the message you sent us from Help in Legacy Fortress.</p><p><a href="${link}">Sign in to read it</a></p>`,
  };
}

export async function sendHelpReplyEmail(client: SupabaseClient, input: { userId: string; replyId: string; partner?: boolean }) {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return { sent: false, reason: "not_configured" as const };
  const user = await client.auth.admin.getUserById(input.userId);
  const email = user.data.user?.email ?? null;
  if (!isDeliverableAddress(email)) return { sent: false, reason: "no_deliverable_address" as const };
  const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
  const appUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com");
  const message = renderHelpReplyEmail(appUrl, input.partner === true);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-help-reply/${input.replyId}` },
    body: JSON.stringify({ from, to: [email], subject: message.subject, text: message.text, html: message.html }),
  });
  return { sent: response.ok, reason: response.ok ? null : (`send_failed_${response.status}` as const) };
}

/** Replies already sent, by message id, for the Admin Inbox ("Replied"). */
export async function loadReplyCounts(client: SupabaseClient, messageIds: string[]) {
  const counts = new Map<string, number>();
  if (!messageIds.length) return counts;
  try {
    const { data } = await client.from("section_entries").select("id,details")
      .eq("section_key", "support").eq("category_key", "help_requests").in("id", messageIds.slice(0, 500));
    for (const row of (data ?? []) as Array<{ id: string; details: Record<string, unknown> | null }>) {
      const count = Number((row.details ?? {}).reply_count ?? 0);
      if (count > 0) counts.set(String(row.id), count);
    }
  } catch { /* optional */ }
  return counts;
}
