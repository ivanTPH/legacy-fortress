import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { normalizePeopleScopeResourceRows } from "../lib/contacts/contactRepository.ts";

const root = process.cwd();

test("scope projection keeps all eligible finance records, including pensions", () => {
  const rows = normalizePeopleScopeResourceRows([
    { source_kind: "asset", id: "bank-1", section_key: "finances", category_key: "bank", title: "Barclays", provider_name: "Barclays" },
    { source_kind: "asset", id: "bank-2", section_key: "finances", category_key: "bank", title: "HSBC", provider_name: "HSBC" },
    { source_kind: "asset", id: "pension-1", section_key: "finances", category_key: "pensions", title: "Provincial", provider_name: "Provincial" },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["bank-1", "bank-2", "pension-1"]);
});

test("shared access uses one canonical explicit-id editor from both directions", () => {
  const contacts = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const sharing = fs.readFileSync(path.join(root, "components/access/AccessSharingWorkspace.tsx"), "utf8");
  const recordWorkspace = fs.readFileSync(path.join(root, "components/records/UniversalRecordWorkspace.tsx"), "utf8");
  assert.match(contacts, /loadPeopleScopeResourcesForOwner/);
  assert.match(contacts, /Select all current/);
  assert.match(contacts, /New records are not shared automatically/);
  assert.match(sharing, /People with access/);
  assert.match(sharing, /buildScopedPermissionPayload/);
  assert.match(recordWorkspace, /\/access-sharing\?asset=/);
});

test("sharing remains view-only and executor relationships are excluded from living record sharing", () => {
  const permissions = fs.readFileSync(path.join(root, "lib/contacts/contactPermissions.ts"), "utf8");
  const sharing = fs.readFileSync(path.join(root, "components/access/AccessSharingWorkspace.tsx"), "utf8");
  assert.match(permissions, /read_only: true/);
  assert.match(sharing, /contact\.contact_role !== "executor"/);
  assert.match(sharing, /View only/);
});
