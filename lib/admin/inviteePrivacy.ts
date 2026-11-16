/**
 * Owner decision (16 Nov 2026): the people a customer invites are shown in Admin by role and status only, until they
 * create their own account (accept). After that they are customers and appear by name in Customer users.
 * Applied to what the Admin API sends; server-side actions (resend, cancel) still use the stored details.
 */
type InviteeFields = { contactName: string; contactEmail: string | null; invitationStatus?: string | null; acceptedAt?: string | null };

export function hasAccountForInvitation(item: { invitationStatus?: string | null; acceptedAt?: string | null }) {
  return item.invitationStatus === "accepted" || Boolean(item.acceptedAt);
}

export function withoutInviteeIdentity<T extends InviteeFields>(item: T): T & { inviteeHidden: boolean } {
  if (hasAccountForInvitation(item)) return { ...item, inviteeHidden: false };
  return { ...item, contactName: "", contactEmail: "", inviteeHidden: true };
}

/** Audit label for an invitation that never names the invited person. */
export function invitationAuditLabel(invitationId: string) {
  return `Invitation ${invitationId.slice(0, 8)}`;
}
