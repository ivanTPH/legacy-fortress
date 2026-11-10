import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { suggestionIdFromLink, titleWithRecord } from "../lib/notifications/suggestionContext.ts";

const id = "6f9c2a10-1111-4222-8333-444455556666";

test("a suggestion notification names the record it's for, inside the app only", () => {
  assert.equal(suggestionIdFromLink(`/actions?review=${id}`), id);
  const labels = { [id]: "your Power of Attorney" };
  assert.equal(titleWithRecord("suggestion_pending", "Maya Adviser suggested a document", `/actions?review=${id}`, labels), "Maya Adviser suggested a document for your Power of Attorney");
  assert.equal(titleWithRecord("suggestion_comment", "Maya Adviser commented on a suggestion", `/actions?review=${id}`, labels), "Maya Adviser commented on a suggestion about your Power of Attorney");
  assert.equal(titleWithRecord("access_given", "Sam shared records with you", `/actions?review=${id}`, labels), "Sam shared records with you");
  assert.equal(titleWithRecord("suggestion_pending", "Maya Adviser suggested a document", "/actions", labels), "Maya Adviser suggested a document");
});

test("stored notifications still carry no record details; the label is looked up when shown", () => {
  const migration = fs.readFileSync(new URL("../supabase/migrations/20261103120000_record_suggestions.sql", import.meta.url), "utf8");
  assert.match(migration, /notify\(v_owner, 'suggestion_pending', v_me, '\/actions\?review=' \|\| v_id::text\)/);
  // Updates now load in the Inbox (owner, 10 Nov 2026).
  for (const file of ["lib/notifications/inboxUpdates.ts"]) {
    assert.match(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), /loadSuggestionRecordLabels\(supabase/);
  }
  assert.doesNotMatch(fs.readFileSync(new URL("../lib/summaryEmail/service.ts", import.meta.url), "utf8"), /suggestionContext/);
});
