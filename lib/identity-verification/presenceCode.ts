import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateStagingSender } from "../auth/sendEmailHook.ts";

/**
 * Fresh "it's you" check (identity level 3) for the reviewer-check path, owner-approved 30 Oct 2026:
 * a one-time 6-digit code sent to the account's email address. Requires an ID already verified
 * (level 2). The code is stored only as a keyed hash, lasts 10 minutes and allows 5 tries.
 * A correct code gives level 3 for 10 minutes. Phone codes need an SMS provider and aren't built.
 */
const CODE_MINUTES = 10;
const PRESENCE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(userId: string, code: string) {
  const key = String(process.env.IDENTITY_PRESENCE_CODE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  if (!key) throw new Error("presence_code_not_configured");
  return crypto.createHmac("sha256", key).update(`${userId}:${code}`).digest("hex");
}

type AssuranceRow = { user_id: string; identity_level: number; expires_at: string | null; metadata: Record<string, unknown> | null };

async function loadVerified(client: SupabaseClient, userId: string): Promise<AssuranceRow> {
  const row = await client.from("identity_assurance_states").select("user_id,identity_level,expires_at,metadata").eq("user_id", userId).maybeSingle();
  if (row.error) throw new Error(row.error.message);
  const data = row.data as AssuranceRow | null;
  if (!data || Number(data.identity_level) < 2 || (data.expires_at && Date.parse(data.expires_at) <= Date.now())) throw new Error("presence_code_requires_verified_id");
  return data;
}

export async function sendPresenceCode(client: SupabaseClient, user: { id: string; email: string | null | undefined }) {
  if (!user.email) throw new Error("presence_code_email_missing");
  const state = await loadVerified(client, user.id);
  const meta = state.metadata ?? {};
  const lastSent = Date.parse(String(meta.presence_code_sent_at ?? ""));
  if (Number.isFinite(lastSent) && Date.now() - lastSent < RESEND_COOLDOWN_SECONDS * 1000) throw new Error("presence_code_wait_before_resend");
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const update = await client.from("identity_assurance_states").update({
    metadata: { ...meta, presence_code_hash: hashCode(user.id, code), presence_code_expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(), presence_code_attempts: 0, presence_code_sent_at: now.toISOString() },
    updated_at: now.toISOString(),
  }).eq("user_id", user.id);
  if (update.error) throw new Error(update.error.message);

  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
  if (!apiKey) throw new Error("presence_code_email_not_configured");
  const text = `Your Legacy Fortress code is ${code}.\n\nIt lasts ${CODE_MINUTES} minutes. Enter it to confirm it's you.\n\nIf you didn't ask for this, ignore this email and consider changing your password.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-presence/${user.id}/${now.getTime()}` },
    body: JSON.stringify({ from, to: [user.email], subject: `Your Legacy Fortress code: ${code}`, text, html: `<p>Your Legacy Fortress code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It lasts ${CODE_MINUTES} minutes. Enter it to confirm it's you.</p><p>If you didn't ask for this, ignore this email and consider changing your password.</p>` }),
  });
  if (!response.ok) throw new Error(`presence_code_send_failed_${response.status}`);
  return { expiresInMinutes: CODE_MINUTES };
}

export async function verifyPresenceCode(client: SupabaseClient, userId: string, code: string) {
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) throw new Error("presence_code_invalid");
  const state = await loadVerified(client, userId);
  const meta = state.metadata ?? {};
  const attempts = Number(meta.presence_code_attempts ?? 0);
  const expires = Date.parse(String(meta.presence_code_expires_at ?? ""));
  if (!meta.presence_code_hash || !Number.isFinite(expires) || expires <= Date.now()) throw new Error("presence_code_expired");
  if (attempts >= MAX_ATTEMPTS) throw new Error("presence_code_too_many_attempts");
  const expected = Buffer.from(String(meta.presence_code_hash), "hex");
  const given = Buffer.from(hashCode(userId, clean), "hex");
  const now = new Date();
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    await client.from("identity_assurance_states").update({ metadata: { ...meta, presence_code_attempts: attempts + 1 }, updated_at: now.toISOString() }).eq("user_id", userId);
    throw new Error(attempts + 1 >= MAX_ATTEMPTS ? "presence_code_too_many_attempts" : "presence_code_invalid");
  }
  const { presence_code_hash: _hash, presence_code_expires_at: _expires, presence_code_attempts: _attempts, ...rest } = meta;
  void _hash; void _expires; void _attempts;
  const update = await client.from("identity_assurance_states").update({
    presence_reverified_at: now.toISOString(),
    metadata: { ...rest, presence_expires_at: new Date(now.getTime() + PRESENCE_MINUTES * 60_000).toISOString(), presence_method: "email_code" },
    updated_at: now.toISOString(),
  }).eq("user_id", userId);
  if (update.error) throw new Error(update.error.message);
  return { presenceMinutes: PRESENCE_MINUTES };
}
