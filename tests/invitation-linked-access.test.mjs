import test from "node:test";
import assert from "node:assert/strict";

const { buildInvitationEmailDraft } = await import("../lib/contacts/invitations.ts");
const { canViewPath, filterAssetIdsForViewer } = await import("../lib/access-control/viewerAccess.ts");

test("invitation email draft includes role, account holder, and secure accept path", () => {
  const draft = buildInvitationEmailDraft({
    invitationId: "invite-123",
    token: "token-456",
    assignedRole: "executor",
    accountHolderName: "Bill Smith",
  });

  assert.equal(draft.subject, "You have been invited as Executor for Bill Smith");
  assert.match(draft.preview, /view-only, role-based access/i);
  assert.match(draft.bodyText, /Legacy Fortress is a secure estate-record workspace/i);
  assert.match(draft.bodyText, /will not be able to edit or delete anything/i);
  assert.equal(draft.acceptPath, "/invite/accept?invitation=invite-123&token=token-456");
});

test("executors can view all core linked-account routes", () => {
  const viewer = {
    mode: "linked",
    grantId: "grant-1",
    sessionUserId: "viewer-1",
    targetOwnerUserId: "owner-1",
    accountHolderName: "Bill Smith",
    linkedContactId: "contact-1",
    linkedContactName: "Emma Carter",
    viewerRole: "executor",
    activationStatus: "accepted",
    readOnly: true,
    canUpgradeToOwnAccount: true,
    permissionsOverride: { allowedSections: [], assetIds: [], recordIds: [] },
    assignedAssetIds: [],
    assignedRecordIds: [],
    assignedSectionKeys: [],
  };

  assert.equal(canViewPath("/dashboard", viewer), true);
  assert.equal(canViewPath("/profile", viewer), true);
  assert.equal(canViewPath("/finances/bank", viewer), true);
  assert.equal(canViewPath("/legal/wills", viewer), true);
  assert.equal(canViewPath("/vault/property", viewer), true);
});

test("accountants stay out of personal routes while keeping financial visibility", () => {
  const viewer = {
    mode: "linked",
    grantId: "grant-2",
    sessionUserId: "viewer-2",
    targetOwnerUserId: "owner-1",
    accountHolderName: "Bill Smith",
    linkedContactId: "contact-2",
    linkedContactName: "Naomi Reed",
    viewerRole: "accountant",
    activationStatus: "accepted",
    readOnly: true,
    canUpgradeToOwnAccount: true,
    permissionsOverride: { allowedSections: ["financial"], assetIds: ["asset-1"], recordIds: [] },
    assignedAssetIds: ["asset-1"],
    assignedRecordIds: [],
    assignedSectionKeys: ["financial"],
  };

  assert.equal(canViewPath("/finances/bank", viewer), true);
  assert.equal(canViewPath("/dashboard", viewer), true);
  assert.equal(canViewPath("/contacts", viewer), false);
  assert.equal(canViewPath("/personal/contacts", viewer), false);
  assert.equal(canViewPath("/property", viewer), false);
  assert.equal(canViewPath("/account/billing", viewer), false);
});

test("linked viewers only keep assigned asset rows in shared loaders", () => {
  const viewer = {
    mode: "linked",
    grantId: "grant-3",
    sessionUserId: "viewer-3",
    targetOwnerUserId: "owner-1",
    accountHolderName: "Bill Smith",
    linkedContactId: "contact-3",
    linkedContactName: "Alex Grant",
    viewerRole: "financial_advisor",
    activationStatus: "active",
    readOnly: false,
    canUpgradeToOwnAccount: true,
    permissionsOverride: { allowedSections: ["financial"], assetIds: ["asset-keep"], recordIds: [] },
    assignedAssetIds: ["asset-keep"],
    assignedRecordIds: [],
    assignedSectionKeys: ["financial"],
  };

  const rows = filterAssetIdsForViewer([
    { id: "asset-keep", section_key: "finances" },
    { id: "asset-drop", section_key: "finances" },
    { id: "asset-legal", section_key: "legal" },
  ], viewer);

  assert.deepEqual(rows.map((row) => row.id), ["asset-keep"]);
});
