import { ROLE_RULES, type AccessActivationStatus, type CollaboratorRole } from "../access-control/roles.ts";

export type OwnerAccessEligibility =
  | "not_invited"
  | "invitation_pending"
  | "link_required"
  | "verification_required"
  | "executor_restricted"
  | "eligible";

export function resolveOwnerAccessEligibility(input: {
  invitationStatus: string | null | undefined;
  activationStatus: AccessActivationStatus | string | null | undefined;
  linkedUserId?: string | null;
  assignedRole: CollaboratorRole | string | null | undefined;
}): OwnerAccessEligibility {
  if (input.invitationStatus === "not_invited" || !input.invitationStatus) return "not_invited";
  if (input.invitationStatus === "invite_sent" || input.invitationStatus === "pending") return "invitation_pending";
  if (!input.linkedUserId) return "link_required";
  if (input.assignedRole === "executor") return "executor_restricted";
  const role = input.assignedRole as CollaboratorRole;
  if (ROLE_RULES[role]?.requiresVerifiedActivation && !["verified", "active"].includes(String(input.activationStatus ?? ""))) {
    return "verification_required";
  }
  return "eligible";
}
