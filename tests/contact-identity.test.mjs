import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveLatestSavedContactIdentityReference,
  resolveSavedCanonicalContactIdForSource,
} from "../lib/contacts/contactIdentity.ts";

test("reuse without email preserves the existing canonical contact id when the saved source reference is present", () => {
  const contactId = resolveSavedCanonicalContactIdForSource(
    [
      {
        sourceId: "record-1",
        contactId: "contact-123",
        createdAt: "2026-03-27T12:00:00.000Z",
      },
    ],
    "record-1",
  );

  assert.equal(contactId, "contact-123");
});

test("legacy/legal resave uses the latest saved canonical contact identity for the record source", () => {
  const reference = resolveLatestSavedContactIdentityReference(
    [
      {
        sourceId: "record-1",
        contactId: "contact-old",
        createdAt: "2026-03-27T10:00:00.000Z",
      },
      {
        sourceId: "record-2",
        contactId: "contact-other",
        createdAt: "2026-03-27T11:00:00.000Z",
      },
      {
        sourceId: "record-1",
        contactId: "contact-current",
        createdAt: "2026-03-27T12:00:00.000Z",
      },
    ],
    "record-1",
  );

  assert.equal(reference?.contactId, "contact-current");
  assert.equal(reference?.sourceId, "record-1");
});
