export const ACTIVE_CONTACT_INVITATION_STATUSES = ["pending", "accepted"] as const;

export type ActiveContactInvitationStatus = (typeof ACTIVE_CONTACT_INVITATION_STATUSES)[number];

export function isActiveContactInvitationStatus(status: string | null | undefined): status is ActiveContactInvitationStatus {
  return ACTIVE_CONTACT_INVITATION_STATUSES.includes(String(status ?? "") as ActiveContactInvitationStatus);
}

export function isDuplicatePendingContactInvitationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /contact_invitations_owner_email_unique_pending_idx|duplicate key value|23505/i.test(message);
}

export function getSafeContactInvitationErrorMessage(error: unknown) {
  if (isDuplicatePendingContactInvitationError(error)) {
    return "An invitation is already pending for this contact. Use Resend, Revoke, or edit the existing contact access.";
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export function getExistingContactInvitationNotice(status: string | null | undefined) {
  if (status === "pending") {
    return "An invitation is already pending for this contact. You can resend, revoke, or edit access from the existing row.";
  }
  if (status === "accepted") {
    return "This contact is already accepted and linked. Contact details and access settings were updated.";
  }
  return "Contact saved.";
}
