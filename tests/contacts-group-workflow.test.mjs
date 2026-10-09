import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("contacts uses grouped collapsible sections as the primary workflow", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(contactsWorkspace, /Executors/);
  assert.match(contactsWorkspace, /Family/);
  assert.match(contactsWorkspace, /Advisors/);
  assert.match(contactsWorkspace, /Beneficiaries/);
  assert.match(contactsWorkspace, /Trusted contacts/);
  assert.match(contactsWorkspace, /groupedContacts\.entries\(\)/);
  assert.match(contactsWorkspace, /Ready to invite/);
  assert.match(contactsWorkspace, /Awaiting acceptance/);
  assert.match(contactsWorkspace, /Invite sent/);
  assert.match(contactsWorkspace, /Missing association/);
  assert.match(contactsWorkspace, /Manage relationship/);
  assert.match(contactsWorkspace, /<ContactInvitationManager[\s\S]*mode="full"[\s\S]*initialRole=\{getAddContactPreset\(addContactGroupKey\)\.role\}/);
  assert.match(contactsWorkspace, /function PersonManagementPanel/);
  assert.match(contactsWorkspace, /className="lf-person-more-menu"/);
  assert.doesNotMatch(contactsWorkspace, /<ContactInvitationManager[\s\S]*selectedContactId=\{contact\.id\}/);
  assert.match(contactsWorkspace, /<DocumentPreviewDialog/);
  assert.match(contactsWorkspace, /getPreviewableTargetsForContext/);
  assert.match(contactsWorkspace, /getStoredFileSignedUrl/);
  assert.match(contactsWorkspace, /function PersonManagementPanel/);
  assert.match(contactsWorkspace, /Edit details/);
  assert.match(contactsWorkspace, /Manage access/);
  assert.match(contactsWorkspace, /Remove person/);
  assert.match(contactsWorkspace, /account_access_grants/);
  assert.match(contactsWorkspace, /Invitation cancelled/);
  assert.doesNotMatch(contactsWorkspace, /Review invitations & access/);
  assert.doesNotMatch(contactsWorkspace, /Invitation access review/);
  assert.doesNotMatch(contactsWorkspace, /Edit contact/);
  assert.doesNotMatch(contactsWorkspace, /Selected contact admin/);
  assert.match(invitationManager, /const showInvitationQueue = isDashboardMode;/);
  assert.match(invitationManager, /Resend invite/);
  assert.match(invitationManager, /Remove/);
});
