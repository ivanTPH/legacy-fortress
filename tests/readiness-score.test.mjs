import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeReadiness, READINESS_ITEMS } from "../lib/readiness/score.ts";

const facts = (rows = [], extra = {}) => ({ rows, willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [], ...extra });
const row = (section_key, category_key, more = {}) => ({ id: `${section_key}-${category_key}-${Math.random()}`, kind: "asset", section_key, category_key, status: "active", archived_at: null, deleted_at: null, metadata_json: {}, ...more });

test("weights agreed with the owner, 18 Nov 2026, add up to 100", () => {
  assert.deepEqual(READINESS_ITEMS.map((item) => [item.key, item.weight]), [["will", 20], ["named", 15], ["bank", 15], ["home", 15], ["pension", 10], ["insurance", 10], ["savings", 10], ["other", 5]]);
  assert.equal(READINESS_ITEMS.reduce((sum, item) => sum + item.weight, 0), 100);
});

test("an empty Vault is 0% and suggests the Will, then someone named, then the bank", () => {
  const result = computeReadiness(facts());
  assert.equal(result.percent, 0);
  assert.deepEqual(result.nextSteps.map((item) => item.key), ["will", "named", "bank"]);
});

test("one bank account counts as fully as five", () => {
  const one = computeReadiness(facts([row("finances", "bank")])).percent;
  const five = computeReadiness(facts([1, 2, 3, 4, 5].map(() => row("finances", "bank")))).percent;
  assert.equal(one, 15);
  assert.equal(five, one);
});

test("a Will counts half until its signing date is added", () => {
  assert.equal(computeReadiness(facts([row("legal", "wills", { title: "Last Will and Testament" })])).percent, 10);
  assert.equal(computeReadiness(facts([row("legal", "wills", { title: "Last Will and Testament", metadata_json: { will_signed_on: "2020-01-01" } })])).percent, 20);
});

test("doesn't apply comes off the total; something recorded always counts", () => {
  const prefs = { applicability: { readiness_home: "not_relevant", has_pension: "not_relevant" } };
  const result = computeReadiness(facts([row("finances", "bank")]), prefs);
  assert.equal(result.percent, Math.round(15 / 75 * 100));
  assert.ok(!result.nextSteps.some((item) => item.key === "home" || item.key === "pension"));
  const withHome = computeReadiness(facts([row("finances", "bank"), row("property", "property")]), prefs);
  assert.equal(withHome.items.find((item) => item.key === "home").notApplicable, false);
});

test("the score is the owner's only: Home shows it only in the owner's own Vault", () => {
  const page = fs.readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  assert.match(page, /vaultFacts && viewer\.mode === "owner" \? computeReadiness/);
  assert.doesNotMatch(fs.readFileSync("lib/readiness/score.ts", "utf8"), /from\(|fetch\(/, "computed in the browser from the owner's own facts; nothing stored or sent");
});

test("each step names its document or person and opens the place to act (owner, 18 Nov 2026)", () => {
  const will = row("legal", "wills", { id: "will-1", title: "Last Will and Testament" });
  const result = computeReadiness(facts([will], {
    contacts: [{ id: "p-jane", name: "Jane Example", role: "Executor", linkedUserId: null }],
    links: [{ recordId: "will-1", personId: "p-jane", role: "executor" }],
  }));
  const willStep = result.items.find((item) => item.key === "will");
  assert.equal(willStep.actionTitle, "Add the date your Will was signed");
  assert.equal(willStep.subject, "Last Will and Testament");
  assert.equal(willStep.href, "/legal/wills?asset=will-1");
  const named = result.items.find((item) => item.key === "named");
  assert.equal(named.actionTitle, "Invite Jane Example to join");
  assert.equal(named.href, "/contacts?contact=p-jane");
  assert.equal(result.items.find((item) => item.key === "home").href, "/add?area=property");
});
