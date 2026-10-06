import test from "node:test";
import assert from "node:assert/strict";

const { applyGuidanceAction, buildGuidanceItems } = await import("../lib/readiness/guidance.ts");
const { getDefaultVaultPreferences, normalizeVaultPreferences, setVaultApplicability } = await import("../lib/vaultPreferences.ts");

const emptyEvidence = {
  willCount: 0,
  powerOfAttorneyCount: 0,
  trustedPeopleCount: 0,
  executorCount: 0,
  digitalRecordCount: 0,
  possessionCount: 0,
  wishesCount: 0,
  financeRecordCount: 0,
};

test("guidance is generated from structured evidence with calm, actionable states", () => {
  const items = buildGuidanceItems(emptyEvidence, getDefaultVaultPreferences());
  assert.ok(items.some((item) => item.key === "will" && item.title === "Do you have a Will?"));
  assert.ok(items.some((item) => item.key === "capacity_arrangements"));
  assert.ok(items.every((item) => !item.title.toUpperCase().startsWith("MISSING")));
});

test("Will applicability answers change the journey without claiming a record exists", () => {
  const noWill = buildGuidanceItems(emptyEvidence, setVaultApplicability(getDefaultVaultPreferences(), "will", "no"));
  assert.equal(noWill.find((item) => item.key === "will")?.actionLabel, "Explore my options");
  assert.equal(noWill.find((item) => item.key === "will")?.href, "/support?topic=will");

  const unsure = buildGuidanceItems(emptyEvidence, setVaultApplicability(getDefaultVaultPreferences(), "will", "unsure"));
  assert.equal(unsure.find((item) => item.key === "will")?.actionLabel, "Learn about Wills");

  const yes = buildGuidanceItems(emptyEvidence, setVaultApplicability(getDefaultVaultPreferences(), "will", "yes"));
  assert.equal(yes.find((item) => item.key === "will")?.href, "/legal/wills?add=1");
  assert.notEqual(yes.find((item) => item.key === "will")?.state, "recorded");
});

test("recorded evidence resolves guidance without inventing a readiness score", () => {
  const items = buildGuidanceItems({ ...emptyEvidence, willCount: 1, trustedPeopleCount: 1 });
  assert.equal(items.some((item) => item.key === "will"), false);
  assert.equal(items.some((item) => item.key === "people_i_trust"), false);
  assert.ok(items.some((item) => item.key === "digital_life"));
});

test("recorded Will and capacity information create contextual people next actions", () => {
  const items = buildGuidanceItems({ ...emptyEvidence, willCount: 1 });
  assert.equal(items.some((item) => item.key === "will"), false);
  assert.equal(items.find((item) => item.key === "executor_after_will")?.href, "/contacts?group=executors");

  const capacityItems = buildGuidanceItems({ ...emptyEvidence, powerOfAttorneyCount: 1 });
  assert.equal(capacityItems.find((item) => item.key === "attorney_after_capacity")?.href, "/contacts?group=trusted-contacts");
});

test("executor evidence resolves the executor journey without treating any trusted person as an executor", () => {
  const items = buildGuidanceItems({ ...emptyEvidence, willCount: 1, trustedPeopleCount: 1 });
  assert.ok(items.some((item) => item.key === "executor_after_will"));
  const resolved = buildGuidanceItems({ ...emptyEvidence, willCount: 1, executorCount: 1 });
  assert.equal(resolved.some((item) => item.key === "executor_after_will"), false);
});

test("onboarding self-report does not claim a record exists without evidence", () => {
  const preferences = normalizeVaultPreferences({ applicability: { will: "recorded" } });
  assert.equal(buildGuidanceItems(emptyEvidence, preferences).find((item) => item.key === "will")?.state, "needs_review");
});

test("guidance decisions distinguish not relevant, snoozed and owner-reported completion", () => {
  const base = normalizeVaultPreferences({});
  const notRelevant = applyGuidanceAction(base, "will", "not_relevant", new Date("2026-10-01T00:00:00Z"));
  assert.equal(buildGuidanceItems(emptyEvidence, notRelevant).some((item) => item.key === "will"), false);

  const snoozed = applyGuidanceAction(base, "will", "remind_later", new Date("2026-10-01T00:00:00Z"));
  assert.equal(buildGuidanceItems(emptyEvidence, snoozed, new Date("2026-10-02T00:00:00Z")).some((item) => item.key === "will"), false);
  assert.equal(buildGuidanceItems(emptyEvidence, snoozed, new Date("2026-11-02T00:00:00Z")).some((item) => item.key === "will"), true);

  const alreadyDone = applyGuidanceAction(base, "will", "already_done", new Date("2026-10-01T00:00:00Z"));
  assert.equal(alreadyDone.guidance.will.state, "needs_review");
  assert.equal(buildGuidanceItems(emptyEvidence, alreadyDone).find((item) => item.key === "will")?.state, "needs_review");
});

test("guidance module has no access or invitation mutation path", () => {
  assert.equal(typeof applyGuidanceAction, "function");
  assert.equal(typeof buildGuidanceItems, "function");
});
