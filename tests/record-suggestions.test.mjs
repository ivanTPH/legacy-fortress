import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("suggest permission is its own owner-only table and never grants viewing", () => {
  const migration = read("supabase/migrations/20261103120000_record_suggestions.sql");
  assert.match(migration, /CREATE TABLE public\.record_suggestion_permissions/);
  assert.match(migration, /record_suggestion_permissions_owner_insert[\s\S]*owner_user_id = auth\.uid\(\)/);
  assert.doesNotMatch(migration, /asset_ids/);
  assert.match(migration, /public\.lf_linked_grant_satisfies_identity\(g\)/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.record_suggestions FROM authenticated/);
  assert.match(migration, /CHECK \(proposer_user_id <> owner_user_id\)/);
  assert.match(migration, /You can’t approve your own suggestion/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.lf_mark_suggestion_applied\(uuid, uuid\) TO service_role/);
  assert.doesNotMatch(migration, /lf_mark_suggestion_applied\(uuid, uuid\) TO authenticated/);
});

test("constraint lists keep every existing kind and action", () => {
  const migration = read("supabase/migrations/20261103120000_record_suggestions.sql");
  for (const kind of ["more_evidence_requested", "attorney_check_requested", "record_link_added", "identity_approved", "early_access_answered"]) assert.match(migration, new RegExp(`'${kind}'`));
  for (const action of ["created", "document_added", "person_unlinked", "access_stopped"]) assert.match(migration, new RegExp(`'${action}'`));
});

test("server decides as the signed-in person; service role only moves files", () => {
  const route = read("app/api/suggestions/[suggestionId]/route.ts");
  const create = read("app/api/suggestions/route.ts");
  const service = read("lib/suggestions/service.ts");
  assert.match(route, /asPerson\.rpc\("lf_approve_suggestion"/);
  assert.match(route, /asPerson\.rpc\("lf_reject_suggestion"/);
  assert.match(route, /asPerson\.rpc\("lf_withdraw_suggestion"/);
  assert.match(create, /asPerson\.rpc\("lf_create_document_suggestion"/);
  assert.match(create, /asPerson\.rpc\("lf_suggestion_targets"\)/);
  assert.doesNotMatch(route + create, /admin\.rpc\("lf_(approve|reject|withdraw|create)/);
  assert.match(service, /admin\.rpc\("lf_mark_suggestion_applied"/);
  assert.match(service, /SUGGESTION_BUCKET = "record-suggestions"/);
});

test("emails and notifications carry no record details", () => {
  const service = read("lib/suggestions/service.ts");
  const copy = read("lib/notifications/personNotifications.ts");
  assert.match(service, /You have an update to review in Legacy Fortress/);
  assert.match(service, /doesn’t include any details/);
  assert.doesNotMatch(service.slice(service.indexOf("export async function sendSuggestionEmail")), /record_title|file_name|asset/);
  for (const kind of ["suggestion_pending", "suggestion_comment", "suggestion_approved", "suggestion_rejected"]) assert.match(copy, new RegExp(`case "${kind}"`));
});

test("owner review follows 7c–7e and the proposer sees only their own suggestion", () => {
  const dialog = read("components/suggestions/SuggestionReviewDialog.tsx");
  const page = read("app/(app)/suggestions/page.tsx");
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  for (const text of ["Review document", "Proposed change", "Nothing else on", "Reject document", "Back to review", "still can’t open the rest of it", "Approved. Added to"]) assert.match(dialog, new RegExp(text));
  for (const text of ["Wrong record", "Wrong document", "Can’t read it", "Other"]) assert.match(read("lib/suggestions/client.ts"), new RegExp(text));
  for (const text of ["Send for approval", "Withdraw suggestion", "Send a new document", "You still can’t open the record", "The file was removed. The history is kept."]) assert.match(page, new RegExp(text));
  assert.match(queue, /Review \$\{first\}’s document/);
  assert.match(queue, /pendingSuggestions/);
});

test("audit trail covers connections, documents, people linked and approvals without content", () => {
  const migration = read("supabase/migrations/20261103150000_audit_trail_coverage.sql");
  for (const trigger of ["contact_invitations_audit_trail", "account_access_grants_connection_audit", "documents_audit_trail", "attachments_audit_trail", "record_links_audit_trail", "record_suggestions_audit_trail", "record_suggestion_comments_audit_trail", "record_suggestion_permissions_audit_trail"]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER ${trigger}`));
  }
  assert.match(migration, /INSERT INTO public\.audit_events/);
  assert.doesNotMatch(migration, /'file_name', |'title', |'full_name', |resource_label/);
  for (const action of ["suggestion_withdrawn", "access_stopped", "document_added"]) assert.match(migration, new RegExp(`'${action}'`));
  assert.match(read("components/admin/AdminControlPlaneWorkspace.tsx"), /key: "vaults", label: "Vaults"/);
});
