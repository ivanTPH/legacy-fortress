import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("trusts keep the add form closed by default while preserving existing records", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /const \[formVisible, setFormVisible\] = useState\(false\)/);
  assert.match(workspace, /const shouldShowExistingRecords = !loading && \(hasAnyRecords \|\| isTrustsWorkspace\) && !isCreatingRecord/);
  assert.match(workspace, /{formVisible \? \(\s*<section\s+id={createFormRegionId}/);
  assert.doesNotMatch(workspace, /display:\s*formVisible \? "grid" : "none"/);
});

test("trust add button controls one accessible form region", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /function startCreate\(\) {\s*if \(formVisible\) return;/);
  assert.match(workspace, /ref={addRecordButtonRef}/);
  assert.match(workspace, /aria-expanded={isCreatingRecord}/);
  assert.match(workspace, /aria-controls={createFormRegionId}/);
  assert.match(workspace, /role="region"/);
  assert.ok(workspace.includes('aria-labelledby={`${createFormRegionId}-heading`}'));
  assert.match(workspace, /focusFirstFormControl\(formSectionRef\.current\)/);
  assert.match(workspace, /prefersReducedMotion\(\) \? "auto" : "smooth"/);
});

test("trust cancel closes cleanly and protects unsaved data", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /Discard this unsaved trust record\?/);
  assert.match(workspace, /hasUnsavedFormChanges\(\) && !window\.confirm\(getDiscardPrompt\(\)\)/);
  assert.match(workspace, /resetFormState\({ focusAddButton: true }\)/);
  assert.match(workspace, /if \(isWillsWorkspace && !isTrustsWorkspace\)/);
});

test("trust save success and validation failure keep focus in the right place", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");

  assert.match(workspace, /resetFormState\({ focusExistingRecords: true }\)/);
  assert.match(workspace, /existingRecordsHeadingRef\.current\?\.focus\(\)/);
  assert.match(workspace, /function stopSaveForValidation\(message: string\)/);
  assert.match(workspace, /Choose a document type before saving this trust record\.[\s\S]*stopSaveForValidation\(message\)/);
  assert.match(workspace, /Upload a trust document or add notes before saving this trust record\.[\s\S]*stopSaveForValidation\(message\)/);
});
