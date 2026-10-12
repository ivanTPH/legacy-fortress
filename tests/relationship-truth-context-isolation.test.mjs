import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("owner relationship projection derives accepted and linked state from canonical activation", () => {
  const contacts = read("components/contacts/ContactsNetworkWorkspace.tsx");
  assert.match(contacts, /resolveInvitationProjectionStatus\(row, existing\.invite_status\)/);
  assert.match(contacts, /invitationStatus === "accepted"/);
  assert.match(contacts, /activationStatus\)/);
  assert.match(contacts, /InvitationProgressTracker contact=\{contact\}/);
  assert.match(contacts, /linked_user_id \|\| contact\.verification_status === "active"/);
  assert.match(contacts, /const linked = Boolean\(contact\.linked_user_id\)/);
  assert.doesNotMatch(contacts, /Your response is still outstanding/);
});

test("shared access remains explicit, selected and view-only", () => {
  const contacts = read("components/contacts/ContactsNetworkWorkspace.tsx");
  const permissions = read("lib/contacts/contactPermissions.ts");
  assert.match(contacts, /Manage shared access/);
  assert.match(contacts, /selected existing records/);
  assert.match(contacts, /View only/);
  assert.match(contacts, /Save shared access/);
  assert.match(contacts, /Remove access/);
  assert.match(permissions, /read_only: true/);
  assert.doesNotMatch(contacts, /All existing and future records/);
});

test("linked context cannot present personal Action Centre or owner-only routes", () => {
  const access = read("lib/access-control/viewerAccess.ts");
  const layout = read("app/(app)/layout.tsx");
  const dashboard = read("app/(app)/dashboard/page.tsx");
  assert.match(access, /\["\/action-centre", "\/contacts", "\/profile", "\/add-to-fortress"/);
  assert.match(layout, /isPersonalOnlyPath/);
  assert.match(layout, /viewerContextValue\.clearLinkedGrant\(\)/);
  assert.match(dashboard, /Returning you to My Fortress before opening your personal Action Centre/);
});

test("zero-grant linked dashboards do not render owner category furniture", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  assert.match(dashboard, /No Vault information is currently shared with you/);
  assert.match(dashboard, /hasVisibleOverviewCard/);
  assert.match(dashboard, /viewer\.mode !== "linked" \|\| financeRecordCount > 0/);
  assert.match(dashboard, /showAddAction=\{viewer\.mode !== "linked"\}/);
});

test("Action Centre prioritises a short primary list and collapses the remainder", () => {
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(queue, /const primaryRows = rows\.slice\(0, 5\)/);
  assert.match(queue, /More things to consider/);
  assert.match(queue, /secondaryRows\.map\(renderInboxRow\)/);
});

test("linked profile is relationship-safe rather than an editable owner profile", () => {
  const profile = read("app/(app)/profile/page.tsx");
  assert.match(profile, /About \$\{viewer\.accountHolderName\}/);
  assert.match(profile, /Private profile details remain with the Fortress owner/);
  assert.match(profile, /viewer\.mode === "linked"/);
});
