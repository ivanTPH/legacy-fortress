import type { SupabaseClient } from "@supabase/supabase-js";

const NON_PRODUCTION_ENVS = new Set(["local", "test", "staging"]);

export function isPasskeyEnrollmentEnabled() {
  if (process.env.NEXT_PUBLIC_PASSKEYS_ENABLED !== "true") return false;
  const appEnv = String(process.env.NEXT_PUBLIC_APP_ENV ?? "").trim().toLowerCase();
  if (!NON_PRODUCTION_ENVS.has(appEnv)) return false;
  if (typeof window !== "undefined" && /legacy-fortress\.vercel\.app|production/i.test(window.location.hostname)) return false;
  return true;
}

export function getPasskeyCapability() {
  return {
    enrollment: true,
    passwordlessSignIn: false,
    freshPresence: "future_authenticator_step_up",
    clientVersion: "2.98.0",
  } as const;
}

export function supportsPasskeyBrowser() {
  return typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function" &&
    "PublicKeyCredential" in window;
}

export async function enrollPasskey(client: SupabaseClient, friendlyName: string) {
  if (!isPasskeyEnrollmentEnabled()) throw new Error("passkey_staging_flag_required");
  if (!supportsPasskeyBrowser()) throw new Error("passkey_browser_not_supported");
  return client.auth.mfa.webauthn.register({
    friendlyName: friendlyName.trim() || "This device",
    webauthn: {
      rpId: window.location.hostname,
      rpOrigins: [window.location.origin],
    },
  });
}
