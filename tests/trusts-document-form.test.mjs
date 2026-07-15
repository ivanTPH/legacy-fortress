import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("trusts use the document-form family without financial summaries", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  const legalCategories = read("lib/legalCategories.ts");

  assert.match(workspace, /type AssetFormFamily = "document" \| "financial" \| "asset"/);
  assert.match(workspace, /const isTrustsWorkspace = sectionKey === "legal" && categoryKey === "trusts"/);
  assert.match(workspace, /assetFormFamily !== "document"/);
  assert.match(workspace, /Store trust deeds, trustees and supporting legal documents securely\. You can update this anytime\./);
  assert.match(workspace, /formVisible && !isTrustsWorkspace/);
  assert.match(legalCategories, /Store trust deeds, trustees and supporting legal documents securely\./);
});

test("trusts expose bounded document and jurisdiction dropdowns with safe other persistence", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  [
    "Trust deed",
    "Declaration of trust",
    "Deed of variation",
    "Deed of appointment",
    "Deed of retirement",
    "Deed of assignment",
    "Trust amendment",
    "Letter of wishes",
    "Trustee resolution",
    "Other",
  ].forEach((label) => assert.match(workspace, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  ["United Kingdom", "United States", "Austria", "Belgium", "France", "Germany", "Ireland", "Spain", "Sweden"].forEach((label) => {
    assert.match(workspace, new RegExp(`value: "${label}"`));
  });

  assert.match(workspace, /trust_document_type_other/);
  assert.match(workspace, /trust_jurisdiction_other/);
  assert.match(workspace, /resolveTrustDocumentType\(form\)/);
  assert.match(workspace, /resolveTrustJurisdiction\(form\)/);
  assert.match(workspace, /trust_document_type: isTrustsWorkspace \? resolvedTrustDocumentType/);
  assert.match(workspace, /trust_jurisdiction: isTrustsWorkspace \? resolvedTrustJurisdiction/);
  assert.doesNotMatch(workspace, /TRUST_STATUS_OPTIONS/);
  assert.doesNotMatch(workspace, /trust_name/);
  assert.doesNotMatch(workspace, /trust_status/);
  assert.doesNotMatch(workspace, /trust_review_date/);
  assert.doesNotMatch(workspace, /trust_adviser/);
});

test("trust first row is name type upload and removes duplicate generic fields", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  const css = read("app/globals.css");

  assert.match(workspace, /<div className="lf-trust-title-upload-row">[\s\S]*Document name \(required\)[\s\S]*Document type \(required\)[\s\S]*<InlineDocumentUploadField/);
  assert.match(workspace, /Date created/);
  assert.match(workspace, /Jurisdiction \/ country/);
  assert.match(workspace, /Reference number/);
  assert.doesNotMatch(workspace, /label="Trust name"/);
  assert.doesNotMatch(workspace, /label="Status"/);
  assert.doesNotMatch(workspace, /label="Review date"/);
  assert.doesNotMatch(workspace, /label="Solicitor \/ adviser"/);
  assert.match(css, /\.lf-trust-title-upload-row[\s\S]*grid-template-columns: minmax\(220px, 1fr\) minmax\(220px, 0\.9fr\) minmax\(360px, 1fr\)/);
  assert.doesNotMatch(css, /lf-trust-primary-fields/);
});

test("trust upload is restricted to document-led file types and uses shared upload UI", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /TRUST_DOCUMENT_UPLOAD_ACCEPT/);
  assert.match(workspace, /TRUST_DOCUMENT_UPLOAD_MIME_TYPES/);
  assert.match(workspace, /stageDocumentFiles\(files, TRUST_DOCUMENT_UPLOAD_MIME_TYPES/);
  assert.match(workspace, /PDF, DOCX, JPG, JPEG, or PNG up to 15MB/);
  assert.doesNotMatch(workspace, /isTrustsWorkspace[\s\S]{0,220}XLSX, CSV, or ICS/);
  assert.match(workspace, /!isWillsWorkspace && !isTrustsWorkspace/);
});

test("trust related people are repeatable and role-bounded", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  const legalCategories = read("lib/legalCategories.ts");

  ["Trustee", "Settlor", "Beneficiary", "Protector", "Solicitor", "Adviser", "Accountant", "Other"].forEach((label) => {
    assert.match(legalCategories, new RegExp(`label: "${label}"`));
  });
  assert.match(legalCategories, /contactNameLabel: "Full name"/);
  assert.match(workspace, /isTrustsWorkspace\s*\?\s*"Add another person"/);
  assert.doesNotMatch(workspace, /isTrustsWorkspace \? ghostBtn : addLinkedContactIconButtonStyle/);
  assert.match(workspace, /projectionRows\.push/);
  assert.match(workspace, /\.from\("record_contacts"\)\.insert\(projectionRows\)/);
});
