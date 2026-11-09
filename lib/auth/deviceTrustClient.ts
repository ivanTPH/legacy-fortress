import { supabase } from "../supabaseClient";

/** Browser side of the new-device check (4 Nov 2026). The token is random; the server keeps only its hash. */
const key = (userId: string) => `lf:device:${userId}`;

function readToken(userId: string) {
  try { return window.localStorage.getItem(key(userId)) ?? ""; } catch { return ""; }
}

export type DeviceTrust = { enforced: boolean; trusted: boolean };

/** Asks the server. If it can't be reached, doesn't block here (the database still enforces it). */
export async function checkDeviceTrust(): Promise<DeviceTrust> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return { enforced: false, trusted: true };
  const token = readToken(session.user.id);
  const response = await fetch("/api/auth/device", { headers: { Authorization: `Bearer ${session.access_token}`, ...(token ? { "x-lf-device": token } : {}) }, cache: "no-store" }).catch(() => null);
  const json = (await response?.json().catch(() => null)) as { enforced?: boolean; trusted?: boolean } | null;
  if (!json) return { enforced: false, trusted: true };
  return { enforced: Boolean(json.enforced), trusted: json.trusted !== false };
}

export async function rememberThisDevice() {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return false;
  const response = await fetch("/api/auth/device", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
  const json = (await response?.json().catch(() => null)) as { token?: string } | null;
  if (!json?.token) return false;
  try { window.localStorage.setItem(key(session.user.id), json.token); } catch { return false; }
  saveReturningVisitor(session.user);
  return true;
}

export async function forgetRememberedDevices() {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return false;
  const response = await fetch("/api/auth/device", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
  try { window.localStorage.removeItem(key(session.user.id)); } catch { /* optional */ }
  clearReturningVisitor();
  return Boolean(response?.ok);
}

/** Where to send someone whose session needs the code, keeping where they were going. */
export function verifyDeviceHref(next: string) {
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/verify-device") ? next : "/dashboard";
  return `/verify-device?next=${encodeURIComponent(safe)}`;
}

/**
 * "Welcome back, Ivan" (owner decision 9 Nov 2026). Kept only on a device the person chose to remember, and
 * only their first name and email, so the sign-in page and website can greet them. Never anything from the Vault.
 */
const RETURNING_KEY = "lf:returning";
export type ReturningVisitor = { firstName: string | null; email: string };

export function saveReturningVisitor(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  if (!user.email) return;
  const first = String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? "").trim();
  try { window.localStorage.setItem(RETURNING_KEY, JSON.stringify({ firstName: first || null, email: user.email })); } catch { /* optional */ }
}

export function readReturningVisitor(): ReturningVisitor | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RETURNING_KEY) ?? "null") as ReturningVisitor | null;
    return parsed && typeof parsed.email === "string" ? parsed : null;
  } catch { return null; }
}

export function clearReturningVisitor() {
  try { window.localStorage.removeItem(RETURNING_KEY); } catch { /* optional */ }
}
