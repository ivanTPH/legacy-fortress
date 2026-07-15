import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "../env";

export type EphemeralAuthClientPurpose = "signup" | "password-reset";

export function createEphemeralBrowserAuthClient(purpose: EphemeralAuthClientPurpose) {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `legacy-fortress-${purpose}-ephemeral-auth`,
    },
  });
}
