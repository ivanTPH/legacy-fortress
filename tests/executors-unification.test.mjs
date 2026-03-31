import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("navigation no longer exposes Executors as a standalone destination", () => {
  const manifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");
  const navigation = fs.readFileSync(path.join(root, "app/(app)/navigation/navigation.config.tsx"), "utf8");

  assert.match(manifest, /label: "Contacts"/);
  assert.doesNotMatch(manifest, /label: "Executors"/);
  assert.doesNotMatch(manifest, /path: "\/executors"/);
  assert.match(navigation, /APP_ROUTE_MANIFEST\.map\(mapRouteNode\)/);
});

test("legacy executors route redirects into grouped contacts", () => {
  const executorsRoute = fs.readFileSync(path.join(root, "app/(app)/executors/page.tsx"), "utf8");

  assert.match(executorsRoute, /redirect\("\/contacts\?group=executors"\)/);
});

test("contacts grouped workflow preserves executor group state when selecting a contact", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");

  assert.match(contactsWorkspace, /params\.set\("group", groupKey\)/);
  assert.match(contactsWorkspace, /router\.replace\(`\/contacts\?\$\{params\.toString\(\)\}`\)/);
  assert.match(contactsWorkspace, /selectedGroup \? `\/contacts\?group=\$\{selectedGroup\}` : "\/contacts"/);
  assert.match(contactsWorkspace, /const GROUPS = \[/);
  assert.match(contactsWorkspace, /key: "executors"/);
  assert.match(contactsWorkspace, /setOpenGroupKey\(\(current\) => \(current === groupKey \? null : groupKey\)\)/);
  assert.doesNotMatch(contactsWorkspace, /Review executors/);
});
