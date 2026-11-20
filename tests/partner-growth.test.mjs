import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyVaultRow, summariseVaultMix, loadVaultMix } from "../lib/enterprise/vaultMix.ts";

test("Vault mix: percentages only, and nothing under the minimum group (owner decision 18 Nov 2026)", async () => {
  const members = new Map([["a", new Set(["will", "pension"])], ["b", new Set(["will"])], ["c", new Set()], ["d", new Set(["will"])]]);
  assert.deepEqual(summariseVaultMix(members, 5), { status: "too_few", minimum: 5 });
  members.set("e", new Set(["pension"]));
  const mix = summariseVaultMix(members, 5);
  assert.equal(mix.status, "ready");
  assert.equal(mix.items.find((item) => item.key === "will").percent, 60);
  assert.equal(mix.items.find((item) => item.key === "pension").percent, 40);
  for (const item of mix.items) assert.deepEqual(Object.keys(item).sort(), ["key", "label", "percent"], "no names, values or ids");
  assert.deepEqual(await loadVaultMix({}, { memberUserIds: ["a", "b", "c", "d", "e"], reportingConsent: false, minimum: 5 }), { status: "no_consent" });
  assert.deepEqual(await loadVaultMix({}, { memberUserIds: ["a", "b"], reportingConsent: true, minimum: 5 }), { status: "too_few", minimum: 5 });
});

test("rows are classified by kind only", () => {
  assert.equal(classifyVaultRow({ section_key: "legal", category_key: "wills" }), "will");
  assert.equal(classifyVaultRow({ section_key: "finances", category_key: "pensions" }), "pension");
  assert.equal(classifyVaultRow({ section_key: "property", category_key: "property" }), "property");
  assert.equal(classifyVaultRow({ section_key: "finances", category_key: "bank" }), "bank");
  assert.equal(classifyVaultRow({ section_key: "digital", category_key: "social" }), null);
  const source = fs.readFileSync("lib/enterprise/vaultMix.ts", "utf8");
  assert.doesNotMatch(source, /select\("[^"]*(title|value|provider|metadata|notes)/, "only owner, section and category are read");
});

test("partner overview: registrations against the licence with 80% and 95% warnings; QR code and email; get started", () => {
  const ui = fs.readFileSync("components/enterprise/EnterpriseOperationsWorkspace.tsx", "utf8");
  assert.match(ui, /share >= 95 \? "is-critical" : share >= 80 \? "is-warning"/);
  assert.match(ui, /<PartnerGetStarted portfolio=\{portfolio\}/);
  assert.match(ui, /<ShareSignupLink /);
  const share = fs.readFileSync("components/enterprise/ShareSignupLink.tsx", "utf8");
  assert.match(share, /never sees what you keep in it/);
});
