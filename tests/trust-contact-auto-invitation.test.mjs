import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Trust save path automatically sends linked-contact invitations through the shared sender", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /import \{ sendContactInvite \} from "\.\.\/\.\.\/lib\/contacts\/sendContactInvite"/);
  assert.match(workspace, /if \(isTrustsWorkspace && legalContact\.email && SIMPLE_EMAIL_PATTERN\.test\(legalContact\.email\)\)/);
  assert.match(workspace, /sendTrustLinkedContactInvitation/);
  assert.match(workspace, /recordId/);
  assert.match(workspace, /contactId: canonicalContact\.id/);
  assert.match(workspace, /requires_unlock_approval: true/);
  assert.match(workspace, /source: "trust_record_contact"/);
});

test("Trust invitation helper prevents duplicate sends and preserves failed state", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /\.from\("contact_invitations"\)/);
  assert.match(workspace, /\.eq\("contact_id", contactId\)/);
  assert.match(workspace, /\.neq\("invitation_status", "revoked"\)/);
  assert.match(workspace, /alreadySent \|\| existingStatus === "accepted" \|\| existingStatus === "failed"/);
  assert.match(workspace, /return \{ invitationId: String\(existing\.id \?\? ""\) \|\| null, sent: false, skipped: true \}/);
});

test("Shared invitation sender records delivery failure without deleting saved contacts", () => {
  const sender = read("lib/contacts/sendContactInvite.ts");

  assert.match(sender, /markInvitationDeliveryFailed/);
  assert.match(sender, /invitation_status: "failed"/);
  assert.match(sender, /inviteStatus: "failed"/);
  assert.match(sender, /event_type: "failed"/);
  assert.doesNotMatch(sender, /\.delete\(\)[\s\S]*contact_invitations/);
});

test("Trust invite migration supports failed statuses, trustee role, and locked acceptance", () => {
  const migration = read("supabase/migrations/20260710120000_trust_contact_auto_invitation.sql");

  assert.match(migration, /contacts_invite_status_check/);
  assert.match(migration, /'failed'/);
  assert.match(migration, /contact_invitations_role_check[\s\S]*'trustee'/);
  assert.match(migration, /account_access_grants_role_check[\s\S]*'trustee'/);
  assert.match(migration, /copy_role_assignment_permissions_to_grant/);
  assert.match(migration, /requires_unlock_approval/);
  assert.match(migration, /has_linked_account_access/);
  assert.match(migration, /linked_grant_allows_asset/);
});

test("Invitation email copy separates role acceptance from vault/document access", () => {
  const invitationCopy = read("lib/contacts/invitations.ts");

  assert.match(invitationCopy, /Acceptance does not by itself unlock/);
  assert.match(invitationCopy, /private vault, Trust documents, storage links, previews, downloads, or edit rights/);
  assert.match(invitationCopy, /required verification or unlock process/);
  assert.match(invitationCopy, /invitation links can expire/);
  assert.doesNotMatch(invitationCopy, /You will be able to review records, open attachments, and download documents/);
});
