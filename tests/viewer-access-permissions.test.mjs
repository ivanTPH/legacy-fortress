import test from "node:test";
import assert from "node:assert/strict";

import {
  canEditAssetForViewer,
  canEditRecordForViewer,
} from "../lib/access-control/viewerAccess.ts";

const linkedViewer = {
  mode: "linked",
  grantId: "grant-1",
  sessionUserId: "viewer-1",
  targetOwnerUserId: "owner-1",
  accountHolderName: "Owner One",
  linkedContactId: "contact-1",
  linkedContactName: "Advisor Contact",
  viewerRole: "professional_advisor",
  activationStatus: "active",
  readOnly: false,
  canUpgradeToOwnAccount: false,
  permissionsOverride: {
    allowedSections: ["financial"],
    assetIds: ["asset-1"],
    recordIds: ["record-1"],
    editableAssetIds: ["asset-1"],
    editableRecordIds: ["record-1"],
  },
  assignedAssetIds: ["asset-1"],
  assignedRecordIds: ["record-1"],
  editableAssetIds: ["asset-1"],
  editableRecordIds: ["record-1"],
  assignedSectionKeys: ["financial"],
};

test("viewer access edit helpers allow only explicitly editable ids for linked users", () => {
  assert.equal(canEditAssetForViewer("asset-1", linkedViewer), true);
  assert.equal(canEditAssetForViewer("asset-2", linkedViewer), false);
  assert.equal(canEditRecordForViewer("record-1", linkedViewer), true);
  assert.equal(canEditRecordForViewer("record-2", linkedViewer), false);
});

test("owner viewers retain edit access without scoped id checks", () => {
  const ownerViewer = {
    ...linkedViewer,
    mode: "owner",
  };
  assert.equal(canEditAssetForViewer("asset-any", ownerViewer), true);
  assert.equal(canEditRecordForViewer("record-any", ownerViewer), true);
});
