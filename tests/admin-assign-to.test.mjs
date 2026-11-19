import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { listAssignableAdmins, isAssignableAdmin } from "../lib/admin/assignees.ts";

const rows = [
  { user_id: "u-super", display_name: "Ivan", email_normalized: "ivan@example.test", status: "active", role: "super_admin", is_master: true },
  { user_id: "u-verifier", display_name: "Vera", email_normalized: "vera@example.test", status: "active", role: "verification_reviewer", is_master: false },
  { user_id: "u-auditor", display_name: "Audrey", email_normalized: "audrey@example.test", status: "active", role: "auditor", is_master: false },
  { user_id: null, display_name: "Pending", email_normalized: "pending@example.test", status: "active", role: "super_admin", is_master: false },
];
const client = { from: () => ({ select: () => ({ eq: async (column, value) => ({ data: rows.filter((row) => row[column] === value), error: null }) }) }) };

test("Assign to… lists only registered, active admins allowed to review ID checks (owner, 19 Nov 2026)", async () => {
  const list = await listAssignableAdmins(client, "verification:review");
  assert.ok(list.some((item) => item.userId === "u-super"));
  assert.ok(!list.some((item) => item.userId === "u-auditor"), "an auditor can't review ID checks");
  assert.ok(!list.some((item) => item.name === "Pending"), "invited but not signed up isn't listed");
  assert.equal(await isAssignableAdmin(client, "verification:review", "u-auditor"), false);
  assert.equal(await isAssignableAdmin(client, "verification:review", "someone-else"), false);
});

test("the server re-checks the choice and records the hand-over", () => {
  const route = fs.readFileSync("app/api/internal/admin/verifications/route.ts", "utf8");
  assert.match(route, /action === "assign" && \(!assigneeUserId \|\| !\(await isAssignableAdmin\(admin\.adminClient, "verification:review", assigneeUserId\)\)\)/);
  assert.match(route, /assigned_admin_user_id: assigneeUserId/);
  const list = fs.readFileSync("app/api/internal/admin/assignees/route.ts", "utf8");
  assert.match(list, /requireAdminCapability\(admin\.access, "verification:review"\)/);
  const ui = fs.readFileSync("components/admin/AssignReviewer.tsx", "utf8");
  assert.match(ui, /<select /);
  assert.doesNotMatch(ui, /type="email"|type="text"/, "chosen from a list, never typed");
});

test("an invitation never changes someone's role; changing an acting executor's role warns first (owner, 19 Nov 2026)", () => {
  const people = fs.readFileSync("components/contacts/ContactsNetworkWorkspace.tsx", "utf8");
  assert.match(people, /contact_role: existing\.contact_role \|\| row\.assigned_role/);
  assert.match(people, /is still named as \$\{what\}\. Changing their role here doesn’t change that\./);
  assert.match(people, /if \(!confirmed\) \{ setSaving\(false\); return; \}/);
  const linked = fs.readFileSync("lib/linkedPeople/recordLinkedPeople.ts", "utf8");
  assert.match(linked, /\/executor\/i\.test\(String\(\(link\.data as \{ role\?: string \}\)\.role/);
});
