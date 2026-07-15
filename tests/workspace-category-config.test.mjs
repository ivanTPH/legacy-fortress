import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../lib/assets/workspaceCategoryConfig.ts", import.meta.url), "utf8");

function extractConfigBlock(name) {
  const match = source.match(new RegExp(`export const ${name}:[\\s\\S]*?= \\{([\\s\\S]*?)\\};`));
  assert.ok(match, `${name} config should exist`);
  return match[1];
}

test("investments workspace uses one consistent persistence path", () => {
  const block = extractConfigBlock("INVESTMENTS_WORKSPACE_CONFIG");

  assert.match(block, /sectionKey:\s*"finances"/);
  assert.match(block, /categoryKey:\s*"investments"/);
  assert.match(block, /canonicalCategorySlug:\s*null/);
  assert.match(block, /readsCanonicalAssets:\s*false/);
});
