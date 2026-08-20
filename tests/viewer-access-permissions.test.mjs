import test from "node:test";
import assert from "node:assert/strict";

import {
  canContributeDocumentForViewer,
  canEditAssetForViewer,
  canEditRecordForViewer,
  canViewPath,
} from "../lib/access-control/viewerAccess.ts";
import {
  LF_IDENTITY_LEVEL_1_AUTHENTICATED,
  LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED,
  LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED,
  canPerformHighRiskAction,
  vaultAllowsOwnerMutation,
} from "../lib/access-control/securityPolicy.ts";

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
  identityAssuranceLevel: LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED,
  requiredIdentityLevel: LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED,
  vaultLifecycleState: "OWNER_ACTIVE",
  permissionsOverride: {
    allowedSections: ["financial"],
    assetIds: ["asset-1"],
    recordIds: ["record-1"],
    editableAssetIds: ["asset-1"],
    editableRecordIds: ["record-1"],
    explicitPermissions: ["view", "view_summary", "view_detail", "download", "contribute_document"],
  },
  assignedAssetIds: ["asset-1"],
  assignedRecordIds: ["record-1"],
  editableAssetIds: ["asset-1"],
  editableRecordIds: ["record-1"],
  assignedSectionKeys: ["financial"],
};

test("viewer access edit helpers allow only explicitly editable ids for linked users", () => {
  assert.equal(canEditAssetForViewer("asset-1", linkedViewer), false);
  assert.equal(canEditAssetForViewer("asset-2", linkedViewer), false);
  assert.equal(canEditRecordForViewer("record-1", linkedViewer), false);
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

test("accepted invitation state can open Contact Wallet but not protected detail routes", () => {
  const acceptedViewer = {
    ...linkedViewer,
    activationStatus: "accepted",
    identityAssuranceLevel: LF_IDENTITY_LEVEL_1_AUTHENTICATED,
  };

  assert.equal(canViewPath("/contact-wallet", acceptedViewer), true);
  assert.equal(canViewPath("/finances", acceptedViewer), false);
  assert.equal(canViewPath("/finances/bank", acceptedViewer), false);
  assert.equal(canViewPath("/property", acceptedViewer), false);
  assert.equal(canContributeDocumentForViewer("asset-1", acceptedViewer), false);
});

test("professional adviser contribution requires explicit permission and verified identity", () => {
  assert.equal(canContributeDocumentForViewer("asset-1", linkedViewer), true);
  assert.equal(canContributeDocumentForViewer("asset-2", linkedViewer), false);
  assert.equal(canContributeDocumentForViewer("asset-1", {
    ...linkedViewer,
    permissionsOverride: { ...linkedViewer.permissionsOverride, explicitPermissions: ["view", "download"] },
  }), false);
  assert.equal(canContributeDocumentForViewer("asset-1", {
    ...linkedViewer,
    identityAssuranceLevel: LF_IDENTITY_LEVEL_1_AUTHENTICATED,
  }), false);
});

test("vault lifecycle states preserve owner active mutation and block locked states", () => {
  assert.equal(vaultAllowsOwnerMutation("OWNER_ACTIVE"), true);
  assert.equal(vaultAllowsOwnerMutation("OWNER_RECOVERY"), true);
  assert.equal(vaultAllowsOwnerMutation("DEATH_REPORTED"), false);
  assert.equal(vaultAllowsOwnerMutation("PROTECTIVE_LOCK"), false);
  assert.equal(vaultAllowsOwnerMutation("ESTATE_LOCKED"), false);
});

test("high-risk action policy requires presence re-verification", () => {
  assert.equal(canPerformHighRiskAction({ action: "increase_access", identityLevel: LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED }), false);
  assert.equal(canPerformHighRiskAction({ action: "increase_access", identityLevel: LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED }), true);
});
