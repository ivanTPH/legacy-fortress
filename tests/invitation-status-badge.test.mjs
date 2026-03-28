import test from "node:test";
import assert from "node:assert/strict";

const { resolveInvitationBadgeState } = await import("../lib/contacts/invitationStatus.ts");

test("verified badge only appears once linked access is active", () => {
  assert.deepEqual(resolveInvitationBadgeState("accepted", "active", "2026-03-28T10:00:00.000Z"), {
    tone: "success",
    label: "Verified",
  });
  assert.deepEqual(resolveInvitationBadgeState("accepted", "verified", "2026-03-28T10:00:00.000Z"), {
    tone: "success",
    label: "Verified",
  });
});

test("pending badge only applies after an invite has been sent and before activation completes", () => {
  assert.deepEqual(resolveInvitationBadgeState("pending", "invited", "2026-03-28T10:00:00.000Z"), {
    tone: "warning",
    label: "Pending",
  });
  assert.deepEqual(resolveInvitationBadgeState("accepted", "accepted", "2026-03-28T10:00:00.000Z"), {
    tone: "warning",
    label: "Pending",
  });
});

test("unsent contacts stay ready-to-send instead of looking pending", () => {
  assert.deepEqual(resolveInvitationBadgeState("pending", "invited", null), {
    tone: "neutral",
    label: "Ready to send",
  });
});
