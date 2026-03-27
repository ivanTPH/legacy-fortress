import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("cars and transport uses the shared section workspace with direct upload support", () => {
  const carsPage = fs.readFileSync(path.join(root, "app/(app)/cars-transport/page.tsx"), "utf8");
  const sectionWorkspace = fs.readFileSync(path.join(root, "components/sections/SectionWorkspace.tsx"), "utf8");

  assert.match(carsPage, /<SectionWorkspace/);
  assert.match(carsPage, /sectionKey="cars_transport"/);
  assert.doesNotMatch(carsPage, /uploadsRequireCanonicalParent=\{true\}/);
  assert.match(sectionWorkspace, /uploadsRequireCanonicalParent = false/);
  assert.match(sectionWorkspace, /AttachmentGallery/);
  assert.match(sectionWorkspace, /Upload file/);
});
