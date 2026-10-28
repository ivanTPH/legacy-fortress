import test from "node:test";
import assert from "node:assert/strict";
import { linkedPeopleConfig, loadRecordLinkedPeople, saveRecordLinkedPerson, sendRecordLinkedPersonInvitation, LinkedPersonRecoveryError, normalizeLinkedPersonEmail, normalizeLinkedPersonPhone } from "../lib/linkedPeople/recordLinkedPeople.ts";
import { createLinkedPeopleFakeClient } from "./helpers/linkedPeopleFakeClient.mjs";

const ownerUserId = "owner-1";
const localOrigin = "http://127.0.0.1:3012";

test("shared roles cover Will, Property and financial records", () => {
  assert.equal(linkedPeopleConfig("legal", "wills")?.action, "Add another executor");
  assert.ok(linkedPeopleConfig("property", "homes")?.roles.includes("Joint owner"));
  assert.ok(linkedPeopleConfig("finances", "bank")?.roles.includes("Joint account holder"));
  assert.ok(linkedPeopleConfig("finances", "insurance")?.roles.includes("Beneficiary"));
  assert.equal(linkedPeopleConfig("personal", "tasks"), null);
});

test("Will journey saves three people independently; inviting is a separate action", async () => {
  const { client, db, writes, seedContact } = createLinkedPeopleFakeClient();
  const bob = seedContact({ id: "bob", full_name: "Bob Smith", email: "bob@example.test", relationship: "Brother" });
  const first = await saveRecordLinkedPerson(client, { ownerUserId, recordType: "record", recordId: "record-1", existingPersonId: bob.id, role: "Executor" });
  const jane = await saveRecordLinkedPerson(client, { ownerUserId, recordType: "record", recordId: "record-1", name: "Jane Doe", email: "jane@example.test", phone: "+447700900123", relationship: "Friend", role: "Reserve executor" });
  const priya = await saveRecordLinkedPerson(client, { ownerUserId, recordType: "record", recordId: "record-1", name: "Priya Nair", relationship: "Cousin", role: "Executor" });
  assert.equal(db.record_links.length, 3);
  assert.equal(db.contacts.length, 3);
  assert.equal(db.contacts.find((row) => row.id === jane.personId)?.phone, "+447700900123");
  assert.equal(db.contacts.find((row) => row.id === priya.personId)?.email, null);
  assert.equal(db.contact_invitations.length, 0, "Save and Invite later must not dispatch");
  const reload = await loadRecordLinkedPeople(client, ownerUserId, "record", "record-1");
  assert.deepEqual(reload.links.map((row) => row.id), [first.linkId, jane.linkId, priya.linkId]);
  assert.equal(reload.accessByPerson[bob.id], "none");
  await assert.rejects(sendRecordLinkedPersonInvitation(client, { ownerUserId, recordType: "record", recordId: "record-1", personId: priya.personId, origin: localOrigin }, async () => { throw new Error("unexpected dispatch"); }), /Add an email/);
  let sends = 0;
  const accepted = await sendRecordLinkedPersonInvitation(client, { ownerUserId, recordType: "record", recordId: "record-1", personId: jane.personId, origin: localOrigin }, async (_client, invitation) => {
    sends++;
    assert.equal(invitation.contactEmail, "jane@example.test");
    assert.equal(invitation.skipLegacyContactLink, true);
    assert.deepEqual(invitation.permissionsOverride.record_ids, []);
    db.contacts.find((row) => row.id === jane.personId).invite_status = "invite_sent";
    return { invitationId: "synthetic-invite", deliveryState: "auth_request_accepted" };
  });
  assert.equal(accepted.deliveryState, "auth_request_accepted");
  await assert.rejects(sendRecordLinkedPersonInvitation(client, { ownerUserId, recordType: "record", recordId: "record-1", personId: jane.personId, origin: localOrigin }, async () => { sends++; }), /already has an active invitation/);
  assert.equal(sends, 1);
  assert.equal(db.record_links.length, 3);
  assert.equal(db.account_access_grants.length, 0);
  assert.ok(writes.every((row) => row.table !== "contact_links" && row.table !== "account_access_grants"));
});

