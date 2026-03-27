import { getRoleLabel, buildInvitationAcceptPath } from "../access-control/viewerAccess";
import type { CollaboratorRole } from "../access-control/roles";

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
  const preview = `View-only, role-based access has been prepared for ${safeAccountHolderName}'s Legacy Fortress estate record.`;
  const bodyText = [
    `You have been invited as ${roleLabel} for ${safeAccountHolderName}.`,
    "",
    "Legacy Fortress is a secure estate-record workspace that helps families, executors, trustees, and advisors find the records and documents they need when it matters.",
    "",
    "If you accept this invitation, you will receive view-only, role-based access to the records that have been shared with you. You will be able to review records, open attachments, and download documents, but you will not be able to edit or delete anything.",
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
