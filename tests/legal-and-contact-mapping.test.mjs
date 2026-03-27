import test from "node:test";
import assert from "node:assert/strict";

const {
  resolveLegalCategoryForAsset,
  assetMatchesLegalCategory,
  getLegalLinkedContactDefinition,
  usesCanonicalLegalAssetRead,
} = await import("../lib/legalCategories.ts");
const { resolveContactGroupKey } = await import("../lib/contacts/contactGrouping.ts");
const { getAssetCategoryFormConfig } = await import("../lib/assets/fieldDictionary.ts");

test("personal executor assets with will titles resolve to legal wills", () => {
  const row = {
    section_key: "personal",
    category_key: "executors",
    title: "Last Will and Testament",
    metadata_json: {
      executor_type: "executor",
      instruction_reference: "Will oversight",
    },
  };

  assert.equal(resolveLegalCategoryForAsset(row), "wills");
  assert.equal(assetMatchesLegalCategory(row, "wills"), true);
});

test("power of attorney assets resolve to legal power-of-attorney", () => {
  const row = {
    section_key: "legal",
    category_key: "power-of-attorney",
    title: "Property and financial affairs LPA",
    metadata_json: {
      document_title: "Property and financial affairs LPA",
    },
  };

  assert.equal(resolveLegalCategoryForAsset(row), "power-of-attorney");
  assert.equal(assetMatchesLegalCategory(row, "power-of-attorney"), true);
});

test("contacts prefer executor grouping over family-like context text", () => {
  const executorContact = {
    id: "1",
    full_name: "Emma Carter",
    email: "emma@example.test",
    phone: "07700 900112",
    contact_role: "executor",
    relationship: "friend",
    invite_status: "invite_sent",
    verification_status: "invited",
    source_type: "executor_asset",
    linked_context: [
      { role: "executor", label: "Last Will and Testament", category_key: "executors", section_key: "personal" },
      { role: "trustee", label: "Family trust trustee", category_key: "trusts", section_key: "legal" },
    ],
    updated_at: new Date().toISOString(),
  };

  assert.equal(resolveContactGroupKey(executorContact), "executors");
});

test("next of kin stays grouped as next of kin when no stronger role exists", () => {
  const nextOfKinContact = {
    id: "2",
    full_name: "Sarah Smith",
    email: "sarah@example.test",
    phone: "07700 900111",
    contact_role: "family_contact",
    relationship: "spouse_partner",
    invite_status: "not_invited",
    verification_status: "not_verified",
    source_type: "next_of_kin",
    linked_context: [{ role: "spouse_partner", label: "Next of kin", category_key: "next-of-kin", section_key: "personal" }],
    updated_at: new Date().toISOString(),
  };

  assert.equal(resolveContactGroupKey(nextOfKinContact), "next_of_kin");
});

test("legal linked contacts share category-specific default roles", () => {
  assert.equal(getLegalLinkedContactDefinition("wills")?.defaultRole, "executor");
  assert.equal(getLegalLinkedContactDefinition("trusts")?.defaultRole, "trustee");
  assert.equal(getLegalLinkedContactDefinition("power-of-attorney")?.defaultRole, "advocate");
  assert.equal(getLegalLinkedContactDefinition("funeral-wishes")?.defaultRole, "family_member");
});

test("identity documents share the canonical legal asset read path", () => {
  assert.equal(usesCanonicalLegalAssetRead("power-of-attorney"), true);
  assert.equal(usesCanonicalLegalAssetRead("identity-documents"), true);
  assert.equal(usesCanonicalLegalAssetRead("wills"), false);
});

test("identity documents are available through the shared field dictionary", () => {
  const config = getAssetCategoryFormConfig("identity-documents");
  assert.ok(config);
  assert.equal(config?.fields.some((field) => field.key === "identity_document_type"), true);
  assert.equal(config?.fields.some((field) => field.key === "identity_document_number"), true);
  assert.equal(config?.fields.some((field) => field.key === "renewal_date"), true);
});
