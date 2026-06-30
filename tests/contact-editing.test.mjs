import test from "node:test";
import assert from "node:assert/strict";

const {
  buildCanonicalContactEditInput,
  buildContactProjectionUpdates,
  buildEditableContactValues,
} = await import("../lib/contacts/contactEditing.ts");
const {
  buildCanonicalContactProjectionCacheUpdates,
} = await import("../lib/contacts/canonicalContacts.ts");

test("contact edit input preserves canonical identity and invitation state", () => {
  const values = buildEditableContactValues({
    full_name: "Jane Doe",
    email: "jane@example.com",
    phone: "+44 7000 000000",
    contact_role: "professional_advisor",
    relationship: "solicitor",
  });

  const input = buildCanonicalContactEditInput({
    ownerUserId: "owner-1",
    current: {
      id: "contact-1",
      invite_status: "invite_sent",
      verification_status: "accepted",
      source_type: "invitation",
    },
    values: {
      ...values,
      fullName: "Jane A. Doe",
      email: "Jane.New@example.com",
    },
  });

  assert.equal(input.existingContactId, "contact-1");
  assert.equal(input.sourceType, "invitation");
  assert.equal(input.inviteStatus, "invite_sent");
  assert.equal(input.verificationStatus, "accepted");
  assert.equal(input.fullName, "Jane A. Doe");
  assert.equal(input.email, "Jane.New@example.com");
});

test("contact projection updates keep invitation and record-contact rows aligned", () => {
  const updates = buildContactProjectionUpdates({
    fullName: "John Smith",
    email: "John@Example.com",
    phone: "+44 7700 900123",
    contactRole: "executor",
    relationship: "brother",
  });

  assert.deepEqual(updates.invitations, {
    contact_name: "John Smith",
    contact_email: "john@example.com",
  });
  assert.deepEqual(updates.recordContacts, {
    contact_name: "John Smith",
    contact_email: "john@example.com",
    contact_role: "executor",
  });
});

test("canonical contact projection cache updates use canonical contact values as display truth", () => {
  const updates = buildCanonicalContactProjectionCacheUpdates({
    full_name: "Jane Canonical",
    email: "Jane.Canonical@Example.com",
    relationship: "sister",
    contact_role: "executor",
  });

  assert.equal(updates.invitation.contact_name, "Jane Canonical");
  assert.equal(updates.invitation.contact_email, "jane.canonical@example.com");
  assert.equal(updates.invitation.assigned_role, "executor");
  assert.equal(updates.recordContact.contact_name, "Jane Canonical");
  assert.equal(updates.recordContact.contact_email, "jane.canonical@example.com");
  assert.equal(updates.recordContact.contact_role, "sister");
  assert.equal(updates.accountAccessGrant.relationship, "sister");
  assert.equal(updates.accountAccessGrant.assigned_role, "executor");
});
