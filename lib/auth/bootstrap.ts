import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWalletContext, type WalletContext } from "../canonicalPersistence";
import { getOrCreateOnboardingState, getTermsAcceptanceState, isCurrentTermsAcceptance } from "../onboarding";
import { hasLinkedAccountAccess } from "../access-control/viewerAccess";
import { isInvitationAcceptPath, resolveBootstrapDestination } from "./bootstrapRules";
import { ensureOwnerPlanProfile } from "../accountPlan";
import { getDefaultLandingForRoles, type PlatformRole } from "./platformRoles";

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
    roles = [],
  }: {
    userId: string;
    nextPath?: string | null;
    completedDestination?: string;
    roles?: PlatformRole[];
  },
): Promise<AuthBootstrapResult> {
  // Speed (23 Nov 2026): these checks don't depend on each other, so they run together instead of one after
  // another (this runs before any signed-in page shows). The terms answer is only used when it's needed.
  const [wallet, onboarding, linkedAccessAvailable, termsState] = await Promise.all([
    ensureWalletContext(client, userId),
    getOrCreateOnboardingState(client, userId),
    hasLinkedAccountAccess(client, userId),
    getTermsAcceptanceState(client, userId).catch(() => null),
  ]);
  if (!linkedAccessAvailable) {
    await ensureOwnerPlanProfile(client, userId);
  }
  const canBypassOnboarding = linkedAccessAvailable || isInvitationAcceptPath(nextPath);
  const terms = canBypassOnboarding ? null : termsState;
  const access = resolveBootstrapDestination({
    nextPath,
    // A person with their own Vault always lands in it; Admin and Partner are opened
    // explicitly (account menu or a next= link) and keep their own server-side checks.
    completedDestination: roles.length > 0 && !onboarding.is_completed ? getDefaultLandingForRoles(roles) : completedDestination,
    canBypassOnboarding,
    onboardingCompleted: onboarding.is_completed,
    termsAccepted: isCurrentTermsAcceptance(terms),
    roles,
  });

  return {
    wallet,
    onboardingComplete: access.onboardingComplete,
    destination: access.destination,
  };
}
