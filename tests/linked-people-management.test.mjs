import test from "node:test";
import assert from "node:assert/strict";
import { changeRecordLinkedPersonRole, loadRecordLinkedPeople, loadRecordLinkedPeopleHistory, saveRecordLinkedPerson, searchLinkedPeopleContacts, unlinkRecordLinkedPerson } from "../lib/linkedPeople/recordLinkedPeople.ts";
import { buildContactsWorkspaceHref } from "../lib/contacts/contactRouting.ts";
import { mapInvitationStatusToCanonicalInviteStatus } from "../lib/contacts/canonicalContacts.ts";
import { createLinkedPeopleFakeClient } from "./helpers/linkedPeopleFakeClient.mjs";

const ownerUserId = "owner-1";

test("visible contact matches are selectable without a second search step", () => {
  const people = [
    { id: "one", full_name: "Maya Hale", email: "maya@example.test", phone: "07700 900123" },
    { id: "two", full_name: "Amir Cole", email: "amir@example.test", phone: null },
  ];
  assert.deepEqual(searchLinkedPeopleContacts(people, new Set(), "maya").map((person) => person.id), ["one"]);
  assert.deepEqual(searchLinkedPeopleContacts(people, new Set(), "900123").map((person) => person.id), ["one"]);
  assert.deepEqual(searchLinkedPeopleContacts(people, new Set(["one"]), "").map((person) => person.id), ["two"]);
  assert.equal(buildContactsWorkspaceHref("one", true), "/people-access?contact=one&view=people&access=1");
});

test("delivery and expiry states remain distinct from invitation acceptance", () => {
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("not_delivered"), "not_delivered");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("delivery_failed"), "not_delivered");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("expired"), "expired");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("accepted"), "accepted");
});

test("switching to an existing contact does not let an abandoned new-person draft block save", async () => {
  const { client, db, seedContact } = createLinkedPeopleFakeClient();
  const person = seedContact({ id: "person-a", full_name: "Maya Hale", email: "maya@example.test" });
  await saveRecordLinkedPerson(client, { ownerUserId, recordType: "asset", recordId: "asset-1", existingPersonId: person.id, name: "Abandoned draft", email: "invalid-email", phone: "invalid-phone", role: "Adviser" });
  assert.equal(db.contacts.length, 1);
  assert.equal(db.record_links[0].person_id, person.id);
});

test("role edits and unlink are owner-scoped, auditable and do not alter contact or access", async () => {
  const { client, db, writes, seedContact } = createLinkedPeopleFakeClient();
  const person = seedContact({ id: "person-a", full_name: "Maya Hale", email: "maya@example.test", relationship: "Sister" });
  const first = await saveRecordLinkedPerson(client, { ownerUserId, recordType: "record", recordId: "record-1", existingPersonId: person.id, role: "Executor" });
  await saveRecordLinkedPerson(client, { ownerUserId, recordType: "record", recordId: "record-2", existingPersonId: person.id, role: "Solicitor" });
  await changeRecordLinkedPersonRole(client, { ownerUserId, recordType: "record", recordId: "record-1", linkId: first.linkId, role: "Reserve executor" });
  assert.equal(db.record_links.find((row) => row.id === first.linkId).role, "Reserve executor");
  assert.equal(db.record_links.find((row) => row.record_id === "record-2").role, "Solicitor");
  assert.equal(db.contacts[0].relationship, "Sister");
  await unlinkRecordLinkedPerson(client, { ownerUserId, recordType: "record", recordId: "record-1", linkId: first.linkId });
  assert.equal((await loadRecordLinkedPeople(client, ownerUserId, "record", "record-1")).links.length, 0);
  assert.equal((await loadRecordLinkedPeople(client, ownerUserId, "record", "record-2")).links.length, 1);
  assert.equal(db.contacts.length, 1);
  assert.ok(db.record_links.find((row) => row.id === first.linkId).removed_at);
  assert.deepEqual((await loadRecordLinkedPeopleHistory(client, { ownerUserId, recordType: "record", recordId: "record-1" })).map((event) => event.action), ["link.removed", "link.role_changed", "link.created"]);
  assert.equal(db.account_access_grants.length, 0);
  assert.ok(writes.every((write) => !["contacts", "account_access_grants", "contact_links"].includes(write.table)));
});

test("locked Vault and other-owner sessions cannot edit, unlink or read history", async () => {
  for (const options of [{ locked: true }, { sessionUserId: "other-owner" }]) {
    const { client, db, seedContact } = createLinkedPeopleFakeClient(options);
    const person = seedContact({ id: "person-a", full_name: "Maya Hale" });
    db.record_links.push({ id: "link-a", owner_user_id: ownerUserId, record_type: "asset", record_id: "asset-1", person_id: person.id, role: "Adviser", role_other_text: null, removed_at: null });
    const input = { ownerUserId, recordType: "asset", recordId: "asset-1", linkId: "link-a" };
    await assert.rejects(changeRecordLinkedPersonRole(client, { ...input, role: "Other", roleOtherText: "Broker" }), /Only the owner|Vault is locked/);
    await assert.rejects(unlinkRecordLinkedPerson(client, input), /Only the owner|Vault is locked/);
    if (options.sessionUserId) await assert.rejects(loadRecordLinkedPeopleHistory(client, input), /Only the owner/);
    assert.equal(db.record_links[0].removed_at, null);
    assert.equal(db.record_links[0].role, "Adviser");
  }
});
