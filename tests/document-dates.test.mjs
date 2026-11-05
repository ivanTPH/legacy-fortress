import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { findDates, findWillDate, findExpiryDate, formatDocumentDate } from "../lib/documents/extraction/documentDates.ts";
import { identityDocumentStatuses, expiredOnSaveMessage } from "../lib/records/identityDocuments.ts";
import { planNextSteps } from "../lib/readiness/nextSteps.ts";
import { applyGuidanceAction, PROMPT_POLICY } from "../lib/readiness/guidance.ts";

// Synthetic text only.
const now = new Date("2026-11-05T12:00:00Z");
const base = () => ({ rows: [], willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [] });
const keys = (plan) => plan.all.map((item) => item.key);
const will = (metadata = {}, extra = {}) => ({ id: "w1", kind: "record", section_key: "legal", category_key: "wills", title: "My Will", status: "active", metadata_json: metadata, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...extra });
const idDoc = (id, type, renewal, extra = {}) => ({ id, kind: "asset", section_key: "legal", category_key: "identity-documents", title: type, status: "active", metadata_json: { identity_document_type: type, renewal_date: renewal, ...extra }, created_at: "2026-01-01T00:00:00Z" });

test("dates are read in UK order and in the ways Wills write them", () => {
  assert.deepEqual(findDates("on 12/03/2014").map((d) => d.date), ["2014-03-12"]);
  assert.deepEqual(findDates("12th March 2014").map((d) => d.date), ["2014-03-12"]);
  assert.deepEqual(findDates("this 12th day of March 2014").map((d) => d.date), ["2014-03-12"]);
  assert.deepEqual(findDates("the twelfth day of March 2014").map((d) => d.date), ["2014-03-12"]);
  assert.deepEqual(findDates("12 MAR /MARS 31").map((d) => d.date), ["2031-03-12"]);
  assert.deepEqual(findDates("31/02/2014").map((d) => d.date), [], "an impossible date is ignored");
  assert.equal(formatDocumentDate("2014-03-12"), "12 March 2014");
});

test("a Will's signing date is the date after a signing cue, not a date of birth", () => {
  const pages = [
    { page: 1, text: "LAST WILL of Jane Example, date of birth 01/02/1950. I revoke all earlier Wills dated 04/05/2001." },
    { page: 3, text: "SIGNED by the testator on 12th March 2014 in our presence. Witness: A. Witness" },
  ];
  assert.deepEqual(findWillDate(pages), { kind: "will_signed_on", date: "2014-03-12", page: 3 });
  assert.equal(findWillDate([{ page: 1, text: "Born 01/02/1950. No date here." }]), null);
});

test("an ID document's expiry is the date after 'Date of expiry' or the licence's 4b", () => {
  assert.equal(findExpiryDate([{ page: 1, text: "Date of issue 12 MAR /MARS 21 Date of expiry 12 MAR /MARS 31" }]).date, "2031-03-12");
  assert.equal(findExpiryDate([{ page: 1, text: "3. 01.02.1950 4a. 10.06.2019 4b. 09.06.2029 5. EXAMP" }]).date, "2029-06-09");
  assert.equal(findExpiryDate([{ page: 1, text: "Date of birth 01.02.1950" }]), null);
});

test("the Will check comes every 3 years from the signing date, with the age and life events", () => {
  const recent = planNextSteps({ ...base(), rows: [will({ will_signed_on: "2025-01-10" })] }, undefined, now);
  assert.ok(!keys(recent).includes("will_still_current"), "under 3 years old: no check");
  const old = planNextSteps({ ...base(), rows: [will({ will_signed_on: "2014-03-12" })] }, undefined, now);
  const item = old.all.find((step) => step.key === "will_still_current");
  assert.match(item.title, /dated March 2014, 12 years ago\. Has anything changed\?/);
  assert.match(item.description, /marriage, divorce, new child/i);
  assert.match(item.description, /England and Wales, getting married usually cancels an earlier Will/);
  assert.doesNotMatch(item.emailTitle, /2014|12 years/, "email wording stays general");
  // The signing date counts, not when it was uploaded last month.
  assert.ok(old.all.some((step) => step.key === "will_still_current"));
});

