import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("wills define executor linked-contact labels and default role", () => {
  const legalCategories = read("lib/legalCategories.ts");

  assert.match(legalCategories, /if \(slug === "wills"\)/);
  assert.match(legalCategories, /defaultRole: "executor"/);
  assert.match(legalCategories, /contactNameLabel: "Executor name"/);
  assert.match(legalCategories, /contactEmailLabel: "Executor email"/);
  assert.match(legalCategories, /roleOptions: \[/);
  assert.match(legalCategories, /value: "co_executor"/);
  assert.match(legalCategories, /value: "legal_adviser"/);
  assert.match(legalCategories, /value: "guardian"/);
});

test("legal document forms support multiple linked contact rows", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /legal_contacts: LegalContactFormRow\[\]/);
  assert.match(workspace, /function addLegalContactRow\(\)/);
  assert.match(workspace, /function removeLegalContactRow\(id: string\)/);
  assert.match(workspace, /FieldSelect/);
  assert.match(workspace, /type="email"/);
  assert.match(workspace, /label="Telephone number"/);
  assert.match(workspace, /addLinkedContactIconButtonStyle/);
  assert.match(workspace, /removeLinkedContactIconButtonStyle/);
  assert.match(workspace, /<Icon name="add" size=\{16\}/);
});

test("legal save path persists every non-empty linked contact through canonical contact links", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /normalizeLegalContactRows/);
  assert.match(workspace, /if \(!name && !email && !phone\) return null/);
  assert.match(workspace, /findInvalidLegalContactEmail/);
  assert.match(workspace, /must be a valid email address/);
  assert.match(workspace, /linked_contacts: legalContactRows\.map/);
  assert.match(workspace, /phone: item\.phone \|\| null/);
  assert.match(workspace, /phone: legalContact\.phone \|\| null/);
  assert.match(workspace, /for \(const legalContact of legalContactRows\)/);
  assert.match(workspace, /sourceType: "record_contact"/);
  assert.doesNotMatch(workspace, /section_entries.*legal_contacts/s);
});

test("wills use a tailored form instead of generic document fields", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /const isWillsWorkspace = sectionKey === "legal" && categoryKey === "wills"/);
  assert.match(workspace, /Add your will documents and contacts here/);
  assert.match(workspace, /Will title \(required\)/);
  assert.match(workspace, /Add document here/);
  assert.match(workspace, /lf-will-upload-field/);
  assert.match(workspace, /router\.push\("\/legal"\)/);
  assert.match(workspace, /savedConfirmation/);
  assert.match(workspace, /Add notes/);
  assert.match(workspace, /lf-will-title-upload-row/);
  assert.match(workspace, /getRecordContactInviteState/);
  assert.match(workspace, /lf-linked-contact-table/);
  assert.match(workspace, /isImageAttachment\(item\) \? photoPreviews/);
  assert.match(workspace, /isWillsWorkspace \|\| isTrustsWorkspace \? null : \(/);
  assert.match(workspace, /isNarrativeDocumentWorkspace && !isWillsWorkspace && !isTrustsWorkspace/);
  assert.doesNotMatch(workspace, /Add a will document/);
});

test("wills upload control uses one compact upload affordance", () => {
  const css = read("app/globals.css");

  assert.match(css, /\.lf-will-upload-control/);
  assert.match(css, /grid-template-columns: 44px minmax\(0, 340px\)/);
  assert.match(css, /\.lf-will-upload-icon/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.lf-record-contact-status\.is-accepted/);
  assert.doesNotMatch(css, /\.lf-will-upload-control \{[^}]*border: 1px solid #d8d2cc/s);
});
