import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("invite handling loads and writes through canonical contact services", () => {
  const manager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(manager, /loadCanonicalContactInvitationsForOwner/);
  assert.match(manager, /upsertCanonicalContactInvitationProjection/);
  assert.match(manager, /syncCanonicalContact/);
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

  assert.match(workspace, /hydrateProjectionRowsWithCanonicalContacts/);
  assert.match(workspace, /replaceCanonicalRecordContactProjection/);
  assert.doesNotMatch(workspace, /async function mergeRecordContactsWithCanonicalContacts/);
});
