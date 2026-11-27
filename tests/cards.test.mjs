import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardEstateSign, cleanExpiry, cleanLast4, findCardBrand, isLegacyCreditCard, looksLikeFullCardNumber, resolveCardType } from "../lib/vault/cards.ts";
import { buildExecutorPack } from "../lib/vault/executorPack.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("cards: never a full card number; last four digits and expiry only", () => {
  assert.equal(looksLikeFullCardNumber("4111 1111 1111 1111"), true);
  assert.equal(looksLikeFullCardNumber("1234"), false);
  assert.equal(cleanLast4("1234"), "1234");
  assert.equal(cleanLast4("4111111111111111"), "", "a long number is not kept");
  assert.equal(cleanExpiry("03/2028"), "03/28");
  assert.equal(cleanExpiry("13/28"), "");
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /some\(looksLikeFullCardNumber\)/);
  assert.match(workspace, /card_last4: cleanLast4\(form\.card_last4\) \|\| null/);
  assert.doesNotMatch(workspace, /card_cvv|card_pin|card_number:/);
});

test("cards: credit balances are owed, gift and points add value, debit and discount add nothing", () => {
  assert.equal(cardEstateSign("credit_card"), -1);
  assert.equal(cardEstateSign("gift_card"), 1);
  assert.equal(cardEstateSign("loyalty"), 1);
  assert.equal(cardEstateSign("debit_card"), 0);
  assert.equal(cardEstateSign("discount"), 0);
  assert.match(read("lib/dashboard/summary.ts"), /category === "cards"\) return cardEstateSign\(cardTypeOf\(row\)\) \* Math\.abs\(value\)/);
});

test("cards: credit cards saved in Debts show in Cards and leave Debts; debit cards link to a bank account", () => {
  const legacy = { category_key: "debts", metadata: { debt_type: "credit_card" } };
  assert.equal(isLegacyCreditCard(legacy), true);
  assert.equal(resolveCardType(legacy), "credit_card");
  assert.equal(isLegacyCreditCard({ category_key: "debts", metadata: { debt_type: "mortgage" } }), false);
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /\.in\("category_key", readsLegacyCards \? \[categoryKey, "debts"\] : \[categoryKey\]\)/);
  assert.match(workspace, /filter\(\(option: \{ value: string \}\) => option\.value !== "credit_card"\)/);
  assert.match(workspace, /form\.card_type === "debit_card" && !form\.card_bank_id/);
  assert.match(workspace, /<AccountCardsList accountRef=\{linkRef\("asset", selectedRecord\.id\)\}/);
  assert.equal(findCardBrand("Blue Light Card")?.logo, "/logos/apps/blue-light-card.png");
  assert.equal(findCardBrand("Amex")?.key, "american-express");
});

test("executor pack: cards say what they are and what to do, never the membership number", () => {
  const pack = buildExecutorPack({
    ownerName: "Bill Smith",
    rows: [{ id: "c1", section_key: "finances", category_key: "cards", title: "Nectar", provider_name: "Nectar",
      metadata: { card_type: "loyalty", card_provider: "Nectar", card_member_number: "98263000123", card_after_death: "claim_points" } }],
    documentCounts: new Map(), people: [], includeValues: false,
  });
  const text = JSON.stringify(pack);
  assert.match(text, /Loyalty or rewards · Claim or transfer the points/);
  assert.doesNotMatch(text, /98263000123/);
});
