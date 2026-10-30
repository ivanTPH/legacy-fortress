import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("one-step save, Undo, re-review and private details only switch on when the migrations are live", () => {
  const section = read("components/records/LinkedPeopleSection.tsx");
  const service = read("lib/linkedPeople/recordLinkedPeople.ts");
  assert.match(service, /from\("record_link_requests"\)\.select\("request_id"\)\.limit\(1\)/);
  assert.match(section, /if \(v2 && !recoveryPersonId\)/);
  assert.match(section, /requestIdRef\.current = crypto\.randomUUID\(\)/);
  assert.match(section, /setTimeout\(\(\) => \{ setUndoExpired\(true\)/);
  assert.match(section, /10_000/);
  assert.match(section, /Only you can see these\. They are never shown to this person\./);
});

test("address and notes are written to the owner-only table, never the contact row a linked person can read", () => {
  const service = read("lib/linkedPeople/recordLinkedPeople.ts");
  assert.match(service, /from\("contact_private_details"\)\.upsert/);
  const migration = read("supabase/migrations/20261030090200_contacts_address_notes.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.contact_private_details/);
  assert.doesNotMatch(migration, /ALTER TABLE public\.contacts\s+ADD COLUMN/);
});

test("Undo and re-review never resurrect a removed link or change a decided suggestion", () => {
  const migration = read("supabase/migrations/20261030090100_linked_people_undo_and_rereview.sql");
  assert.match(migration, /restored_from_link_id/);
  assert.match(migration, /reopened_from_suggestion_id/);
  assert.doesNotMatch(migration, /UPDATE public\.record_links SET removed_at = NULL/i);
  assert.doesNotMatch(migration, /UPDATE public\.extraction_suggestions SET status = 'pending'/i);
});

test("Legal record attachments get suggestions through the same owner-checked endpoint", () => {
  const route = read("app/api/documents/[documentId]/extract/route.ts");
  assert.match(route, /from\("attachments"\)[\s\S]*\.eq\("owner_user_id", user\.id\)/);
  assert.match(route, /from\("records"\)[\s\S]*\.eq\("owner_user_id", user\.id\)/);
  assert.match(route, /record_type: "record", attachment_id: documentId/);
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /startDocumentExtraction\(\(insertResult\.data as \{ id\?: string \} \| null\)\?\.id, recordId, "attachment"\)/);
});

test("new-record forms use the People section instead of inline contact fields (V5.2 rule 48)", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /\{!isTrustedContacts && !canShowLinkedPeople \? \(/);
});

test("provider logos match whole words, so 'extraction' is not X", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /Whole words only: a one-letter term such as "x" must not match "extraction"\./);
  const matches = (normalized, term) => normalized === term || new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(normalized);
  assert.equal(matches("synthetic will (extraction test)", "x"), false);
  assert.equal(matches("my x account", "x"), true);
  assert.equal(matches("barclays savings", "barclays"), true);
});
