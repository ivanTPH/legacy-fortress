import { toSafeInternalPath } from "./session.ts";
import { canRoleAccessPath } from "../accessModel.ts";
import type { PlatformRole } from "./platformRoles.ts";

export function resolveBootstrapDestination({
  nextPath,
  completedDestination = "/dashboard",
  canBypassOnboarding,
  onboardingCompleted,
  termsAccepted,
  roles = [],
}: {
  nextPath?: string | null;
  completedDestination?: string;
  canBypassOnboarding: boolean;
  onboardingCompleted: boolean;
  termsAccepted: boolean;
  roles?: PlatformRole[];
}) {
  const destination = resolveAuthorizedDestination(nextPath, completedDestination, roles);

  if (canBypassOnboarding) {
    return {
      onboardingComplete: true,
      destination,
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
    destination,
  };
}

function resolveAuthorizedDestination(
  nextPath: string | null | undefined,
  completedDestination: string,
  roles: readonly PlatformRole[],
) {
  const destination = toSafeInternalPath(nextPath, completedDestination);
  if (!destination.startsWith("/internal/admin")) return destination;
  return canRoleAccessPath(roles, destination) ? destination : completedDestination;
}
