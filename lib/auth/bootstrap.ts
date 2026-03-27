import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWalletContext, type WalletContext } from "../canonicalPersistence";
import { getOrCreateOnboardingState, getTermsAcceptanceState } from "../onboarding";
import { toSafeInternalPath } from "./session";
import { hasLinkedAccountAccess } from "../access-control/viewerAccess";
import { resolveBootstrapDestination } from "./bootstrapRules";
import { ensureOwnerPlanProfile } from "../accountPlan";

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
    completedDestination = "/dashboard",
  }: {
    userId: string;
    nextPath?: string | null;
    completedDestination?: string;
  },
): Promise<AuthBootstrapResult> {
  const wallet = await ensureWalletContext(client, userId);
  const onboarding = await getOrCreateOnboardingState(client, userId);
  const linkedAccessAvailable = await hasLinkedAccountAccess(client, userId);
  if (!linkedAccessAvailable) {
    await ensureOwnerPlanProfile(client, userId);
  }
  const canBypassOnboarding = linkedAccessAvailable || isInvitationAcceptPath(nextPath);
  const terms = canBypassOnboarding ? null : await getTermsAcceptanceState(client, userId);
  const access = resolveBootstrapDestination({
    nextPath,
    completedDestination,
    canBypassOnboarding,
    onboardingCompleted: onboarding.is_completed,
    termsAccepted: Boolean(terms?.accepted),
  });

  return {
    wallet,
    onboardingComplete: access.onboardingComplete,
    destination: access.destination,
  };
}

function isInvitationAcceptPath(nextPath: string | null | undefined) {
  const safe = toSafeInternalPath(nextPath, "");
  return safe.startsWith("/invite/accept");
}
