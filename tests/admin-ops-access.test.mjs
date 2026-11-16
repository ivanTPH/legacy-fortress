import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const {
  MASTER_ADMIN_EMAIL,
  normalizeAdminEmail,
  isMasterAdminEmail,
  isAdminAccessGranted,
} = await import("../lib/admin/access.ts");
const {
  buildVerificationMutation,
  buildSupportIssueLabel,
  normalizeAdminUserLifecycleAction,
} = await import("../lib/admin/operations.ts");

test("admin email normalization is stable", () => {
  assert.equal(normalizeAdminEmail("  IVANYARDLEY@ME.COM "), MASTER_ADMIN_EMAIL);
  assert.equal(isMasterAdminEmail("IvAnYardley@me.com"), true);
});

test("admin access respects persisted status after master bootstrap creates a row", () => {
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, null), false);
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, { status: "active", is_master: true }), true);
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, { status: "inactive", is_master: true }), false);
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
  assert.equal(buildSupportIssueLabel("failed", "invited"), "Invitation delivery failed");
  assert.equal(buildSupportIssueLabel("accepted", "verification_submitted"), "Awaiting verification review");
  assert.equal(buildSupportIssueLabel("accepted", "accepted"), "Accepted access awaiting activation");
});

test("admin support snapshot distinguishes sent pending invites from saved unsent setups", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/admin/operations.ts"), "utf8");

  assert.match(source, /countSentPendingContactInvitations/);
  assert.match(source, /countReadyToSendContactInvitations/);
  assert.match(source, /\.not\("sent_at", "is", null\)/);
  assert.match(source, /\.is\("sent_at", null\)/);
  assert.match(source, /item\.invitationStatus === "pending" && Boolean\(item\.sentAt\)/);
});

test("admin lifecycle actions are explicitly normalised", () => {
  assert.equal(normalizeAdminUserLifecycleAction("activate"), "activate");
  assert.equal(normalizeAdminUserLifecycleAction("deactivate"), "deactivate");
  assert.equal(normalizeAdminUserLifecycleAction("change_role"), "change_role");
  assert.equal(normalizeAdminUserLifecycleAction("delete"), null);
  assert.equal(normalizeAdminUserLifecycleAction(""), null);
});

test("Admin Users lists the newest accounts first and counts this week's, with no record details (owner, 16 Nov 2026)", () => {
  const ops = fs.readFileSync(new URL("../lib/admin/operations.ts", import.meta.url), "utf8");
  assert.match(ops, /export async function listAuthUsersNewestFirst/);
  assert.match(ops, /localeCompare\(String\(left\.created_at/);
  assert.match(ops, /export async function countNewAccounts/);
  const route = fs.readFileSync(new URL("../app/api/internal/admin/users/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminCapability\(admin\.access, "users:lookup"\)/, "still needs the lookup capability");
  assert.match(route, /recordAdminAuditEvent/, "still audited");
  assert.match(route, /const newThisWeek = query\.trim\(\) \? null : await countNewAccounts/);
  const ui = fs.readFileSync(new URL("../components/admin/AdminControlPlaneWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /new in the last 7 days/);
  assert.match(ui, /header: "Signed up"/);
  assert.match(ui, /if \(state !== "ready" \|\| section !== "users"\) return;/);
});
