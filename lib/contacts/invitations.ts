import { getRoleLabel, buildInvitationAcceptPath } from "../access-control/viewerAccess.ts";
import type { CollaboratorRole } from "../access-control/roles.ts";

export type InvitationEmailDraft = {
  subject: string;
  preview: string;
  bodyText: string;
  acceptPath: string;
};

export function buildInvitationEmailDraft({
  invitationId,
  token,
  assignedRole,
  accountHolderName,
}: {
  invitationId: string;
  token: string;
  assignedRole: CollaboratorRole;
  accountHolderName: string;
}): InvitationEmailDraft {
  const roleLabel = getRoleLabel(assignedRole);
  const safeAccountHolderName = accountHolderName.trim() || "the account holder";
  const acceptPath = buildInvitationAcceptPath(invitationId, token);
  const subject = `You have been invited as ${roleLabel} for ${safeAccountHolderName}`;
  const preview = `${safeAccountHolderName} has invited you to securely connect to their Legacy Fortress.`;
  const bodyText = [
    `${safeAccountHolderName} has invited you to Legacy Fortress as ${roleLabel.toLowerCase()}.`,
    "",
    "Legacy Fortress is a secure digital vault that helps people organise important information about assets, documents, wishes and the people who may need that information in the future.",
    "",
    `Accepting confirms your connection as ${roleLabel.toLowerCase()}. It does not automatically give you access to ${safeAccountHolderName}'s private Vault while they are alive.`,
    "",
    "Any future estate access remains a separate decision and must follow the required permissions, verification and authority process.",
    "",
    "For your security, invitation links can expire. If this link no longer works, ask the account holder to resend the invitation from Legacy Fortress.",
    "",
    `Accept your secure invitation: ${acceptPath}`,
  ].join("\n");

  return {
    subject,
    preview,
    bodyText,
    acceptPath,
  };
}
