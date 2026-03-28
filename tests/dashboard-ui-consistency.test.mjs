import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("dashboard overview cards use compact shared summary cards with icon-only review actions", () => {
  const dashboardPage = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const summaryCard = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx"), "utf8");

  assert.match(dashboardPage, /Dashboard - Review your estate records/);
  assert.match(dashboardPage, /<ContactInvitationManager mode="dashboard" \/>/);
  assert.match(dashboardPage, /inlineSummary/);
  assert.match(dashboardPage, /hideItems/);
  assert.match(summaryCard, /<IconButton/);
  assert.match(summaryCard, /actionIcon = "visibility"|actionIcon = "open_in_new"/);
  assert.match(summaryCard, /<span style=\{valueStyle\}>/);
  assert.match(summaryCard, /<span style=\{detailStyle\}>/);
});

test("contacts keeps the fuller invitation management view while dashboard stays compact", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(contactsWorkspace, /<ContactInvitationManager mode="full" \/>/);
  assert.match(invitationManager, /mode\?: "full" \| "dashboard"/);
  assert.match(invitationManager, /Open Contacts/);
  assert.match(invitationManager, /buildContactsWorkspaceHref/);
});

test("shared attachment gallery uses icon buttons with tooltips instead of ad hoc text action buttons", () => {
  const attachmentGallery = fs.readFileSync(path.join(root, "components/documents/AttachmentGallery.tsx"), "utf8");

  assert.match(attachmentGallery, /import \{ IconButton \} from "\.\.\/ui\/IconButton"/);
  assert.match(attachmentGallery, /icon="visibility"/);
  assert.match(attachmentGallery, /icon="download"/);
  assert.match(attachmentGallery, /icon="open_in_new"/);
  assert.match(attachmentGallery, /icon="print"/);
  assert.match(attachmentGallery, /icon="delete"/);
  assert.doesNotMatch(attachmentGallery, /style=\{miniGhostBtn\}/);
});
