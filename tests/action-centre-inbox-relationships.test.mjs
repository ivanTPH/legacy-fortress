import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Action Centre uses an inbox row and progressive detail drawer", () => {
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  const summary = read("app/(app)/components/dashboard/DashboardActionSummary.tsx");

  assert.match(queue, /function ActionCentreInbox/);
  assert.match(queue, /lf-action-centre-row-summary/);
  assert.match(queue, /role="dialog"/);
  assert.match(queue, /What you can do next/);
  assert.match(queue, /lf:action-centre-read/);
  assert.match(queue, /Remind me later/);
  const inbox = queue.slice(queue.indexOf("function ActionCentreInbox"), queue.indexOf("export default memo"));
  assert.doesNotMatch(inbox, /priorityPill|activeBlockerCount|Recommended actions/);
  assert.match(summary, /View Action Centre/);
  assert.doesNotMatch(summary, /actionable items/);
});

test("Action Centre rows keep specific customer actions and direct destinations", () => {
  const queue = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");

  assert.match(queue, /Add a copy of your Will/);
  assert.match(queue, /Do you have a Lasting Power of Attorney\?/);
  assert.match(queue, /Add your home address/);
  assert.match(queue, /Continue setup/);
  assert.match(queue, /onAction\(selectedRow\.actionKey\)/);
  assert.match(queue, /selectedRow\.guidanceItem\?\.learnMoreHref/);
});

test("People view removes development UI and keeps relationship details progressive", () => {
  const contacts = read("components/contacts/ContactsNetworkWorkspace.tsx");

  assert.doesNotMatch(contacts, /CONTACTS BUILD CHECK/);
  assert.match(contacts, /PersonDetailDrawer/);
  assert.match(contacts, /InvitationProgressTracker/);
  assert.match(contacts, /do not have access to your private Vault merely because they are linked/i);
  assert.match(contacts, /Manage relationship/);
  assert.match(contacts, /<details className="lf-person-more-details"/);
});

test("Invitation tracker exposes only authoritative stages", () => {
  const manager = read("app/(app)/components/dashboard/ContactInvitationManager.tsx");

  assert.match(manager, /label: "Prepared"/);
  assert.match(manager, /label: "Sent"/);
  assert.match(manager, /label: "Accepted"/);
  assert.match(manager, /label: "Identity verified"/);
  assert.match(manager, /label: "Linked"/);
  assert.doesNotMatch(manager, /Invitation opened/);
  assert.doesNotMatch(manager, /Delivered/);
  assert.match(manager, /does not establish legal authority or guarantee access/);
});
