import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWalletContext, type WalletContext } from "../canonicalPersistence";
import { getOrCreateOnboardingState } from "../onboarding";
import { toSafeInternalPath } from "./session";

type AnySupabaseClient = SupabaseClient;

export type AuthBootstrapResult = {
  wallet: WalletContext;
  onboardingComplete: boolean;
  destination: string;
};

export async function bootstrapAuthenticatedUser(
  client: AnySupabaseClient,
  {
    userId,
    nextPath,
    completedDestination = "/app/dashboard",
  }: {
    userId: string;
    nextPath?: string | null;
    completedDestination?: string;
  },
): Promise<AuthBootstrapResult> {
  const wallet = await ensureWalletContext(client, userId);
  const onboarding = await getOrCreateOnboardingState(client, userId);

  return {
    wallet,
    onboardingComplete: onboarding.is_completed,
    destination: onboarding.is_completed
      ? toSafeInternalPath(nextPath, completedDestination)
      : "/app/onboarding",
  };
}
