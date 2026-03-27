import test from "node:test";
import assert from "node:assert/strict";

const plan = await import("../lib/accountPlan.ts");

test("owner plan defaults stay stable", () => {
  const profile = plan.normalizeOwnerPlanProfile("user-1", null);
  assert.equal(profile.accountPlan, "starter");
  assert.equal(profile.planStatus, "active");
  assert.equal(profile.recordLimit, plan.STARTER_RECORD_LIMIT);
  assert.equal(profile.invitationLimit, plan.STARTER_INVITATION_LIMIT);
});

test("account kind stays distinct from collaborator access role", () => {
  assert.equal(plan.resolveAccountKind({ viewerMode: "owner", isDemoExperience: false, isAdmin: false }), "owner");
  assert.equal(plan.resolveAccountKind({ viewerMode: "linked", isDemoExperience: false, isAdmin: false }), "linked_view_only");
  assert.equal(plan.resolveAccountKind({ viewerMode: "linked", isDemoExperience: true, isAdmin: false }), "demo_reviewer");
  assert.equal(plan.resolveAccountKind({ viewerMode: "owner", isDemoExperience: false, isAdmin: true }), "admin_internal");
});

test("starter plan gates record and invitation volume while premium stays open", () => {
  const starter = plan.normalizeOwnerPlanProfile("user-2", {
    account_plan: "starter",
    record_limit: 2,
    invitation_limit: 1,
  });
  assert.throws(() => plan.assertOwnerCanCreateRecord(starter, 2), /Starter plan limit reached/);
  assert.doesNotThrow(() => plan.assertOwnerCanSendInvitation(starter, 1));
  assert.throws(() => plan.assertOwnerCanSendInvitation(starter, 2), /Starter plan limit reached/);

  const premium = plan.normalizeOwnerPlanProfile("user-3", {
    account_plan: "premium",
    record_limit: null,
    invitation_limit: null,
  });
  assert.doesNotThrow(() => plan.assertOwnerCanCreateRecord(premium, 500));
  assert.doesNotThrow(() => plan.assertOwnerCanSendInvitation(premium, 500));
});
