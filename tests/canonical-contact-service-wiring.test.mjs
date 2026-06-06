import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("invite handling loads and writes through canonical contact services", () => {
  const manager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(manager, /contactRepository/);
  assert.match(manager, /loadPeopleInvitationsForOwner/);
  assert.match(manager, /savePeopleInvitationProjection/);
  assert.match(manager, /savePeopleContact/);
});

test("personal and trust people handoff preserve shared contact identity in contacts", () => {
  const personalContactsRoute = fs.readFileSync(path.join(root, "app/(app)/personal/contacts/page.tsx"), "utf8");
  const trustRoute = fs.readFileSync(path.join(root, "app/(app)/trust/page.tsx"), "utf8");

  assert.match(personalContactsRoute, /params\.set\("contact", selectedContactId\)/);
  assert.match(trustRoute, /params\.set\("contact", selectedContactId\)/);
  assert.match(trustRoute, /params\.set\("group", "trusted-contacts"\)/);
});

test("record-linked people hydrate from canonical contacts instead of local merge logic", () => {
  const workspace = fs.readFileSync(path.join(root, "components/records/UniversalRecordWorkspace.tsx"), "utf8");

  assert.match(workspace, /contactRepository/);
  assert.match(workspace, /hydratePeopleProjectionRows/);
  assert.match(workspace, /replacePeopleRecordContactProjection/);
  assert.doesNotMatch(workspace, /async function mergeRecordContactsWithCanonicalContacts/);
});

test("people contact repository is the compatibility boundary for future contact work", () => {
  const repository = fs.readFileSync(path.join(root, "lib/contacts/contactRepository.ts"), "utf8");

  assert.match(repository, /PeopleContactEntity/);
  assert.match(repository, /PeopleContactRelationshipType/);
  assert.match(repository, /createPeopleContactRepository/);
  assert.match(repository, /PEOPLE_CONTACT_MIGRATION_STRATEGY/);
  assert.match(repository, /SectionWorkspace/);
});
