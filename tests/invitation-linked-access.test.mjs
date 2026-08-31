import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { buildInvitationEmailDraft } = await import("../lib/contacts/invitations.ts");
const { canViewPath, filterAssetIdsForViewer } = await import("../lib/access-control/viewerAccess.ts");

const root = process.cwd();

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
  assert.match(draft.bodyText, /Acceptance does not by itself unlock/i);
  assert.match(draft.bodyText, /required verification or unlock process/i);
  assert.equal(draft.acceptPath, "/invite/accept?invitation=invite-123&token=token-456");
});

test("accepted executors can open Contact Wallet but not protected linked-account routes", () => {
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
    identityAssuranceLevel: 1,
    requiredIdentityLevel: 2,
    vaultLifecycleState: "OWNER_ACTIVE",
    permissionsOverride: { allowedSections: [], assetIds: [], recordIds: [], explicitPermissions: [] },
    assignedAssetIds: [],
    assignedRecordIds: [],
    editableAssetIds: [],
    editableRecordIds: [],
    assignedSectionKeys: [],
  };

  assert.equal(canViewPath("/contact-wallet", viewer), true);
  assert.equal(canViewPath("/dashboard", viewer), false);
  assert.equal(canViewPath("/profile", viewer), false);
  assert.equal(canViewPath("/finances/bank", viewer), false);
  assert.equal(canViewPath("/legal/wills", viewer), false);
  assert.equal(canViewPath("/vault/property", viewer), false);
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
    activationStatus: "active",
    readOnly: true,
    canUpgradeToOwnAccount: true,
    identityAssuranceLevel: 2,
    requiredIdentityLevel: 2,
    vaultLifecycleState: "OWNER_ACTIVE",
    permissionsOverride: { allowedSections: ["financial"], assetIds: ["asset-1"], recordIds: [], explicitPermissions: ["view", "view_detail", "download"] },
    assignedAssetIds: ["asset-1"],
    assignedRecordIds: [],
    editableAssetIds: [],
    editableRecordIds: [],
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
    identityAssuranceLevel: 2,
    requiredIdentityLevel: 2,
    vaultLifecycleState: "OWNER_ACTIVE",
    permissionsOverride: { allowedSections: ["financial"], assetIds: ["asset-keep"], recordIds: [], explicitPermissions: ["view", "view_detail", "download"] },
    assignedAssetIds: ["asset-keep"],
    assignedRecordIds: [],
    editableAssetIds: [],
    editableRecordIds: [],
    assignedSectionKeys: ["financial"],
  };

  const rows = filterAssetIdsForViewer([
    { id: "asset-keep", section_key: "finances" },
    { id: "asset-drop", section_key: "finances" },
    { id: "asset-legal", section_key: "legal" },
  ], viewer);

  assert.deepEqual(rows.map((row) => row.id), ["asset-keep"]);
});

test("invitation acceptance routes accepted linked users into Contact Wallet", () => {
  const acceptPage = fs.readFileSync(path.join(root, "app/invite/accept/InvitationAcceptPageClient.tsx"), "utf8");
  const walletPage = fs.readFileSync(path.join(root, "app/(app)/contact-wallet/page.tsx"), "utf8");

  assert.match(acceptPage, /router\.replace\("\/contact-wallet"\)/);
  assert.match(acceptPage, /Accept \$\{getRoleLabel\(summary\.assigned_role as never\)\} role and continue/);
  assert.match(acceptPage, /owner: result\.account_holder_name/);
  assert.match(acceptPage, /role: result\.assigned_role/);
  assert.match(acceptPage, /does not create a paid subscription/);
  assert.match(acceptPage, /does not unlock unrelated private records/);
  assert.match(walletPage, /Contact Wallet/);
  assert.match(walletPage, /People you support/);
  assert.match(walletPage, /paid personal subscription/);
  assert.match(walletPage, /loadViewerAccessState/);
  assert.match(walletPage, /includePreVerificationGrants: true/);
});

test("executor IDV completion keeps identity separate from authority and offers a role handoff", () => {
  const verifyPage = fs.readFileSync(path.join(root, "app/identity/verify/IdentityVerificationPageClient.tsx"), "utf8");
  assert.match(verifyPage, /Your identity has been verified/);
  assert.match(verifyPage, /Continue to \{labelise\(invitedRole\)\} role/);
  assert.match(verifyPage, /Authority and estate-access requirements are assessed separately/);
  assert.match(verifyPage, /Set up my Personal Vault later/);
  assert.doesNotMatch(verifyPage, /Verified Executor/);
});
