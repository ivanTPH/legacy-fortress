import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("contacts uses grouped collapsible sections as the primary workflow", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");

  assert.match(contactsWorkspace, /Executors/);
  assert.match(contactsWorkspace, /Family/);
  assert.match(contactsWorkspace, /Advisors/);
  assert.match(contactsWorkspace, /Beneficiaries/);
  assert.match(contactsWorkspace, /Trusted contacts/);
  assert.match(contactsWorkspace, /setOpenGroupKey\(\(current\) => \(current === groupKey \? null : groupKey\)\)/);
  assert.match(contactsWorkspace, /Ready to invite/);
  assert.match(contactsWorkspace, /Awaiting acceptance/);
  assert.match(contactsWorkspace, /Invite sent/);
  assert.match(contactsWorkspace, /Missing association/);
  assert.match(contactsWorkspace, /Manage selected contact/);
  assert.match(contactsWorkspace, /<ContactInvitationManager[\s\S]*mode="full"[\s\S]*selectedContactId=\{selectedContactId\}/);
  assert.match(contactsWorkspace, /selectedContactStackStyle/);
  assert.match(contactsWorkspace, /linkedDocumentIconButtonStyle/);
  assert.match(contactsWorkspace, /View linked document for/);
  assert.match(contactsWorkspace, /<DocumentPreviewDialog/);
  assert.match(contactsWorkspace, /No previewable document is currently linked/);
  assert.match(contactsWorkspace, /Unavailable/);
  assert.match(contactsWorkspace, /getPreviewableTargetsForContext/);
  assert.match(contactsWorkspace, /getStoredFileSignedUrl/);
  assert.match(contactsWorkspace, /relatedLabel: relatedHref \? "Open full record" : undefined/);
  assert.match(contactsWorkspace, /describeLinkedDocumentContext/);
  assert.match(contactsWorkspace, /getLinkedDocumentIcon/);
  assert.match(contactsWorkspace, /setDocumentPreview\(null\)/);
  assert.match(contactsWorkspace, /getPrimaryActionLabel/);
  assert.match(contactsWorkspace, /Action required|Missing association/);
  assert.match(contactsWorkspace, /Confirm .* is the correct record/);
  assert.match(contactsWorkspace, /seenContactIds/);
  assert.match(contactsWorkspace, /Cancel .* selection/);
  assert.doesNotMatch(contactsWorkspace, /Review invitations & access/);
  assert.doesNotMatch(contactsWorkspace, /Invitation access review/);
  assert.doesNotMatch(contactsWorkspace, /Edit contact/);
  assert.doesNotMatch(contactsWorkspace, /Selected contact admin/);
});
