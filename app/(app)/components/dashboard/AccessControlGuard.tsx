import type { ReactNode } from "react";
import {
  canAccessSection,
  shouldObscureSection,
  type AccessActivationStatus,
  type AccessAction,
  type CollaboratorRole,
  type SectionKey,
} from "../../../../lib/access-control/roles";

export default function AccessControlGuard({
  role,
  activationStatus,
  section,
  action,
  children,
  fallback,
  obscured,
}: {
  role: CollaboratorRole;
  activationStatus: AccessActivationStatus;
  section: SectionKey;
  action: AccessAction;
  children: ReactNode;
  fallback?: ReactNode;
  obscured?: ReactNode;
}) {
  if (!canAccessSection(role, section, action, activationStatus)) {
    return <>{fallback ?? null}</>;
  }

  if (shouldObscureSection(role, section, activationStatus)) {
    return <>{obscured ?? fallback ?? null}</>;
  }

  return <>{children}</>;
}
