import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { buildContactsWorkspaceHref } = await import("../lib/contacts/contactRouting.ts");
const manifest = fs.readFileSync(path.join(process.cwd(), "config/routeManifest.tsx"), "utf8");

test("contact routing builds the shared contacts workspace href", () => {
  assert.equal(buildContactsWorkspaceHref("contact-123"), "/contacts?contact=contact-123");
  assert.equal(buildContactsWorkspaceHref(""), "/contacts");
});

test("contacts resolves as a single top-level navigation destination", () => {
  assert.match(manifest, /id: "people-contacts"[\s\S]*path: "\/contacts"/);
  assert.doesNotMatch(manifest, /id: "personal-contacts"/);
  assert.doesNotMatch(manifest, /path: "\/personal\/contacts"/);
});
