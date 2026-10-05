import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const addPanel = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/AddToFortressPanel.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
const addPage = fs.readFileSync(path.join(root, "app/(app)/add-to-fortress/page.tsx"), "utf8");
const contacts = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");

test("Add to my Fortress uses existing canonical record and contact routes", () => {
  assert.doesNotMatch(dashboard, /<AddToFortressPanel \/>/);
  assert.match(addPage, /<AddToFortressPanel \/>/);
  assert.match(dashboard, /href="\/add-to-fortress"/);
  for (const route of ["/property?add=1", "/finances/bank?add=1", "/legal/wills?add=1", "/legal/power-of-attorney?add=1", "/contacts?group=executors&add=1", "/vault/personal/records?add=1", "/vault/digital/records?add=1", "/personal/wishes?add=1"]) {
    assert.match(addPanel, new RegExp(route.replace(/[?&=]/g, "\\$&")));
  }
  assert.match(contacts, /setAddContactGroupKey\(selectedGroup\)/);
});

test("customer add choices do not request passwords or grant access", () => {
  assert.doesNotMatch(addPanel, /type=\"password\"|account_access_grants|role_assignments|service_role/i);
  assert.match(addPanel, /never a password|Do not store passwords/);
});
