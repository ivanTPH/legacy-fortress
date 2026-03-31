import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalInvitationProjectionPayload,
  buildCanonicalRecordContactProjectionPayload,
  mergeLinkedContexts,
  normalizeCanonicalLinkedContexts,
} from "../lib/contacts/canonicalContacts.ts";

test("canonical contact projections reuse the same contact entity across invitation and record compatibility rows", () => {
  const contact = {
    id: "contact-1",
    full_name: "Sarah Smith",
    email: "Sarah@Example.com",
    relationship: "sister",
    contact_role: "executor",
  };

  const invitation = buildCanonicalInvitationProjectionPayload({
    ownerUserId: "owner-1",
    contact,
    assignedRole: "executor",
    invitationStatus: "pending",
    invitedAt: "2026-03-31T10:00:00.000Z",
    updatedAt: "2026-03-31T10:00:00.000Z",
  });
  const recordContact = buildCanonicalRecordContactProjectionPayload({
    ownerUserId: "owner-1",
    recordId: "record-1",
    contact,
    notes: "Will contact",
  });

  assert.equal(invitation.invitation.contact_id, "contact-1");
  assert.equal(recordContact.contact_id, "contact-1");
  assert.equal(invitation.invitation.contact_email, "sarah@example.com");
  assert.equal(recordContact.contact_email, "sarah@example.com");
});

test("canonical contact contexts merge multiple personal and trust links into one shared entity", () => {
  const merged = normalizeCanonicalLinkedContexts(
    mergeLinkedContexts(
      [
        {
          source_kind: "record",
          source_id: "record-next-of-kin",
          section_key: "personal",
          category_key: "next-of-kin",
          label: "Next of kin",
          role: "spouse_partner",
        },
      ],
      {
        source_kind: "asset",
        source_id: "asset-executor",
        section_key: "personal",
        category_key: "executors",
        label: "Last Will and Testament",
        role: "executor",
      },
    ),
    [
      {
        source_kind: "record",
        source_id: "record-next-of-kin",
        section_key: "personal",
        category_key: "next-of-kin",
        label: "Next of kin",
        role: "spouse_partner",
      },
      {
        source_kind: "asset",
        source_id: "asset-executor",
        section_key: "personal",
        category_key: "executors",
        label: "Last Will and Testament",
        role: "executor",
      },
    ],
  );

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((item) => `${item.source_kind}:${item.source_id}`),
    ["record:record-next-of-kin", "asset:asset-executor"],
  );
});