test("same canonical person links to multiple Property and financial assets", async () => {
  const { client, db, seedContact } = createLinkedPeopleFakeClient();
  const person = seedContact({ id: "same-person", full_name: "Sarah Smith" });
  for (const recordId of ["asset-1", "asset-2"]) await saveRecordLinkedPerson(client, { ownerUserId, recordType: "asset", recordId, existingPersonId: person.id, role: "Joint owner" });
  assert.equal(db.contacts.length, 1);
  assert.deepEqual(db.record_links.map((row) => row.record_id), ["asset-1", "asset-2"]);
});

test("failed link retains a recovery ID; retry neither duplicates contact nor link", async () => {
  const { client, db, failNextLink } = createLinkedPeopleFakeClient();
  failNextLink();
  let recoveryId = "";
  try {
    await saveRecordLinkedPerson(client, { ownerUserId, recordType: "asset", recordId: "asset-1", name: "Recovery Person", email: "recover@example.test", role: "Adviser" });
    assert.fail("expected a link failure");
  } catch (error) {
    assert.ok(error instanceof LinkedPersonRecoveryError);
    recoveryId = error.personId;
  }
  const input = { ownerUserId, recordType: "asset", recordId: "asset-1", recoveryPersonId: recoveryId, role: "Adviser" };
  const saved = await saveRecordLinkedPerson(client, input);
  const repeat = await saveRecordLinkedPerson(client, input);
  assert.equal(saved.linkId, repeat.linkId);
  assert.equal(db.contacts.length, 1);
  assert.equal(db.record_links.length, 1);
});

test("duplicate email cannot overwrite a saved person", async () => {
  const { client, db, seedContact } = createLinkedPeopleFakeClient();
  seedContact({ full_name: "Existing Name", email: "same@example.test" });
  await assert.rejects(saveRecordLinkedPerson(client, { ownerUserId, recordType: "asset", recordId: "asset-1", name: "Different Name", email: "SAME@example.test", role: "Adviser" }), /Choose the existing person/);
  assert.equal(db.contacts.length, 1);
  assert.equal(db.contacts[0].full_name, "Existing Name");
  assert.equal(db.record_links.length, 0);
});

test("cross-owner, locked Vault, missing parent and invalid fields deny before writes", async () => {
  const other = createLinkedPeopleFakeClient({ sessionUserId: "other-owner" });
  const locked = createLinkedPeopleFakeClient({ locked: true });
  const open = createLinkedPeopleFakeClient();
  const input = { ownerUserId, recordType: "asset", recordId: "asset-1", name: "New Person", role: "Adviser" };
  await assert.rejects(saveRecordLinkedPerson(other.client, input), /Only the owner/);
  await assert.rejects(saveRecordLinkedPerson(locked.client, input), /Vault is locked/);
  await assert.rejects(saveRecordLinkedPerson(open.client, { ...input, recordId: "missing" }), /saved record is unavailable/);
  await assert.rejects(saveRecordLinkedPerson(open.client, { ...input, recordId: "" }), /Save the record/);
  assert.throws(() => normalizeLinkedPersonEmail("not-an-email"), /valid email/);
  assert.equal(normalizeLinkedPersonPhone("07700 900123"), "07700900123");
  assert.throws(() => normalizeLinkedPersonPhone("call me"), /valid telephone/);
  assert.equal(other.db.contacts.length + locked.db.contacts.length + open.db.contacts.length, 0);
});

test("invitation request failure leaves the saved link and access unchanged", async () => {
  const { client, db, seedContact } = createLinkedPeopleFakeClient();
  const person = seedContact({ full_name: "Invite Failure", email: "failure@example.test" });
  await saveRecordLinkedPerson(client, { ownerUserId, recordType: "asset", recordId: "asset-1", existingPersonId: person.id, role: "Adviser" });
  await assert.rejects(sendRecordLinkedPersonInvitation(client, { ownerUserId, recordType: "asset", recordId: "asset-1", personId: person.id, origin: localOrigin }, async () => { throw new Error("synthetic delivery failure"); }), /synthetic delivery failure/);
  assert.equal(db.record_links.length, 1);
  assert.equal(db.account_access_grants.length, 0);
});
