/**
 * Sign-in reminder (owner, 27 Nov 2026). For someone who accepted an invitation and later forgot how to get in:
 * the owner sends a short reminder to the address that person signs in with. Not a new invitation.
 *
 * Content-free like every email we send: it names no person, no Vault and no record, so it is safe if someone else
 * sees it. One per person per day; each one is recorded in invitation_events.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateStagingSender } from "../auth/sendEmailHook.ts";
import { isDeliverableAddress } from "../email/deliverable.ts";

export const REMINDER_EVENT = "sign_in_reminder_sent";
const DAY_MS = 24 * 60 * 60 * 1000;

export function renderSignInReminder(base: string) {
  const signIn = `${base.replace(/\/$/, "")}/sign-in`;
  const forgot = `${base.replace(/\/$/, "")}/forgot-password`;
  return {
    subject: "A reminder: you have access to a Legacy Fortress Vault",
    text: `You accepted an invitation to a Legacy Fortress Vault. Here's how to get back in.\n\nSign in: ${signIn}\nUse the email address this message was sent to.\n\nForgotten your password? Set a new one: ${forgot}\n\nIf you weren't expecting this, you can ignore it.`,
    html: `<p>You accepted an invitation to a Legacy Fortress Vault. Here’s how to get back in.</p><p><a href="${signIn}">Sign in to Legacy Fortress</a><br>Use the email address this message was sent to.</p><p>Forgotten your password? <a href="${forgot}">Set a new one</a>.</p><p>If you weren’t expecting this, you can ignore it.</p>`,
  };
}

type Result = { ok: true } | { ok: false; status: number; error: string };

export async function sendSignInReminder(admin: SupabaseClient, ownerUserId: string, contactId: string, base: string, now = new Date()): Promise<Result> {
  // Only the owner's own contact, and only someone who has accepted and linked their account.
  const contact = await admin.from("contacts").select("id,owner_user_id,linked_user_id").eq("id", contactId).eq("owner_user_id", ownerUserId).maybeSingle();
  const linkedUserId = String((contact.data as { linked_user_id?: string | null } | null)?.linked_user_id ?? "");
  if (contact.error || !contact.data) return { ok: false, status: 404, error: "We couldn't find that person." };
  if (!linkedUserId) return { ok: false, status: 409, error: "This person hasn't accepted an invitation yet. Use Resend invite instead." };

  const invitation = await admin.from("contact_invitations").select("id").eq("owner_user_id", ownerUserId).eq("contact_id", contactId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const invitationId = (invitation.data as { id?: string } | null)?.id ?? null;

  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const recent = await admin.from("invitation_events").select("id").eq("owner_user_id", ownerUserId).eq("event_type", REMINDER_EVENT)
    .contains("payload", { contact_id: contactId }).gte("created_at", since).limit(1);
  if (recent.data?.length) return { ok: false, status: 429, error: "A reminder was sent in the last day. Please wait before sending another." };

  const user = await admin.auth.admin.getUserById(linkedUserId);
  const email = String(user.data?.user?.email ?? "").trim();
  if (!email || !isDeliverableAddress(email)) return { ok: false, status: 409, error: "We can't send a reminder to this person's sign-in address." };

  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return { ok: false, status: 503, error: "Email isn't set up here yet." };
  const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
  const message = renderSignInReminder(base);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-sign-in-reminder/${contactId}/${now.toISOString().slice(0, 10)}` },
    body: JSON.stringify({ from, to: [email], subject: message.subject, text: message.text, html: message.html }),
  }).catch(() => null);
  if (!response?.ok) return { ok: false, status: 502, error: "We couldn't send the reminder. Please try again later." };

  await admin.from("invitation_events").insert({ owner_user_id: ownerUserId, invitation_id: invitationId, event_type: REMINDER_EVENT, payload: { contact_id: contactId } });
  return { ok: true };
}
