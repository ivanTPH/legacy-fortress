import test from "node:test";
import assert from "node:assert/strict";

import {
  mapActivationStatusToVerificationStatus,
  mapInvitationStatusToCanonicalInviteStatus,
  mergeLinkedContexts,
  normalizeCanonicalLinkedContexts,
  resolveCanonicalContactDisplayRole,
  resolveCanonicalContactDisplaySourceType,
  shouldCanonicalContactIncomingSourceOwnFields,
} from "../lib/contacts/canonicalContacts.ts";

test("invitation status maps into canonical contact invite status without leaking legacy values", () => {
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("pending"), "invite_sent");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("accepted"), "accepted");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("rejected"), "rejected");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus("revoked"), "revoked");
  assert.equal(mapInvitationStatusToCanonicalInviteStatus(""), "not_invited");
});

test("activation status maps into canonical contact verification status", () => {
  assert.equal(mapActivationStatusToVerificationStatus("invited"), "invited");
  assert.equal(mapActivationStatusToVerificationStatus("pending_verification"), "pending_verification");
  assert.equal(mapActivationStatusToVerificationStatus("verification_submitted"), "verification_submitted");
  assert.equal(mapActivationStatusToVerificationStatus("verified"), "verified");
  assert.equal(mapActivationStatusToVerificationStatus("active"), "active");
  assert.equal(mapActivationStatusToVerificationStatus(""), "not_verified");
});

test("linked contexts merge by source instead of duplicating the same record link", () => {
  const merged = mergeLinkedContexts(
    [
      {
        source_kind: "record",
        source_id: "record-1",
        section_key: "personal",
        category_key: "next-of-kin",
        label: "Next of kin",
        role: "sister",
      },
    ],
    {
      source_kind: "record",
      source_id: "record-1",
      section_key: "personal",
      category_key: "next-of-kin",
      label: "Next of kin",
      role: "executor",
    },
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.role, "executor");
  assert.equal(merged[0]?.source_id, "record-1");
});

test("authoritative linked contexts replace stale placeholder contexts when the live link now exists", () => {
  const normalized = normalizeCanonicalLinkedContexts(
    [
      {
        source_kind: "asset",
        source_id: "placeholder-hsbc",
        section_key: "finances",
        category_key: "bank",
        label: "HSBC current account",
        role: "bank_contact",
      },
      {
        source_kind: "asset",
        source_id: "trustee-context",
        section_key: "legal",
        category_key: "trusts",
        label: "Family trust trustee",
        role: "trustee",
      },
    ],
    [
      {
        source_kind: "asset",
        source_id: "asset-123",
        section_key: "finances",
        category_key: "bank",
        label: "HSBC Everyday Current",
        role: "bank_contact",
      },
    ],
  );

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0]?.source_id, "asset-123");
  assert.equal(normalized[0]?.role, "bank_contact");
  assert.equal(normalized[1]?.source_id, "trustee-context");
  assert.equal(normalized[1]?.role, "trustee");
});

test("authoritative linked contexts with missing role still replace same-category placeholders", () => {
  const normalized = normalizeCanonicalLinkedContexts(
    [
      {
        source_kind: "asset",
        source_id: "placeholder-hsbc",
        section_key: "finances",
        category_key: "bank",
        label: "HSBC current account",
        role: "bank_contact",
      },
    ],
    [
      {
        source_kind: "asset",
        source_id: "asset-123",
        section_key: "finances",
        category_key: "bank",
        label: "HSBC Everyday Current",
        role: null,
      },
    ],
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.source_id, "asset-123");
});

test("email merge lets richer executor sources take over invitation-owned fields", () => {
  assert.equal(shouldCanonicalContactIncomingSourceOwnFields("invitation", "executor_asset", "email"), true);
  assert.equal(shouldCanonicalContactIncomingSourceOwnFields("next_of_kin", "invitation", "email"), false);
});

test("display role and source type prefer authoritative executor links over invitation-only labels", () => {
  const contact = {
    id: "contact-1",
    owner_user_id: "owner-1",
    full_name: "Emma Carter",
    email: "emma@example.test",
    email_normalized: "emma@example.test",
    phone: null,
    contact_role: "professional_advisor",
    relationship: null,
    linked_context: [],
    invite_status: "invite_sent",
    verification_status: "invited",
    source_type: "invitation",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const contexts = [
    {
      source_kind: "asset",
      source_id: "asset-1",
      section_key: "personal",
      category_key: "executors",
      label: "Last Will and Testament",
      role: "executor",
    },
  ];
  const latestInvitation = {
    id: "invite-1",
    contact_id: "contact-1",
    contact_name: "Emma Carter",
    contact_email: "emma@example.test",
    assigned_role: "professional_advisor",
    invitation_status: "pending",
    invited_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const latestActivation = {
    invitation_id: "invite-1",
    assigned_role: "professional_advisor",
    activation_status: "invited",
    updated_at: new Date().toISOString(),
  };

  const displayRole = resolveCanonicalContactDisplayRole(contact, contexts, latestInvitation, latestActivation);
  const sourceType = resolveCanonicalContactDisplaySourceType(contact, contexts, latestInvitation, displayRole);

  assert.equal(displayRole, "executor");
  assert.equal(sourceType, "executor_asset");
});
