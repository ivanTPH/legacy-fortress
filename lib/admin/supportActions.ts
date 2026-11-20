import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeliverableAddress } from "../identity-verification/resultEmail.ts";
import { validateStagingSender } from "../auth/sendEmailHook.ts";

/**
 * Support actions on a customer's account (owner decision 20 Nov 2026): low-risk help only, for support agents and
 * super admins (support:manage), each with a written reason and an audit entry.
 *  - resend_confirmation: send the sign-up confirmation email again (only while the email isn't confirmed).
 *  - password_reset: send a password reset link to the customer's own email address.
 *  - sign_out_everywhere: end every session (e.g. a lost phone) and forget remembered devices, so the next
 *    sign-in on any device needs the emailed code. The customer gets a short email saying so.
 * Staff never see a password, a link or Vault content, and can't choose where an email goes. Locking accounts,
 * changing plans and restoring records were not approved and don't exist here.
 */
export const SUPPORT_ACTIONS = ["resend_confirmation", "password_reset", "sign_out_everywhere"] as const;
export type SupportAction = (typeof SUPPORT_ACTIONS)[number];

export const SUPPORT_ACTION_COPY: Record<SupportAction, { label: string; done: string; audit: string; confirm: string }> = {
  resend_confirmation: {
    label: "Resend confirmation email",
    done: "Confirmation email sent to the customer’s address.",
    audit: "Support: confirmation email resent",
    confirm: "We’ll send the sign-up confirmation email again to the address on the account.",
  },
  password_reset: {
    label: "Send password reset link",
    done: "Password reset link sent to the customer’s address.",
    audit: "Support: password reset link sent",
    confirm: "We’ll email a password reset link to the address on the account. You won’t see the link.",
  },
  sign_out_everywhere: {
    label: "Sign out on every device",
    done: "Signed out everywhere. Remembered devices are forgotten, so their next sign-in needs the emailed code.",
    audit: "Support: signed out on every device",
    confirm: "Every device signed in to this account will be signed out within the hour, and remembered devices are forgotten. Their password and Vault are unchanged.",
  },
};

export const REASON_MIN = 5;
export const REASON_MAX = 500;
/** No more than this many of one action on one account per hour, so a mistake can't flood a customer's inbox. */
export const HOURLY_LIMIT = 3;

export type SupportActionResult =
  | { ok: true; action: SupportAction; message: string; emailed: boolean; sessionsEnded?: number }
  | { ok: false; status: number; message: string };

export function isSupportAction(value: unknown): value is SupportAction {
  return SUPPORT_ACTIONS.includes(value as SupportAction);
}

export function cleanReason(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
}

export function siteBase() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com").replace(/\/$/, "");
}

/** Whether an action makes sense for this account right now; the reason is shown beside a disabled button. */
export function availability(action: SupportAction, user: { email?: string | null; email_confirmed_at?: string | null }) {
  const email = String(user.email ?? "");
  if (action === "resend_confirmation" && user.email_confirmed_at) return { available: false, reason: "Their email is already confirmed." };
  if (action !== "sign_out_everywhere" && !email) return { available: false, reason: "No email address on the account." };
  if (action !== "sign_out_everywhere" && !isDeliverableAddress(email)) return { available: false, reason: "Test address: no email is sent." };
  return { available: true, reason: "" };
}

export async function runSupportAction(
  client: SupabaseClient,
  input: { userId: string; action: SupportAction; recentCount?: number },
): Promise<SupportActionResult> {
  if ((input.recentCount ?? 0) >= HOURLY_LIMIT) {
    return { ok: false, status: 429, message: "This was done 3 times in the last hour. Try again later." };
  }
  const found = await client.auth.admin.getUserById(input.userId);
  const user = found.data.user;
  if (found.error || !user) return { ok: false, status: 404, message: "That account couldn’t be found." };
  const check = availability(input.action, user);
  if (!check.available) return { ok: false, status: 409, message: check.reason };
  const email = String(user.email ?? "");
  const base = siteBase();

  if (input.action === "resend_confirmation") {
    const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${base}/auth/callback?next=%2Fdashboard` } });
    if (error) return { ok: false, status: 503, message: "The email couldn’t be sent. Try again in a few minutes." };
    return { ok: true, action: input.action, message: SUPPORT_ACTION_COPY[input.action].done, emailed: true };
  }
  if (input.action === "password_reset") {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${base}/reset-password` });
    if (error) return { ok: false, status: 503, message: "The email couldn’t be sent. Try again in a few minutes." };
    return { ok: true, action: input.action, message: SUPPORT_ACTION_COPY[input.action].done, emailed: true };
  }

  const ended = await client.rpc("lf_admin_sign_out_everywhere", { p_user_id: input.userId });
  if (ended.error) {
    const missing = /lf_admin_sign_out_everywhere|function .* does not exist|PGRST202/i.test(`${ended.error.message} ${ended.error.code ?? ""}`);
    return { ok: false, status: 503, message: missing ? "Signing out everywhere isn’t switched on yet (it needs a database update)." : "Couldn’t sign them out. Try again." };
  }
  await client.from("trusted_devices").delete().eq("user_id", input.userId);
  await client.from("trusted_sessions").delete().eq("user_id", input.userId);
  let emailed = false;
  if (isDeliverableAddress(email)) {
    try { emailed = await sendSignedOutEmail(email, input.userId); } catch { emailed = false; }
  }
  return { ok: true, action: input.action, message: SUPPORT_ACTION_COPY[input.action].done, emailed, sessionsEnded: Number(ended.data ?? 0) };
}

/** Content-free: says they were signed out and what to do if they didn't ask for it. */
export function renderSignedOutEmail(base: string) {
  return {
    subject: "You’ve been signed out of Legacy Fortress",
    text: `We’ve signed you out of Legacy Fortress on every device. Your Vault and password haven’t changed.\n\nWhen you next sign in, we’ll email you a code to check it’s you.\n\nIf you didn’t ask for this, tell us from Help: ${base}/help`,
    html: `<p>We’ve signed you out of Legacy Fortress on every device. Your Vault and password haven’t changed.</p><p>When you next sign in, we’ll email you a code to check it’s you.</p><p>If you didn’t ask for this, tell us from <a href="${base}/help">Help</a>.</p>`,
  };
}

async function sendSignedOutEmail(email: string, userId: string) {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return false;
  const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
  const message = renderSignedOutEmail(siteBase());
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-signed-out/${userId}/${Math.floor(Date.now() / 60000)}` },
    body: JSON.stringify({ from, to: [email], subject: message.subject, text: message.text, html: message.html }),
  });
  return response.ok;
}
