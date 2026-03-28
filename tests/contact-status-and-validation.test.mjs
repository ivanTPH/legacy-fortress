import test from "node:test";
import assert from "node:assert/strict";

const { resolveContactStatusBadge } = await import("../lib/contacts/contactStatus.ts");
const {
  buildContactLinkValidationKey,
  evaluateContactLinkValidation,
} = await import("../lib/contacts/contactLinkValidation.ts");

test("contact status badge resolves ready to send for unsent contacts with email", () => {
  const status = resolveContactStatusBadge({
    email: "sarah@example.com",
    inviteStatus: "not_invited",
    verificationStatus: "not_verified",
  });

  assert.deepEqual(status, {
    label: "Ready to send",
    tone: "neutral",
  });
});

test("contact status badge resolves verified for active contacts", () => {
  const status = resolveContactStatusBadge({
    email: "sarah@example.com",
    inviteStatus: "accepted",
    verificationStatus: "active",
  });

  assert.deepEqual(status, {
    label: "Verified",
    tone: "success",
  });
});

test("contact link validation matches names found in metadata text", () => {
  const validation = evaluateContactLinkValidation({
    contactName: "Sarah Smith",
    sourceText: "Passport holder Sarah Smith document title identity document",
  });

  assert.equal(validation.state, "matched");
  assert.equal(validation.label, "Matched");
});

test("contact link validation warns on missing name evidence and supports manual confirmation", () => {
  const warning = evaluateContactLinkValidation({
    contactName: "Sarah Smith",
    sourceText: "Passport holder identity document",
  });
  assert.equal(warning.state, "warning");

  const confirmed = evaluateContactLinkValidation({
    contactName: "Sarah Smith",
    sourceText: "Passport holder identity document",
    manuallyConfirmed: true,
  });
  assert.equal(confirmed.state, "confirmed");
  assert.equal(buildContactLinkValidationKey({ source_kind: "asset", source_id: "asset-1" }), "asset:asset-1");
});
