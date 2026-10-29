import test from "node:test";
import assert from "node:assert/strict";
import { savePeopleContact } from "../lib/contacts/contactRepository.ts";
import { createLinkedPeopleFakeClient } from "./helpers/linkedPeopleFakeClient.mjs";

test("People can save a canonical contact without email, invitation or access", async () => {
  const { client, db, writes } = createLinkedPeopleFakeClient();
  const person = await savePeopleContact(client, {
    ownerUserId: "owner-1",
    createOnly: true,
    fullName: "Priya Nair",
    email: null,
    phone: "+447700900123",
    relationship: "Cousin",
    contactRole: "friend_or_family",
    sourceType: "manual",
  });
  assert.equal(person.full_name, "Priya Nair");
  assert.equal(person.email, null);
  assert.equal(person.phone, "+447700900123");
  assert.equal(db.contacts.length, 1);
  assert.equal(db.contact_invitations.length, 0);
  assert.equal(db.account_access_grants.length, 0);
  assert.ok(writes.every((entry) => entry.table === "contacts"));
});

test("creating an existing-email contact does not overwrite that person", async () => {
  const { client, db, seedContact } = createLinkedPeopleFakeClient();
  seedContact({ full_name: "Existing Person", email: "same@example.test" });
  await assert.rejects(savePeopleContact(client, {
    ownerUserId: "owner-1", createOnly: true, fullName: "Different Person",
    email: "SAME@example.test", sourceType: "manual",
  }), /already in People/);
  assert.equal(db.contacts.length, 1);
  assert.equal(db.contacts[0].full_name, "Existing Person");
});
