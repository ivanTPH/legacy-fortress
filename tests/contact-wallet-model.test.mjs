import test from "node:test";
import assert from "node:assert/strict";

const {
  CONTACT_WALLET_ASSURANCE_LEVELS,
  CONTACT_WALLET_ENTITLEMENT,
  buildContactWalletTasks,
  buildSupportedPersonSummary,
  getContactWalletAssuranceLevel,
} = await import("../lib/contactWallet.ts");

const linkedViewer = {
  mode: "linked",
  grantId: "grant-1",
  sessionUserId: "identity-1",
  targetOwnerUserId: "owner-1",
  accountHolderName: "Jane Smith",
  linkedContactId: "contact-1",
  linkedContactName: "Alex Executor",
  viewerRole: "executor",
  activationStatus: "accepted",
  readOnly: true,
  canUpgradeToOwnAccount: true,
  permissionsOverride: { allowedSections: ["legal"], assetIds: [], recordIds: [], editableAssetIds: [], editableRecordIds: [] },
  assignedAssetIds: [],
  assignedRecordIds: [],
  editableAssetIds: [],
  editableRecordIds: [],
  assignedSectionKeys: ["legal"],
};

test("Contact Wallet entitlement stays free and separate from personal subscription", () => {
  assert.equal(CONTACT_WALLET_ENTITLEMENT.key, "contact_wallet");
  assert.equal(CONTACT_WALLET_ENTITLEMENT.paidSubscriptionRequired, false);
  assert.equal(CONTACT_WALLET_ENTITLEMENT.conversionOptional, true);
});

test("Contact Wallet assurance levels are explicit and progressive", () => {
  assert.equal(getContactWalletAssuranceLevel({}), 0);
  assert.equal(getContactWalletAssuranceLevel({ emailVerified: true }), 1);
  assert.equal(getContactWalletAssuranceLevel({ emailVerified: true, phoneVerified: true, mfaEnabled: true }), 2);
  assert.equal(getContactWalletAssuranceLevel({ emailVerified: true, phoneVerified: true, mfaEnabled: true, kycVerified: true }), 3);
  assert.equal(getContactWalletAssuranceLevel({ emailVerified: true, phoneVerified: true, mfaEnabled: true, kycVerified: true, recentStrongAuth: true }), 4);
  assert.match(CONTACT_WALLET_ASSURANCE_LEVELS[3].permitted.join(" "), /Upload authorised evidence/);
  assert.match(CONTACT_WALLET_ASSURANCE_LEVELS[4].blocked.join(" "), /outside the explicit relationship grant/);
});

test("Contact Wallet summary preserves identity, contact, relationship and grant boundaries", () => {
  const summary = buildSupportedPersonSummary(linkedViewer);

  assert.equal(summary.ownerUserId, "owner-1");
  assert.equal(summary.accountHolderName, "Jane Smith");
  assert.equal(summary.contactName, "Alex Executor");
  assert.equal(summary.role, "executor");
  assert.equal(summary.grantId, "grant-1");
  assert.deepEqual(summary.allowedSections, ["legal"]);
  assert.equal(summary.conversionOptional, true);
});

test("Contact Wallet tasks do not unlock protected evidence before assurance level 3", () => {
  const earlyTasks = buildContactWalletTasks(linkedViewer, 1);
  const verifiedTasks = buildContactWalletTasks(linkedViewer, 3);

  assert.equal(earlyTasks.find((task) => task.id === "probate-readiness")?.status, "blocked");
  assert.equal(verifiedTasks.find((task) => task.id === "probate-readiness")?.status, "available");
});