test("'It's still current' quiets the Will check for 3 years", () => {
  assert.equal(PROMPT_POLICY.will_still_current.doneDays, 1095);
  assert.equal(PROMPT_POLICY.will_still_current.dismissDays, 1095);
  const prefs = applyGuidanceAction({ applicability: {}, guidance: {} }, "will_still_current", "not_relevant", now);
  const facts = { ...base(), rows: [will({ will_signed_on: "2014-03-12" })] };
  assert.ok(!keys(planNextSteps(facts, prefs, now)).includes("will_still_current"));
  assert.ok(!keys(planNextSteps(facts, prefs, new Date("2029-10-01T00:00:00Z"))).includes("will_still_current"));
  assert.ok(keys(planNextSteps(facts, prefs, new Date("2029-12-01T00:00:00Z"))).includes("will_still_current"));
});

test("a marriage certificate dated after the Will asks whether the Will still stands", () => {
  const facts = { ...base(), rows: [will({ will_signed_on: "2014-03-12" }), idDoc("m1", "marriage_certificate", null, { identity_issue_date: "2020-06-01" })] };
  const item = planNextSteps(facts, undefined, now).all.find((step) => step.key === "will_after_marriage");
  assert.ok(item);
  assert.match(item.description, /unless the Will says it was made with that marriage in mind/);
  const before = { ...base(), rows: [will({ will_signed_on: "2021-03-12" }), idDoc("m1", "marriage_certificate", null, { identity_issue_date: "2020-06-01" })] };
  assert.ok(!keys(planNextSteps(before, undefined, now)).includes("will_after_marriage"));
});

test("ID documents: told about 3 months before; the old one is kept and marked replaced", () => {
  const soon = idDoc("p1", "passport", "2027-01-20");
  let plan = planNextSteps({ ...base(), rows: [soon] }, undefined, now);
  const item = plan.all.find((step) => step.key === "id_document_expiry");
  assert.match(item.title, /Your passport expires on 20 January 2027/);
  assert.equal(item.emailTitle, "One of your identity documents needs renewing");
  assert.ok(!keys(planNextSteps({ ...base(), rows: [idDoc("p1", "passport", "2028-01-20")] }, undefined, now)).includes("id_document_expiry"), "not yet due");

  // The new passport arrives: no prompt, and the old one is "Replaced" (or "Expired, replaced" once past).
  const renewed = idDoc("p2", "passport", "2036-12-01");
  plan = planNextSteps({ ...base(), rows: [soon, renewed] }, undefined, now);
  assert.ok(!keys(plan).includes("id_document_expiry"));
  assert.equal(identityDocumentStatuses([soon, renewed], now).get("p1"), "replaced");
  const expired = idDoc("p0", "passport", "2025-02-01");
  const statuses = identityDocumentStatuses([expired, renewed], now);
  assert.equal(statuses.get("p0"), "expired_replaced");
  assert.equal(statuses.get("p2"), "valid");
  // A driving licence doesn't replace a passport; certificates never expire.
  assert.equal(identityDocumentStatuses([expired, idDoc("d1", "driving_licence", "2036-01-01")], now).get("p0"), "expired");
  assert.equal(identityDocumentStatuses([idDoc("b1", "birth_certificate", "2020-01-01")], now).get("b1"), "no_date");
});

test("an expiry date in the past is pointed out on save, never refused", () => {
  assert.match(expiredOnSaveMessage("2025-01-01", now), /already passed/);
  assert.equal(expiredOnSaveMessage("2030-01-01", now), null);
  assert.equal(expiredOnSaveMessage(null, now), null);
});

test("the extraction route returns the date for the owner to confirm and stores nothing itself", () => {
  const route = fs.readFileSync("app/api/documents/[documentId]/extract/route.ts", "utf8");
  assert.match(route, /findWillDate\(read\.pages\)/);
  assert.match(route, /findExpiryDate\(read\.pages\)/);
  assert.match(route, /dateFinding,/);
  const findings = fs.readFileSync("components/documents/DocumentFindings.tsx", "utf8");
  assert.match(findings, /Yes, save this date/);
  assert.match(findings, /No, that’s not right/);
  const workspace = fs.readFileSync("components/records/UniversalRecordWorkspace.tsx", "utf8");
  assert.match(workspace, /will_signed_on: isWillsWorkspace && editingId/, "editing a Will keeps its signing date");
});
