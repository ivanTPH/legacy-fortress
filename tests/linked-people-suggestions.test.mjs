import test from "node:test";
import assert from "node:assert/strict";
import { loadLinkedPersonSuggestions, reviewLinkedPersonSuggestion } from "../lib/linkedPeople/suggestions.ts";

function syntheticClient({ userId = "owner-1", rpcError = null } = {}) {
  const tables = {
    extraction_suggestions: [
      { id: "suggestion-1", owner_user_id: "owner-1", record_id: "asset-1", document_id: "document-1", page: 3, extracted_name: "Robert Smith", extracted_role: "Executor", match_person_id: "bob", match_kind: "possible", status: "pending" },
      { id: "suggestion-other", owner_user_id: "other", record_id: "asset-1", document_id: "document-other", page: 2, extracted_name: "Private Person", match_kind: "none", status: "pending" },
    ],
    documents: [{ id: "document-1", owner_user_id: "owner-1", asset_id: "asset-1", deleted_at: null, file_name: "Will.pdf" }],
  };
  const rpcCalls = [];
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; }
    eq(field, value) { this.filters.push((row) => row[field] === value); return this; }
    is(field, value) { return this.eq(field, value); }
    in(field, values) { this.filters.push((row) => values.includes(row[field])); return this; }
    order() { return this; }
    then(resolve, reject) { return Promise.resolve({ data: tables[this.table].filter((row) => this.filters.every((filter) => filter(row))), error: null }).then(resolve, reject); }
  }
  return {
    rpcCalls,
    client: {
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
      from(table) { return new Query(table); },
      async rpc(name, args) {
        rpcCalls.push({ name, args });
        return rpcError ? { data: null, error: { message: rpcError } } : { data: [{ person_id: "bob", link_id: "link-1", decision_status: args.p_decision === "dismiss" ? "dismissed" : "edited" }], error: null };
      },
    },
  };
}

test("only owner-record pending suggestions with a readable source document are shown", async () => {
  const { client } = syntheticClient();
  const rows = await loadLinkedPersonSuggestions(client, "owner-1", "asset-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].document_title, "Will.pdf");
  assert.equal(rows[0].match_kind, "possible");
  assert.equal(rows[0].page, 3);
});

test("possible match remains unselected until an explicit owner choice", async () => {
  const { client, rpcCalls } = syntheticClient();
  const base = { ownerUserId: "owner-1", suggestionId: "suggestion-1", decision: "confirm" };
  await assert.rejects(reviewLinkedPersonSuggestion(client, base), /Choose an existing or new person/);
  assert.equal(rpcCalls.length, 0);
  await reviewLinkedPersonSuggestion(client, { ...base, choice: "existing", personId: "bob", role: "Executor" });
  assert.equal(rpcCalls[0].name, "lf_review_linked_person_suggestion");
  assert.equal(rpcCalls[0].args.p_person_id, "bob");
  assert.equal(rpcCalls[0].args.p_email, null);
});

test("new person details are validated before the atomic review request", async () => {
  const { client, rpcCalls } = syntheticClient();
  const base = { ownerUserId: "owner-1", suggestionId: "suggestion-1", decision: "confirm", choice: "new", name: "Priya Nair", role: "Executor" };
  await assert.rejects(reviewLinkedPersonSuggestion(client, { ...base, email: "bad" }), /valid email/);
  assert.equal(rpcCalls.length, 0);
  await reviewLinkedPersonSuggestion(client, { ...base, email: "PRIYA@example.test", phone: "+44 7700 900123" });
  assert.equal(rpcCalls[0].args.p_email, "priya@example.test");
  assert.equal(rpcCalls[0].args.p_phone, "+447700900123");
});

test("dismissal uses the same owner-bound RPC; cross-owner and server failures deny", async () => {
  const { client, rpcCalls } = syntheticClient();
  await reviewLinkedPersonSuggestion(client, { ownerUserId: "owner-1", suggestionId: "suggestion-1", decision: "dismiss" });
  assert.equal(rpcCalls[0].args.p_decision, "dismiss");
  assert.equal(rpcCalls[0].args.p_choice, null);
  const other = syntheticClient({ userId: "other" });
  await assert.rejects(reviewLinkedPersonSuggestion(other.client, { ownerUserId: "owner-1", suggestionId: "suggestion-1", decision: "dismiss" }), /Only the owner/);
  assert.equal(other.rpcCalls.length, 0);
  const failed = syntheticClient({ rpcError: "Vault is locked" });
  await assert.rejects(reviewLinkedPersonSuggestion(failed.client, { ownerUserId: "owner-1", suggestionId: "suggestion-1", decision: "dismiss" }), /Vault is locked/);
});
