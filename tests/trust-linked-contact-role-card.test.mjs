import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Trust linked people render as a table on the visible record card instead of inline text", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  const css = read("app/globals.css");

  assert.match(workspace, /const linkedContactsTable =/);
  assert.match(workspace, /aria-label="Linked contacts for this record"/);
  assert.match(workspace, /\{legalLinkedContactDefinition \? linkedContactsTable : null\}/);
  assert.match(workspace, /getRecordContactInviteLabel\(inviteState\)/);
  assert.match(workspace, /getRecordContactVaultAccessState\(item\)/);
  assert.match(workspace, /Vault access: Locked/);
  assert.match(css, /\.lf-linked-contact-table-wrap[\s\S]*margin-top: 12px[\s\S]*border: 0[\s\S]*background: transparent/);
  assert.match(css, /\.lf-linked-contact-table[\s\S]*min-width: 760px/);
  assert.match(css, /\.lf-record-vault-status/);
  assert.doesNotMatch(workspace, /className="lf-linked-person-summary"/);
  assert.doesNotMatch(workspace, /item\.contact_email \? ` · \$\{item\.contact_email\}`/);
});

test("expanded Trust linked contacts use a compact table with labelled status columns and edit mode", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  const css = read("app/globals.css");

  ["Name", "Role", "Invite status", "Vault access", "Actions"].forEach((label) => {
    assert.match(workspace, new RegExp(`<th scope="col"(?: className="[^"]+")?>${label}</th>|label="${label}"`));
  });
  ["Full name", "Email", "Telephone number"].forEach((label) => {
    assert.match(workspace, new RegExp(`label="${label}"`));
  });
  assert.match(workspace, /className="lf-linked-contact-table"/);
  assert.match(workspace, /aria-label={`Edit \$\{contactLabel\}`}/);
  assert.match(workspace, /Save changes/);
  assert.match(workspace, /cancelLinkedContactEdit/);
  assert.match(workspace, /saveLinkedContactDetails/);
  assert.match(css, /\.lf-linked-contact-table[\s\S]*min-width: 760px/);
  assert.match(css, /\.lf-linked-contact-row-actions[\s\S]*justify-content: flex-end/);
  assert.match(css, /\.lf-linked-contact-edit-grid[\s\S]*grid-template-columns:/);
});

test("Trust linked contact edits preserve invitation status and validate telephone/email", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /savePeopleContact\(supabase, \{[\s\S]*existingContactId: contact\.contact_id/);
  assert.match(workspace, /Invitation status has been preserved/);
  assert.match(workspace, /SIMPLE_EMAIL_PATTERN\.test\(draft\.email\)/);
  assert.match(workspace, /isReasonableTelephoneNumber\(draft\.phone\)/);
  assert.match(workspace, /digitCount >= 7 && digitCount <= 15/);
  assert.match(workspace, /formatLinkedContactRole\(role \|\| "Role not set"\)/);
  assert.doesNotMatch(workspace, /sendTrustLinkedContactInvitation\([\s\S]{0,400}saveLinkedContactDetails/);
});

test("Trust linked contact visible actions are functional and do not expose manual status editing", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /buildContactsWorkspaceHref\(item\.contact_id\)/);
  assert.match(workspace, /removeLinkedContactFromRecord\(item\)/);
  assert.match(workspace, /aria-label={`View \$\{contactLabel\}`}/);
  assert.match(workspace, /aria-label={`Delete \$\{contactLabel\} from this record`}/);
  assert.match(workspace, /window\.confirm\(`Remove \$\{contact\.contact_name \|\| "this contact"\} from this Trust record\?/);
  assert.doesNotMatch(workspace, /label="Invitation status"[\s\S]{0,160}<FieldInput/);
  assert.doesNotMatch(workspace, /onChange=\{\(value\) => updateLinkedContactDraft\(item\.id, "invite/);
});
