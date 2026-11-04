import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * New-device check (owner decision 4 Nov 2026), server side. Mirrors public.lf_session_trusted(): the
 * database is what actually enforces it; this decides whether the app should ask for the emailed code.
 */
export type SessionClaims = { sessionId: string | null; aal: string | null; methods: string[] };

const TRUSTED_METHODS = new Set(["otp", "magiclink", "email/signup", "invite", "recovery", "email_change", "oauth", "sso/saml", "totp", "webauthn", "passkey"]);

export function readSessionClaims(token: string): SessionClaims {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: string; aal?: string; amr?: Array<{ method?: string }> };
    return { sessionId: payload.session_id ?? null, aal: payload.aal ?? null, methods: (payload.amr ?? []).map((entry) => String(entry.method ?? "")) };
  } catch {
    return { sessionId: null, aal: null, methods: [] };
  }
}

/** Trusted by how it signed in: two-step, an emailed code or link, OAuth or a passkey. */
export function trustedBySignIn(claims: SessionClaims) {
  return claims.aal === "aal2" || claims.methods.some((method) => TRUSTED_METHODS.has(method));
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function newDeviceCheckOn(admin: SupabaseClient) {
  const row = await admin.from("lf_security_switches").select("new_device_check").eq("id", true).maybeSingle();
  return Boolean(row.data?.new_device_check);
}

export function hashDeviceToken(userId: string, token: string) {
  const key = String(process.env.DEVICE_TRUST_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  return key ? createHmac("sha256", key).update(`${userId}:${token}`).digest("hex") : createHash("sha256").update(`${userId}:${token}`).digest("hex");
}

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

/** A short, non-identifying label for Settings › Security ("iPhone · Safari"). */
export function deviceLabel(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const device = /iphone/.test(ua) ? "iPhone" : /ipad/.test(ua) ? "iPad" : /android/.test(ua) ? "Android" : /mac os/.test(ua) ? "Mac" : /windows/.test(ua) ? "Windows" : "This device";
  const browser = /edg\//.test(ua) ? "Edge" : /chrome\//.test(ua) && !/edg\//.test(ua) ? "Chrome" : /safari\//.test(ua) ? "Safari" : /firefox\//.test(ua) ? "Firefox" : "";
  return browser ? `${device} · ${browser}` : device;
}

/**
 * Server routes read data with the server key, which the database's new-device rule can't see. So every
 * route that serves Vault data checks the session here too (4 Nov 2026). Mirrors lf_session_trusted().
 */
export async function sessionIsTrusted(admin: SupabaseClient, request: Request, userId: string) {
  if (!(await newDeviceCheckOn(admin))) return true;
  const claims = readSessionClaims(bearerToken(request));
  if (trustedBySignIn(claims)) return true;
  if (!claims.sessionId) return false;
  const known = await admin.from("trusted_sessions").select("session_id").eq("session_id", claims.sessionId).eq("user_id", userId).maybeSingle();
  return Boolean(known.data);
}
