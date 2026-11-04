import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { buildNextSteps, emailLines, namedPeople } from "../lib/readiness/nextSteps.ts";

const now = new Date("2026-11-04T12:00:00Z");
const will = { id: "w1", kind: "asset", section_key: "legal", category_key: "wills", title: "My Will", status: "active" };
const base = () => ({ rows: [], willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [] });
const keys = (steps) => steps.map((item) => item.key);

test("an empty Vault is asked about a Will; a Vault with a Will isn't", () => {
  assert.ok(keys(buildNextSteps(base(), undefined, now)).includes("will"));
  assert.ok(!keys(buildNextSteps({ ...base(), rows: [will] }, undefined, now)).includes("will"));
});

test("Will → people it names → invite → reminder → choose what they receive", () => {
  // Names found in the Will, not yet reviewed.
  let facts = { ...base(), rows: [will], suggestions: [
    { recordId: "w1", name: "Sarah Smith", role: "Executor", status: "pending", matchPersonId: null },
    { recordId: "w1", name: "Tom Smith", role: "Reserve executor", status: "pending", matchPersonId: null },
  ] };
  let steps = buildNextSteps(facts, undefined, now);
  const review = steps.find((item) => item.key === "review_executors");
  assert.match(review.title, /Sarah Smith and Tom Smith/);
  assert.equal(review.emailTitle, "Check the executors found in your Will");
  assert.ok(!keys(steps).includes("executor_after_will"), "the specific step replaces the general one");

  // Sarah added (linked to the Will), not invited; Tom still to review.
  facts = { ...facts, contacts: [{ id: "c1", name: "Sarah Smith", role: null, linkedUserId: null }],
    links: [{ recordId: "w1", personId: "c1", role: "Executor" }],
    suggestions: [facts.suggestions[1]] };
  steps = buildNextSteps(facts, undefined, now);
  assert.match(steps.find((item) => item.key === "invite_executors").title, /Invite Sarah Smith, your executor/);
  assert.match(steps.find((item) => item.key === "review_executors").title, /Tom Smith/);

  // Invited three weeks ago, no answer: a reminder instead.
  facts = { ...facts, invitations: [{ contactId: "c1", status: "pending", sentAt: "2026-10-14T12:00:00Z" }] };
  steps = buildNextSteps(facts, undefined, now);
  assert.ok(!keys(steps).includes("invite_executors"));
  assert.match(steps.find((item) => item.key === "remind_executors").title, /Sarah Smith hasn't accepted/);

  // Accepted: choose what she receives. Nominated: nothing left for Sarah.
  facts = { ...facts, contacts: [{ id: "c1", name: "Sarah Smith", role: null, linkedUserId: "u-sarah" }], invitations: [] };
  assert.ok(keys(buildNextSteps(facts, undefined, now)).includes("nominate_executors"));
  facts = { ...facts, nominations: [{ personId: "c1", status: "active" }] };
  const final = namedPeople(facts, "will", now).people.find((person) => person.contactId === "c1");
  assert.equal(final.stage, "nominated");
  assert.ok(!keys(buildNextSteps(facts, undefined, now)).some((key) => /executor/.test(key) && key !== "review_executors"));
});

test("a Will with no executors anywhere still gets the general prompt", () => {
  assert.ok(keys(buildNextSteps({ ...base(), rows: [will] }, undefined, now)).includes("executor_after_will"));
});

test("finance suggestions follow what's recorded, and 'I don't have one' is remembered", () => {
  const current = { id: "b1", kind: "asset", section_key: "finances", category_key: "bank", title: "HSBC", status: "active", metadata_json: { bank_account_type: "current_account" } };
  let steps = buildNextSteps({ ...base(), rows: [will, current] }, undefined, now);
  assert.ok(keys(steps).includes("has_pension"));
  assert.ok(keys(steps).includes("has_savings"));
  assert.equal(steps.find((item) => item.key === "has_pension").dismissLabel, "I don't have one");
  steps = buildNextSteps({ ...base(), rows: [will, current] }, { applicability: {}, guidance: { has_pension: { state: "not_relevant", snoozedUntil: null } } }, now);
  assert.ok(!keys(steps).includes("has_pension"));
  // Nothing in Finances yet: no finance-type suggestions (the general finances prompt covers it).
  assert.ok(!keys(buildNextSteps({ ...base(), rows: [will] }, undefined, now)).includes("has_pension"));
});

test("email wording never names anyone, and each line appears once", () => {
  const facts = { ...base(), rows: [will], suggestions: [{ recordId: "w1", name: "Sarah Smith", role: "Executor", status: "pending", matchPersonId: null }] };
  const lines = emailLines(buildNextSteps(facts, undefined, now));
  assert.ok(lines.length > 0);
  for (const line of lines) assert.doesNotMatch(line, /Sarah|Smith/);
  assert.equal(new Set(lines).size, lines.length);
});

test("one rule everywhere: To do, the bell and the email all build from buildNextSteps", () => {
  const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(read("app/(app)/dashboard/page.tsx"), /buildNextSteps\(vaultFacts, preferences\)/);
  assert.match(read("components/notifications/NotificationBell.tsx"), /buildNextSteps\(factsResponse\.facts, preferences\)/);
  assert.match(read("lib/summaryEmail/service.ts"), /emailLines\(buildNextSteps\(facts/);
  assert.match(read("app/api/next-steps/route.ts"), /loadVaultFacts\(access\.admin, access\.user\.id\)/);
});

test("server routes refuse a session that hasn't passed the new-device check", () => {
  const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(read("lib/identity-verification/api.ts"), /sessionIsTrusted\(admin, request, requestUser\.user\.id\)/);
  assert.match(read("app/api/auth/device/route.ts"), /allowUnverifiedDevice: true/);
  assert.match(read("app/api/documents/[documentId]/extract/route.ts"), /device_not_verified/);
});

test("'Already done' settles a progressive step", () => {
  const facts = { rows: [{ id: "w1", kind: "asset", section_key: "legal", category_key: "wills", title: "My Will", status: "active" }], willDocumentCount: 0,
    contacts: [{ id: "c1", name: "Sarah", role: null, linkedUserId: null }], invitations: [], links: [{ recordId: "w1", personId: "c1", role: "Executor" }], suggestions: [], nominations: [] };
  assert.ok(buildNextSteps(facts, undefined, now).some((item) => item.key === "invite_executors"));
  assert.ok(!buildNextSteps(facts, { applicability: {}, guidance: { invite_executors: { state: "needs_review", snoozedUntil: null } } }, now).some((item) => item.key === "invite_executors"));
});
