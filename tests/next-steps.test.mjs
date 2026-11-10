import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { buildNextSteps as visibleSteps, planNextSteps, emailLines, namedPeople } from "../lib/readiness/nextSteps.ts";
import { applyGuidanceAction, describeGuidanceChoice } from "../lib/readiness/guidance.ts";
// Most checks look at everything that applies; the calm "what to show now" limit has its own tests.
const buildNextSteps = (...args) => planNextSteps(...args).all;

const now = new Date("2026-11-04T12:00:00Z");
const will = { id: "w1", kind: "asset", section_key: "legal", category_key: "wills", title: "My Will", status: "active" };
const base = () => ({ rows: [], willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [] });
const keys = (steps) => steps.map((item) => item.key);
// A Vault established with everyday things (owner decision 10 Nov 2026): the Will and Power of Attorney prompts wait for this.
const everyday = [
  { id: "e1", kind: "asset", section_key: "finances", category_key: "bank", title: "Current account", status: "active", metadata_json: { bank_account_type: "current_account" } },
  { id: "e2", kind: "asset", section_key: "finances", category_key: "bank", title: "Savings", status: "active", metadata_json: { bank_account_type: "savings_account" } },
  { id: "e3", kind: "asset", section_key: "property", category_key: "residential", title: "Home", status: "active" },
];
const established = () => ({ ...base(), rows: [...everyday] });

test("the Will and Power of Attorney wait until the Vault is established with everyday things", () => {
  const empty = keys(buildNextSteps(base(), undefined, now));
  assert.ok(!empty.includes("will") && !empty.includes("capacity_arrangements"), "a new Vault isn't asked about a Will yet");
  const two = keys(buildNextSteps({ ...base(), rows: everyday.slice(0, 2) }, undefined, now));
  assert.ok(!two.includes("will"), "two records isn't established yet");
  const ready = keys(buildNextSteps(established(), undefined, now));
  assert.ok(ready.includes("will") && ready.includes("capacity_arrangements"), "three everyday records: now ask");
  assert.ok(!keys(buildNextSteps({ ...established(), rows: [...everyday, will] }, undefined, now)).includes("will"), "a Vault with a Will isn't asked");
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
  const lines = emailLines(visibleSteps(facts, undefined, now));
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

const day = 86400000;
const prefsAfter = (key, action, at) => applyGuidanceAction({ applicability: {}, guidance: {}, categories: {}, subsections: {} }, key, action, at);

test("critical: 'Not now' on a Will quiets it for a year, then asks gently again", () => {
  const facts = established();
  const decided = new Date("2025-11-01T12:00:00Z");
  const prefs = prefsAfter("will", "not_relevant", decided);
  assert.ok(!keys(buildNextSteps(facts, prefs, new Date(decided.getTime() + 200 * day))).includes("will"), "quiet within the year");
  const back = buildNextSteps(facts, prefs, new Date(decided.getTime() + 366 * day)).find((item) => item.key === "will");
  assert.ok(back, "comes back after a year");
  assert.match(back.title, /A year ago you said you didn't have a Will/);
  assert.equal(back.dismissLabel, "Not now, ask me in a year");
  assert.match(describeGuidanceChoice("will", "not_relevant"), /ask again in a year/);
});

test("critical: answering 'No' to a Will recommends making one", () => {
  const steps = buildNextSteps(established(), { applicability: { will: "no" }, guidance: {} }, now);
  assert.match(steps.find((item) => item.key === "will").title, /We'd recommend making a Will/);
});

test("ordinary: 'I don't have one' settles it for good; the yearly review covers changes", () => {
  const current = { id: "b1", kind: "asset", section_key: "finances", category_key: "bank", title: "HSBC", status: "active", metadata_json: { bank_account_type: "current_account" }, created_at: "2024-01-01T00:00:00Z" };
  const prefs = prefsAfter("has_pension", "not_relevant", now);
  const later = new Date(now.getTime() + 800 * day);
  const steps = buildNextSteps({ ...base(), rows: [will, current] }, prefs, later);
  assert.ok(!keys(steps).includes("has_pension"));
  assert.ok(keys(steps).includes("annual_review"), "a year after the first record, the yearly check-in appears");
  assert.match(describeGuidanceChoice("has_pension", "not_relevant"), /won't ask again/);
});

test("housekeeping: 'Nothing has changed' brings the yearly review back in a year", () => {
  const rows = [{ ...will, created_at: "2024-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }];
  const prefs = prefsAfter("annual_review", "already_done", now);
  assert.ok(!keys(buildNextSteps({ ...base(), rows }, prefs, new Date(now.getTime() + 100 * day))).includes("annual_review"));
  assert.ok(keys(buildNextSteps({ ...base(), rows }, prefs, new Date(now.getTime() + 370 * day))).includes("annual_review"));
});

test("an old Will gets a gentle 'still the current one?'", () => {
  const rows = [{ ...will, created_at: "2022-01-01T00:00:00Z", updated_at: "2022-01-01T00:00:00Z" }];
  assert.ok(keys(buildNextSteps({ ...base(), rows }, undefined, now)).includes("will_still_current"));
});

test("calm: up to 3 at a time while setting up, critical first; one at a time once settled", () => {
  const setUp = planNextSteps(established(), undefined, now);
  assert.equal(setUp.phase, "setting_up");
  assert.ok(setUp.steps.length <= 3);
  assert.equal(setUp.steps[0].key, "will");
  const settledRows = [
    will,
    { id: "p1", kind: "asset", section_key: "legal", category_key: "power-of-attorney", title: "LPA", status: "active" },
    { id: "b1", kind: "asset", section_key: "finances", category_key: "bank", title: "Savings", status: "active", metadata_json: { bank_account_type: "savings_account" } },
    { id: "b2", kind: "asset", section_key: "finances", category_key: "pensions", title: "Pension", status: "active" },
    { id: "b3", kind: "asset", section_key: "finances", category_key: "insurance", title: "Life cover", status: "active" },
  ];
  const facts = { ...base(), rows: settledRows, contacts: [{ id: "c1", name: "Sarah", role: "Executor", linkedUserId: "u1" }], nominations: [{ personId: "c1", status: "active" }] };
  const settled = planNextSteps(facts, undefined, now);
  assert.equal(settled.phase, "settled");
  assert.ok(settled.steps.length <= 1);
  assert.ok(settled.all.length >= settled.steps.length);
});
