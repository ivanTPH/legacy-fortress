import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("shared topbar owns the main page title and removes the owner padlock icon", () => {
  const layout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const contacts = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");

  assert.match(layout, /normalizedPathname === "\/dashboard"\s*\?\s*"Dashboard"/);
  assert.match(layout, /<Breadcrumbs items=\{topbarBreadcrumbs\} \/>/);
  assert.match(layout, /verified_user/);
  assert.doesNotMatch(layout, /resolvedViewerAccess\.mode === "linked" \? "visibility_lock" : "lock"/);
  assert.doesNotMatch(layout, /Dashboard - Review your estate records/);
  assert.doesNotMatch(dashboard, /<h1 style=\{\{ fontSize: 26, margin: 0 \}\}>Dashboard - Review your estate records<\/h1>/);
  assert.doesNotMatch(contacts, /<h1 style=\{\{ margin: 0, fontSize: 28 \}\}>Contacts<\/h1>/);
});
