import test from "node:test";
import assert from "node:assert/strict";
import { linkedPeopleConfig, saveRecordLinkedPerson } from "../lib/linkedPeople/recordLinkedPeople.ts";

function ownerClient(ownerId = "owner-1") {
  const writes = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: ownerId } }, error: null }) },
    from(table) {
      assert.equal(table, "record_links", "linking must not write legacy contact links or grants");
      return {
        insert(payload) {
          writes.push(payload);
          return { select() { return { single: async () => ({ data: { id: `link-${writes.length}` }, error: null }) }; } };
        },
      };
    },
  };
  return { client, writes };
}

test("shared roles are contextual and non-record workspaces are excluded", () => {
  assert.equal(linkedPeopleConfig("legal", "wills")?.action, "Add another executor");
  assert.ok(linkedPeopleConfig("finances", "bank")?.roles.includes("Joint account holder"));
  assert.ok(linkedPeopleConfig("property", "homes")?.roles.includes("Managing agent"));
  assert.equal(linkedPeopleConfig("personal", "tasks"), null);
});

test("owner can link different existing people to one record without creating a grant or invitation", async () => {
  const { client, writes } = ownerClient();
  for (const personId of ["person-a", "person-b"]) {
    await saveRecordLinkedPerson(client, {
      ownerUserId: "owner-1", recordType: "asset", recordId: "asset-1",
      existingPersonId: personId, role: "Joint account holder",
    });
  }
  assert.deepEqual(writes.map((row) => row.person_id), ["person-a", "person-b"]);
  assert.ok(writes.every((row) => row.source === "manual" && row.manual_origin === "people"));
  assert.ok(writes.every((row) => !Object.hasOwn(row, "permissions_override")));
});

test("same person can be linked to a second record independently", async () => {
  const { client, writes } = ownerClient();
  for (const recordId of ["record-1", "record-2"]) {
    await saveRecordLinkedPerson(client, {
      ownerUserId: "owner-1", recordType: "record", recordId,
      existingPersonId: "person-a", role: "Executor",
    });
  }
  assert.deepEqual(writes.map((row) => row.record_id), ["record-1", "record-2"]);
});

test("new contact is saved first, then linked without legacy association or invitation writes", async () => {
  const tables = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } }, error: null }) },
    from(table) {
      tables.push(table);
      if (table === "contacts") return { insert(payload) {
        assert.equal(payload.full_name, "Jane Example");
        return { select() { return { single: async () => ({ data: { id: "new-person", ...payload }, error: null }) }; } };
      } };
      if (table === "record_links") return { insert(payload) {
        assert.equal(payload.person_id, "new-person");
        assert.equal(payload.manual_origin, "new");
        return { select() { return { single: async () => ({ data: { id: "link-1" }, error: null }) }; } };
      } };
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await saveRecordLinkedPerson(client, {
    ownerUserId: "owner-1", recordType: "asset", recordId: "asset-1",
    name: "Jane Example", role: "Executor",
  });
  assert.deepEqual(result, { linkId: "link-1", personId: "new-person" });
  assert.deepEqual(tables, ["contacts", "record_links"]);
});

test("owner binding, saved parent and other-role details are checked before writing", async () => {
  const { client, writes } = ownerClient("different-user");
  await assert.rejects(saveRecordLinkedPerson(client, { ownerUserId: "owner-1", recordType: "asset", recordId: "asset-1", existingPersonId: "person-a", role: "Adviser" }), /Only the owner/);
  const owner = ownerClient();
  await assert.rejects(saveRecordLinkedPerson(owner.client, { ownerUserId: "owner-1", recordType: "asset", recordId: "", existingPersonId: "person-a", role: "Adviser" }), /Save the record/);
  await assert.rejects(saveRecordLinkedPerson(owner.client, { ownerUserId: "owner-1", recordType: "asset", recordId: "asset-1", existingPersonId: "person-a", role: "Other" }), /Enter a role/);
  assert.equal(writes.length, 0);
  assert.equal(owner.writes.length, 0);
});
