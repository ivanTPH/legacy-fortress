import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActionQueueGroups,
  buildContactActionKey,
  buildVerificationActionKey,
  deriveBlockingState,
  resolveWorkflowActionHref,
} from "../lib/workflow/blockingModel.ts";

test("Create two blockers with different requiredRole values and confirm grouping and priority order", () => {
  const blockers = deriveBlockingState(
    {
      profile: {
        hasProfile: true,
        hasAddress: true,
        hasContact: true,
      },
    },
    {
      personal: { total: 1 },
      financial: { total: 1 },
      legal: { total: 1 },
      property: { total: 1 },
      business: { total: 1 },
      digital: { total: 1 },
      contacts: [
        {
          id: "contact-owner",
          fullName: "Owner Action",
          email: "owner@example.com",
          inviteStatus: "not_invited",
          verificationStatus: "not_verified",
        },
        {
          id: "contact-pending",
          fullName: "Contact Action",
          email: "pending@example.com",
          inviteStatus: "invite_sent",
          verificationStatus: "invited",
        },
      ],
    },
  );

  const queue = buildActionQueueGroups(blockers);

  assert.equal(queue.length, 2);
  assert.equal(queue[0].requiredRole, "owner");
  assert.equal(queue[1].requiredRole, "contact");
  assert.deepEqual(queue[0].items.map((item) => item.actionKey), [buildContactActionKey("contact-owner")]);
  assert.deepEqual(queue[1].items.map((item) => item.actionKey), [buildContactActionKey("contact-pending")]);
});

test("verification blockers derive admin action keys and dashboard routes resolve predictably", () => {
  const blockers = deriveBlockingState(
    {
      profile: {
        hasProfile: true,
        hasAddress: true,
        hasContact: true,
      },
    },
    {
      personal: { total: 1 },
      financial: { total: 1 },
      legal: { total: 1 },
      property: { total: 1 },
      business: { total: 1 },
      digital: { total: 1 },
      verificationRequests: [
        {
          id: "verification-1",
          contactName: "Verifier Contact",
          requestType: "death_certificate",
          requestStatus: "submitted",
        },
      ],
    },
  );

  assert.equal(blockers[0].requiredRole, "admin");
  assert.equal(blockers[0].actionKey, buildVerificationActionKey("verification-1"));
  assert.equal(resolveWorkflowActionHref(blockers[0].actionKey), "/internal/admin");
});
