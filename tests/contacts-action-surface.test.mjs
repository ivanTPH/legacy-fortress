import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("contacts keeps people actions on the shared selected-contact surface", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(contactsWorkspace, /Review documents/);
  assert.match(contactsWorkspace, /Manage/);
  assert.match(contactsWorkspace, /Confirm link/);
  assert.match(contactsWorkspace, /Cancel/);
  assert.match(contactsWorkspace, /<ContactInvitationManager[\s\S]*mode="full"/);

  assert.match(invitationManager, /Add contact/);
  assert.match(invitationManager, /Send invite/);
  assert.match(invitationManager, /Resend invite/);
  assert.match(invitationManager, /Replace/);
  assert.match(invitationManager, /Remove/);
  assert.match(invitationManager, /Cancel/);
  assert.match(invitationManager, /const showInvitationQueue = isDashboardMode;/);
});
