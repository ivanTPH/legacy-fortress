import type { AccessActivationStatus } from "../access-control/roles";

export type InvitationStatus = "pending" | "accepted" | "rejected" | "revoked";

export function resolveInvitationBadgeState(
  invitationStatus: InvitationStatus,
  activationStatus: AccessActivationStatus,
  sentAt?: string | null,
) {
  if (activationStatus === "active" || activationStatus === "verified") {
    return { tone: "success" as const, label: "Verified" };
  }
  if (invitationStatus === "rejected") {
    return { tone: "danger" as const, label: "Rejected" };
  }
  if (invitationStatus === "revoked") {
    return { tone: "neutral" as const, label: "Revoked" };
  }
  if (!String(sentAt ?? "").trim()) {
    return { tone: "neutral" as const, label: "Ready to send" };
  }
  if (
    activationStatus === "accepted"
    || activationStatus === "pending_verification"
    || activationStatus === "verification_submitted"
    || invitationStatus === "accepted"
  ) {
    return { tone: "success" as const, label: "Accepted" };
  }
  return { tone: "warning" as const, label: "Pending" };
}
