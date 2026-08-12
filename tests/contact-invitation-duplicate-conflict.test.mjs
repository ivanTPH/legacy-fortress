import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ACTIVE_CONTACT_INVITATION_STATUSES,
  getExistingContactInvitationNotice,
  getSafeContactInvitationErrorMessage,
  isActiveContactInvitationStatus,
  isDuplicatePendingContactInvitationError,
} from "../lib/contacts/invitationLifecycle.ts";

const root = process.cwd();

test("duplicate pending contact invitation errors are mapped to safe user-facing copy", () => {
  const error = new Error('duplicate key value violates unique constraint "contact_invitations_owner_email_unique_pending_idx"');

  assert.equal(isDuplicatePendingContactInvitationError(error), true);
  assert.equal(isActiveContactInvitationStatus("pending"), true);
  assert.equal(isActiveContactInvitationStatus("accepted"), true);
  assert.equal(isActiveContactInvitationStatus("revoked"), false);
  assert.deepEqual([...ACTIVE_CONTACT_INVITATION_STATUSES], ["pending", "accepted"]);

  const safeMessage = getSafeContactInvitationErrorMessage(error);
  assert.match(safeMessage, /An invitation is already pending for this contact/);
  assert.doesNotMatch(safeMessage, /contact_invitations_owner_email_unique_pending_idx|duplicate key value|SQLSTATE|23505/);
});

test("existing pending and accepted invitations explain the persisted lifecycle state", () => {
  assert.match(getExistingContactInvitationNotice("pending"), /already pending/);
  assert.match(getExistingContactInvitationNotice("pending"), /resend, revoke, or edit access/i);
  assert.match(getExistingContactInvitationNotice("accepted"), /already accepted and linked/);
  assert.equal(getExistingContactInvitationNotice("revoked"), "Contact saved.");
});

test("contact save and send paths resolve active owner/email invitations before inserting", () => {
  const manager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");
  const canonical = fs.readFileSync(path.join(root, "lib/contacts/canonicalContacts.ts"), "utf8");
  const sender = fs.readFileSync(path.join(root, "lib/contacts/sendContactInvite.ts"), "utf8");

  assert.match(manager, /loadExistingInvitationForContact\(userId/);
  assert.match(manager, /contactId: draftContactId \?\? null/);
  assert.doesNotMatch(manager, /\.eq\("assigned_role", assignedRole\)/);
  assert.match(manager, /getSafeContactInvitationErrorMessage\(error\)/);
  assert.match(manager, /getExistingContactInvitationNotice\(managedInvitation\.invitation_status\)/);

  assert.match(canonical, /ACTIVE_CONTACT_INVITATION_STATUSES/);
  assert.match(canonical, /\.eq\("contact_email", contactEmail\)/);
  assert.match(canonical, /\.in\("invitation_status", \[\.\.\.ACTIVE_CONTACT_INVITATION_STATUSES\]\)/);
  assert.match(canonical, /return \{ id: existingInvitationId, existing: true \}/);

  assert.match(sender, /const contactEmail = input\.contactEmail\.trim\(\)\.toLowerCase\(\)/);
  assert.match(sender, /\.eq\("contact_email", contactEmail\)/);
  assert.match(sender, /\.in\("invitation_status", \[\.\.\.ACTIVE_CONTACT_INVITATION_STATUSES\]\)/);
});
