import type { SupabaseClient } from "@supabase/supabase-js";
import { validateStagingSender } from "../auth/sendEmailHook.ts";

/**
 * Tells the person the result of their ID check by email (owner approval, 2 Nov 2026), alongside
 * the in-app notification. Best effort: a failed email never changes the decision. No photos,
 * scores or reasons are included, only the outcome and where to look.
 */
export type IdentityResult = "verified" | "not_verified";

/** Synthetic test addresses are never emailed. */
export function isDeliverableAddress(email: string | null | undefined) {
  const address = String(email ?? "").trim().toLowerCase();
  if (!address.includes("@")) return false;
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return !/(^|\.)(test|example|invalid|localhost)$/.test(domain) && !/^example\.(com|org|net)$/.test(domain);
}

export function renderIdentityResultEmail(result: IdentityResult, appUrl: string) {
  const link = `${appUrl.replace(/\/$/, "")}/profile`;
  if (result === "verified") {
    return {
      subject: "Your ID is verified",
      text: `Your ID check for Legacy Fortress is complete and your ID is verified. It lasts a year.\n\nYou don't need to do anything else. Being verified doesn't give anyone access to your Vault.\n\nSee it in Settings › Profile: ${link}`,
      html: `<p>Your ID check for Legacy Fortress is complete and <strong>your ID is verified</strong>. It lasts a year.</p><p>You don't need to do anything else. Being verified doesn't give anyone access to your Vault.</p><p><a href="${link}">See it in Settings › Profile</a></p>`,
    };
  }
  return {
    subject: "We couldn't verify your ID",
    text: `We couldn't verify your ID from the photos you sent. This often happens with glare, a blurred photo or glasses.\n\nYou can try again in Settings › Profile: ${link}\n\nYour photos have been deleted.`,
    html: `<p>We couldn't verify your ID from the photos you sent. This often happens with glare, a blurred photo or glasses.</p><p><a href="${link}">Try again in Settings › Profile</a></p><p>Your photos have been deleted.</p>`,
  };
}

export async function sendIdentityResultEmail(client: SupabaseClient, input: { userId: string; requestId: string; result: IdentityResult }) {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return { sent: false, reason: "not_configured" as const };
  const user = await client.auth.admin.getUserById(input.userId);
  const email = user.data.user?.email ?? null;
  if (!isDeliverableAddress(email)) return { sent: false, reason: "no_deliverable_address" as const };
  const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
  const appUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com");
  const message = renderIdentityResultEmail(input.result, appUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-idv-result/${input.requestId}/${input.result}` },
    body: JSON.stringify({ from, to: [email], subject: message.subject, text: message.text, html: message.html }),
  });
  return { sent: response.ok, reason: response.ok ? null : (`send_failed_${response.status}` as const) };
}
