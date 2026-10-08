import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("People I Trust uses compact rows with progressive person details", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(contactsWorkspace, /PersonDetailDrawer/);
  assert.match(contactsWorkspace, /lf-person-drawer/);
  assert.match(contactsWorkspace, /InvitationProgressTracker/);
  assert.match(contactsWorkspace, /aria-label=\{`More actions for/);
  assert.doesNotMatch(contactsWorkspace, /CONTACTS BUILD CHECK/);
  assert.doesNotMatch(contactsWorkspace, /Linked to record/);
  assert.doesNotMatch(contactsWorkspace, /Manage selected contact/);
  assert.match(contactsWorkspace, /Friend or family/);
  assert.match(contactsWorkspace, /startAddContact/);
  assert.match(contactsWorkspace, /Add contact/);
  assert.match(contactsWorkspace, /getAddContactPreset/);
  assert.match(contactsWorkspace, /Cancel/);
  assert.match(contactsWorkspace, /<ContactInvitationManager[\s\S]*mode="full"/);

  assert.match(invitationManager, /Add contact/);
  assert.match(invitationManager, /My wallet - all/);
  assert.match(invitationManager, /initialAllowedSections/);
  assert.match(invitationManager, /Send invite/);
  assert.match(invitationManager, /Resend invite/);
  assert.match(invitationManager, /Replace/);
  assert.match(invitationManager, /Remove/);
  assert.match(invitationManager, /Cancel/);
  assert.match(invitationManager, /Save this contact setup/);
  assert.ok(
    invitationManager.indexOf("Save this contact setup") < invitationManager.indexOf("Linked records and document permissions"),
    "contact save controls must appear before expanded linked-record permission details",
  );
  assert.match(invitationManager, /const showInvitationQueue = isDashboardMode;/);
});

test("person presentation keeps relationship, invitation and access distinct", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(contactsWorkspace, /Recorded/);
  assert.match(contactsWorkspace, /Invitation awaiting acceptance/);
  assert.match(contactsWorkspace, /do not have access to your private Vault merely because they are linked/i);
  assert.match(contactsWorkspace, /source_kind !== "invitation"/);
  assert.match(invitationManager, /Being linked does not automatically give this person access/);
  assert.match(invitationManager, /Identity verification does not establish legal authority/);
});
