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
  const preview = `View-only, role-based access has been prepared for ${safeAccountHolderName}'s Legacy Fortress estate record.`;
  const bodyText = [
    `You have been invited as ${roleLabel} for ${safeAccountHolderName}.`,
    "",
    "Legacy Fortress is a secure estate-record workspace that helps families, executors, trustees, and advisors find the records and documents they need when it matters.",
    "",
    "If you accept this invitation, Legacy Fortress records that you accept the named role. Acceptance does not by itself unlock the account holder's private vault, Trust documents, storage links, previews, downloads, or edit rights.",
    "",
    "Any future vault or document access remains separate and must follow the account holder's permissions and the required verification or unlock process.",
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
