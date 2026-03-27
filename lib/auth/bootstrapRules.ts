import { toSafeInternalPath } from "./session";

export function resolveBootstrapDestination({
  nextPath,
  completedDestination = "/dashboard",
  canBypassOnboarding,
  onboardingCompleted,
  termsAccepted,
}: {
  nextPath?: string | null;
  completedDestination?: string;
  canBypassOnboarding: boolean;
  onboardingCompleted: boolean;
  termsAccepted: boolean;
}) {
  if (canBypassOnboarding) {
    return {
      onboardingComplete: true,
      destination: toSafeInternalPath(nextPath, completedDestination),
    };
  }
  if (!onboardingCompleted) {
    return {
      onboardingComplete: false,
      destination: "/onboarding?required=1",
    };
  }
  if (!termsAccepted) {
    return {
      onboardingComplete: false,
      destination: "/account/terms?required=1",
    };
  }
  return {
    onboardingComplete: true,
    destination: toSafeInternalPath(nextPath, completedDestination),
  };
}
