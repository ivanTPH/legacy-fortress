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
import {
  buildPeopleContactEntity,
  getCanonicalPeopleRelationshipType,
  PEOPLE_CONTACT_MIGRATION_STRATEGY,
  PEOPLE_CONTACT_REPOSITORY_CONTRACT,
} from "../lib/contacts/contactRepository.ts";

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

test("people contact entity preserves executor relationship, verification, invite, and permission state", () => {
  const contact = {
    id: "contact-executor",
    owner_user_id: "owner-1",
    full_name: "Emma Carter",
    email: "emma@example.test",
    email_normalized: "emma@example.test",
    phone: "0207 000 1000",
    contact_role: "executor",
    relationship: "sister",
    linked_context: [
      {
        source_kind: "asset",
        source_id: "asset-will",
        section_key: "legal",
        category_key: "executors",
        label: "Executor",
        role: "executor",
      },
    ],
    invite_status: "invite_sent",
    verification_status: "invited",
    source_type: "executor_asset",
    permission_scope: ["executor_access"],
    validation_overrides: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const entity = buildPeopleContactEntity(contact);

  assert.equal(entity.relationship_type, "executor");
  assert.equal(entity.invitation_state, "invite_sent");
  assert.equal(entity.verification_state, "invited");
  assert.deepEqual(entity.permission_scope, ["executor_access"]);
});

test("people relationship vocabulary covers trusted contacts, next of kin, invitees, and linked users", () => {
  assert.equal(
    getCanonicalPeopleRelationshipType({
      contact_role: "next_of_kin",
      relationship: "sister",
      source_type: "next_of_kin",
      linked_context: [],
    }),
    "next_of_kin",
  );
  assert.equal(
    getCanonicalPeopleRelationshipType({
      contact_role: "trusted_contact",
      relationship: "friend",
      source_type: "invitation",
      linked_context: [{ source_kind: "invitation", source_id: "invite-1", role: "trusted_contact" }],
    }),
    "trusted_contact",
  );
  assert.equal(
    getCanonicalPeopleRelationshipType({
      contact_role: "professional_advisor",
      relationship: null,
      source_type: "invitation",
      linked_context: [{ source_kind: "invitation", source_id: "invite-2", role: "professional_advisor" }],
    }),
    "invitee",
  );
  assert.equal(
    getCanonicalPeopleRelationshipType({
      contact_role: "solicitor",
      relationship: null,
      source_type: "record_contact",
      linked_context: [{ source_kind: "record", source_id: "record-1", role: "solicitor" }],
    }),
    "linked_user",
  );
});

test("people migration strategy keeps legacy compatibility without expanding section_entries", () => {
  assert.equal(PEOPLE_CONTACT_REPOSITORY_CONTRACT.migrationState, "compatibility_preserved");
  assert.ok(PEOPLE_CONTACT_REPOSITORY_CONTRACT.compatibilityTables.includes("section_entries"));
  assert.match(PEOPLE_CONTACT_MIGRATION_STRATEGY.compatibility.join(" "), /SectionWorkspace/);
  assert.match(PEOPLE_CONTACT_MIGRATION_STRATEGY.compatibility.join(" "), /must not be expanded/);
});
