import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("dashboard overview cards use compact shared summary cards with icon-only review actions", () => {
  const dashboardPage = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const summaryCard = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx"), "utf8");
  const actionQueue = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ActionQueuePanel.tsx"), "utf8");

  assert.match(dashboardPage, /financialSummary\.valueText/);
  assert.match(dashboardPage, /propertySummary\.valueText/);
  assert.match(dashboardPage, /businessSummary\.valueText/);
  assert.match(dashboardPage, /<ContactInvitationManager mode="dashboard" \/>/);
  assert.match(dashboardPage, /<ActionQueuePanel groups=\{actionQueueGroups\} onAction=\{handleAction\} \/>/);
  assert.match(dashboardPage, /handleAction\(actionKey: string\)/);
  assert.match(dashboardPage, /buildActionQueueGroups\(blockingState\)/);
  assert.match(dashboardPage, /deriveBlockingState\(/);
  assert.match(dashboardPage, /inlineSummary/);
  assert.match(dashboardPage, /hideItems/);
  assert.match(dashboardPage, /actionIcon="open_in_new"/);
  assert.match(summaryCard, /<IconButton/);
  assert.match(summaryCard, /actionIcon = "open_in_new"/);
  assert.match(summaryCard, /<span style=\{valueStyle\}>/);
  assert.match(summaryCard, /<span style=\{detailStyle\}>/);
  assert.match(actionQueue, /Action Queue/);
  assert.match(actionQueue, /Required role/);
  assert.match(actionQueue, /Stage/);
  assert.match(actionQueue, /onAction\(item.actionKey\)/);
});

test("contacts keeps the fuller invitation management view while dashboard stays compact", () => {
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

  assert.match(contactsWorkspace, /<ContactInvitationManager[\s\S]*mode="full"[\s\S]*selectedContactId=\{selectedContactId\}[\s\S]*selectedContactProfile=\{selectedContact\}[\s\S]*\/>/);
  assert.match(invitationManager, /mode\?: "full" \| "dashboard"/);
  assert.match(invitationManager, /selectedContactId\?: string/);
  assert.match(invitationManager, /Owner notes/);
  assert.match(invitationManager, /Open Contacts/);
  assert.match(invitationManager, /buildContactsWorkspaceHref/);
  assert.doesNotMatch(invitationManager, /Invitation sent and awaiting activation/);
  assert.doesNotMatch(invitationManager, /Signed in and verified\./);
  assert.doesNotMatch(invitationManager, />Resend<\/th>/);
  assert.match(invitationManager, /function canSendInvite/);
  assert.match(invitationManager, /function canResendInvite/);
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
