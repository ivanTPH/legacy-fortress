import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { buildContactsWorkspaceHref, buildLinkedContactRecordHref } = await import("../lib/contacts/contactRouting.ts");
const manifest = fs.readFileSync(path.join(process.cwd(), "config/routeManifest.tsx"), "utf8");

test("contact routing builds the shared contacts workspace href", () => {
  assert.equal(buildContactsWorkspaceHref("contact-123"), "/contacts?contact=contact-123");
  assert.equal(buildContactsWorkspaceHref(""), "/contacts");
});

test("linked contact record routing builds exact workspace deep links", () => {
  assert.equal(buildLinkedContactRecordHref({
    source_kind: "asset",
    source_id: "asset-123",
    section_key: "legal",
    category_key: "identity-documents",
    label: "Passport",
    role: "holder",
  }), "/legal/identity-documents?asset=asset-123");

  assert.equal(buildLinkedContactRecordHref({
    source_kind: "record",
    source_id: "record-123",
    section_key: "cars_transport",
    category_key: "vehicles",
    label: "Range Rover",
    role: "owner",
  }), "/cars-transport?record=record-123");

  assert.equal(buildLinkedContactRecordHref({
    source_kind: "asset",
    source_id: "asset-456",
    section_key: "personal",
    category_key: "executors",
    label: "Executor",
    role: "executor",
  }), "/trust?asset=asset-456");
});

test("contacts resolves as a single top-level navigation destination", () => {
  assert.match(manifest, /id: "people-contacts"[\s\S]*path: "\/contacts"/);
  assert.doesNotMatch(manifest, /id: "personal-contacts"/);
  assert.doesNotMatch(manifest, /path: "\/personal\/contacts"/);
});
