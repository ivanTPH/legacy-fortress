import type {
  CanonicalContactInviteStatus,
  CanonicalContactVerificationStatus,
} from "./canonicalContacts";

export type ContactStatusTone = "neutral" | "warning" | "success" | "danger";

export function resolveContactStatusBadge({
  email,
  inviteStatus,
  verificationStatus,
}: {
  email?: string | null;
  inviteStatus: CanonicalContactInviteStatus;
  verificationStatus: CanonicalContactVerificationStatus;
}) {
  if (verificationStatus === "active" || verificationStatus === "verified") {
    return { label: "Verified", tone: "success" as ContactStatusTone };
  }

  if (
    verificationStatus === "accepted"
    || verificationStatus === "pending_verification"
    || verificationStatus === "verification_submitted"
    || inviteStatus === "accepted"
  ) {
    return { label: "Accepted", tone: "success" as ContactStatusTone };
  }

  if (inviteStatus === "rejected" || verificationStatus === "rejected") {
    return { label: "Rejected", tone: "danger" as ContactStatusTone };
  }

  if (inviteStatus === "revoked" || verificationStatus === "revoked") {
    return { label: "Revoked", tone: "neutral" as ContactStatusTone };
  }

  if (inviteStatus === "invite_sent" || verificationStatus === "invited") {
    return { label: "Pending", tone: "warning" as ContactStatusTone };
  }

  if (String(email ?? "").trim()) {
    return { label: "Ready to send", tone: "neutral" as ContactStatusTone };
  }

  return { label: "No invite", tone: "neutral" as ContactStatusTone };
}
