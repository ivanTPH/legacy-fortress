import test from "node:test";
import assert from "node:assert/strict";

const {
  MASTER_ADMIN_EMAIL,
  normalizeAdminEmail,
  isMasterAdminEmail,
  isAdminAccessGranted,
} = await import("../lib/admin/access.ts");
const {
  buildVerificationMutation,
  buildSupportIssueLabel,
} = await import("../lib/admin/operations.ts");

test("admin email normalization is stable", () => {
  assert.equal(normalizeAdminEmail("  IVANYARDLEY@ME.COM "), MASTER_ADMIN_EMAIL);
  assert.equal(isMasterAdminEmail("IvAnYardley@me.com"), true);
});

test("admin access grants master access even without a row", () => {
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, null), true);
  assert.equal(isAdminAccessGranted("viewer@example.com", null), false);
  assert.equal(isAdminAccessGranted("viewer@example.com", { status: "active", is_master: false }), true);
  assert.equal(isAdminAccessGranted("viewer@example.com", { status: "inactive", is_master: false }), false);
});

test("verification mutation maps approve reject and review actions safely", () => {
  assert.deepEqual(buildVerificationMutation("approve"), {
    requestStatus: "approved",
    roleActivationStatus: "verified",
    grantActivationStatus: "verified",
  });
  assert.deepEqual(buildVerificationMutation("reject"), {
    requestStatus: "rejected",
    roleActivationStatus: "rejected",
    grantActivationStatus: "rejected",
  });
  assert.deepEqual(buildVerificationMutation("review"), {
    requestStatus: null,
    roleActivationStatus: null,
    grantActivationStatus: null,
  });
});

test("support issue labels stay human-readable", () => {
  assert.equal(buildSupportIssueLabel("pending", "invited"), "Invitation still pending");
  assert.equal(buildSupportIssueLabel("accepted", "verification_submitted"), "Awaiting verification review");
  assert.equal(buildSupportIssueLabel("accepted", "accepted"), "Accepted access awaiting activation");
});

