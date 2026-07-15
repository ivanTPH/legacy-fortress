import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("asset forms use shared multi-document pending upload state", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /pendingDocumentFiles, setPendingDocumentFiles\] = useState<File\[\]>\(\[\]\)/);
  assert.match(workspace, /function stageDocumentFiles\(\s*files: File\[\] \| FileList,/);
  assert.match(workspace, /function removePendingDocumentFile\(index: number\)/);
  assert.match(workspace, /<InlineDocumentUploadField/);
  assert.match(workspace, /for \(const pendingDocumentFile of pendingDocumentFiles\)/);
  assert.doesNotMatch(workspace, /pendingDocumentFile, setPendingDocumentFile/);
});

test("shared asset form actions use reveal notes, cancel, save ordering", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /!\s*showNarrativeNotes && !usesStructuredWorkspaceForm/);
  assert.match(workspace, /Add notes/);
  assert.match(workspace, /<Icon name="close" size=\{16\} \/>[\s\S]*Cancel[\s\S]*<Icon name="save" size=\{16\}/);
  assert.match(workspace, /setSavedConfirmation\(editingId \? "Changes saved" : "Saved record"\)/);
  assert.doesNotMatch(workspace, /if \(isWillsWorkspace\) \{\s*setSavedConfirmation/);
});

test("manual finance branches use controlled selects for bounded type fields", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /FieldSelect label="Currency" value=\{form\.currency_code\} options=\{CURRENCY_SELECT_OPTIONS\}/);
  assert.match(workspace, /FieldSelect label="Ownership type" value=\{form\.ownership_type\} options=\{OWNERSHIP_TYPE_OPTIONS\}/);
  assert.match(workspace, /FieldSelect label="Policy type" value=\{form\.policy_type\} options=\{INSURANCE_SELECT_OPTIONS\}/);
  assert.match(workspace, /FieldSelect label="Debt type" value=\{form\.debt_type\} options=\{DEBT_SELECT_OPTIONS\}/);
});

test("shared upload styling supports pending file chips", () => {
  const css = read("app/globals.css");

  assert.match(css, /\.lf-shared-document-upload-field/);
  assert.match(css, /\.lf-shared-document-upload-control/);
  assert.match(css, /\.lf-pending-document-list/);
  assert.match(css, /\.lf-pending-document-item/);
});

test("shared workspace names canonical asset-form families", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /type AssetFormFamily = "document" \| "financial" \| "asset"/);
  assert.match(workspace, /const assetFormFamily: AssetFormFamily/);
  assert.match(workspace, /isFinanceSection\s*\?\s*"financial"/);
});
