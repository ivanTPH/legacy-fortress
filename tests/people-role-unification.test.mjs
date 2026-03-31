import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("navigation keeps Contacts as the only people destination", () => {
  const manifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");

  assert.match(manifest, /label: "Contacts"/);
  assert.doesNotMatch(manifest, /label: "Executors"/);
  assert.doesNotMatch(manifest, /label: "Trusted contacts"/);
  assert.doesNotMatch(manifest, /label: "Advisors"/);
  assert.doesNotMatch(manifest, /label: "Family"/);
  assert.doesNotMatch(manifest, /label: "Next of kin"/);
});

test("legacy people-role routes redirect into contacts group views", () => {
  const routes = {
    "app/(app)/executors/page.tsx": '/contacts?group=executors',
    "app/(app)/trust/page.tsx": '/contacts?group=trusted-contacts',
    "app/(app)/advisors/page.tsx": '/contacts?group=advisors',
    "app/(app)/family/page.tsx": '/contacts?group=family',
    "app/(app)/next-of-kin/page.tsx": '/contacts?group=next-of-kin',
    "app/(app)/trusted-contacts/page.tsx": '/contacts?group=trusted-contacts',
  };

  for (const [file, destination] of Object.entries(routes)) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, new RegExp(`redirect\\("${destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`));
  }
});

test("contacts normalizes legacy group aliases and preserves selected contact state", () => {
  const grouping = fs.readFileSync(path.join(root, "lib/contacts/contactGrouping.ts"), "utf8");
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const personalContactsRoute = fs.readFileSync(path.join(root, "app/(app)/personal/contacts/page.tsx"), "utf8");

  assert.match(grouping, /normalized === "next-of-kin".*return "family"/s);
  assert.match(grouping, /normalized === "trusted-contacts".*return "trusted_contacts"/s);
  assert.match(contactsWorkspace, /normalizeContactGroupKey\(searchParams\.get\("group"\)\)/);
  assert.match(contactsWorkspace, /params\.set\("group", groupKey\)/);
  assert.match(contactsWorkspace, /router\.replace\(`\/contacts\?\$\{params\.toString\(\)\}`\)/);
  assert.match(personalContactsRoute, /params\.set\("group", selectedGroup\)/);
});
