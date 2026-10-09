import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveOwnerAccessEligibility } from "../lib/contacts/accessEligibility.ts";

const root = process.cwd();

test("owner access eligibility follows invitation, linking and assurance state", () => {
  assert.equal(resolveOwnerAccessEligibility({ invitationStatus: "not_invited", activationStatus: null, assignedRole: "friend_or_family" }), "not_invited");
  assert.equal(resolveOwnerAccessEligibility({ invitationStatus: "invite_sent", activationStatus: "invited", assignedRole: "friend_or_family" }), "invitation_pending");
  assert.equal(resolveOwnerAccessEligibility({ invitationStatus: "accepted", activationStatus: "accepted", assignedRole: "friend_or_family" }), "link_required");
  assert.equal(resolveOwnerAccessEligibility({ invitationStatus: "accepted", activationStatus: "verified", linkedUserId: "user-1", assignedRole: "friend_or_family" }), "eligible");
  assert.equal(resolveOwnerAccessEligibility({ invitationStatus: "accepted", activationStatus: "accepted", linkedUserId: "user-1", assignedRole: "professional_advisor" }), "verification_required");
  assert.equal(resolveOwnerAccessEligibility({ invitationStatus: "accepted", activationStatus: "active", linkedUserId: "user-1", assignedRole: "executor" }), "executor_restricted");
});

test("People I Trust access UI exposes state-aware management without changing grant architecture", () => {
  const workspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  assert.match(workspace, /activation_status.*accepted.*pending_verification.*verification_submitted.*verified.*active/);
  assert.match(workspace, /must accept your invitation before you can share Vault records/);
  assert.match(workspace, /Being recorded as an executor does not give this person access/);
  assert.match(workspace, /Give access/);
  assert.match(workspace, /Edit access/);
  assert.match(workspace, /Remove access/);
  assert.match(workspace, /loadPeopleScopeResourcesForOwner/);
  assert.match(workspace, /account_access_grants/);
  assert.match(workspace, /access_updated/);
  assert.match(workspace, /access_revoked/);
});
