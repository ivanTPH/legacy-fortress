import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExecutorPack } from "../lib/vault/executorPack.ts";
import { findPayeeBrand, monthlyEquivalent, parseLinkRef, payeeAddHref, linkRef } from "../lib/vault/directDebits.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("direct debits: payee icons, where to add a missing payee, monthly cost", () => {
  assert.equal(findPayeeBrand("Netflix")?.logo, "/logos/apps/netflix.png");
  assert.equal(findPayeeBrand("Octopus Energy")?.key, "octopus-energy");
  assert.ok(findPayeeBrand("Aviva"), "insurers come from the money list");
  assert.match(payeeAddHref("Netflix"), /^\/personal\/subscriptions\?add=1&name=Netflix$/);
  assert.match(payeeAddHref("Aviva"), /^\/finances\/insurance\?add=1&name=Aviva$/);
  assert.equal(monthlyEquivalent(120, "annually"), 10);
  assert.equal(monthlyEquivalent(30, "quarterly"), 10);
  assert.equal(monthlyEquivalent("abc", "monthly"), 0);
  assert.deepEqual(parseLinkRef(linkRef("asset", "0722d1c7-aaaa-bbbb-cccc-111111111111")), { kind: "asset", id: "0722d1c7-aaaa-bbbb-cccc-111111111111" });
  assert.equal(parseLinkRef("javascript:alert(1)"), null);
});

test("direct debits: amounts are outgoings, never counted in value; paid-from lists only the owner's accounts", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /const payee = form\.payment_payee\.trim\(\);[\s\S]{0,600}valueMajor: "0"/);
  assert.match(workspace, /row\.category_key === "bank"\)\.map/);
  assert.match(workspace, /isLegacyCreditCard\(row as/);
  assert.match(workspace, /<AccountPaymentsList accountRef=\{linkRef\("asset", selectedRecord\.id\)\}/);
  assert.match(workspace, /payeeAddHref\(payee\)/);
  const finances = read("app/(app)/finances/page.tsx");
  assert.match(finances, /section\.key === "insurance" \|\| section\.key === "direct-debits" \? 0/);
  assert.match(read("lib/vaultPreferences.ts"), /"\/finances\/direct-debits"\)\) return "finances_direct_debits"/);
  assert.match(read("lib/vault/addRecordTypes.ts"), /\/finances\/direct-debits\?add=1/);
});

test("executor pack lists payments with what should happen, never the reference", () => {
  const pack = buildExecutorPack({
    ownerName: "Bill Smith",
    rows: [{ id: "p1", section_key: "finances", category_key: "direct-debits", title: "Netflix", provider_name: "Netflix",
      metadata: { payment_payee: "Netflix", payment_amount: "12", payment_frequency: "monthly", payment_after_death: "cancel", payment_reference: "REF-123" } }],
    documentCounts: new Map(),
    people: [],
    includeValues: true,
  });
  const section = pack.sections.find((item) => item.key === "payments");
  assert.ok(section);
  assert.equal(section.items[0].type, "Cancel it");
  assert.equal(section.items[0].value, "£12 monthly");
  assert.doesNotMatch(JSON.stringify(pack), /REF-123/);
});

test("a payment's page shows what it costs, not a 'value', and names people linked to this payment", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /isDirectDebits \? \(\n\s+\/\/ A payment is an outgoing/);
  assert.match(read("lib/linkedPeople/recordLinkedPeople.ts"), /"People linked to this payment"/);
  assert.match(read("app/v3-screens.css"), /\.lf-v52-payment-hint a \{/);
});

test("the direct debits page header shows the monthly cost, not £0.00", () => {
  assert.match(read("components/records/UniversalRecordWorkspace.tsx"), /isDirectDebits \? directDebitMonthlyHeader\(records\)/);
});
