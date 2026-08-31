import { toSafeInternalPath } from "./session.ts";
import { canRoleAccessPath, isInternalAccessRoute } from "../accessModel.ts";
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

export function isInvitationAcceptPath(nextPath: string | null | undefined) {
  const safe = toSafeInternalPath(nextPath, "");
  return safe.startsWith("/invite/accept") || safe.startsWith("/accept-invitation");
}

function resolveAuthorizedDestination(
  nextPath: string | null | undefined,
  completedDestination: string,
  roles: readonly PlatformRole[],
) {
  const destination = toSafeInternalPath(nextPath, completedDestination);
  if (!isInternalAccessRoute(destination)) return destination;
  return canRoleAccessPath(roles, destination) ? destination : completedDestination;
}
