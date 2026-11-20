import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExecutorPack, firstSteps } from "../lib/vault/executorPack.ts";

const rows = [
  { id: "b1", section_key: "finances", category_key: "bank", title: "Current account", provider_name: "Barclays", value_minor: 250000, currency_code: "GBP", metadata: { account_number: "12345678", sort_code: "10-20-30", account_type: "current" } },
  { id: "w1", section_key: "legal", category_key: "wills", title: "My Will", metadata: {} },
  { id: "p1", section_key: "property", category_key: "property", title: "Home", metadata: { property_address: "1 Secret Lane", property_type: "house" } },
  { id: "x1", section_key: "support", category_key: "help_requests", title: "Help", metadata: {} },
  { id: "gone", section_key: "finances", category_key: "bank", title: "Old", deleted_at: "2026-11-01", metadata: {} },
];
const people = [{ name: "Jane Example", role: "executor", relationship: "Daughter" }, { name: "Bob", role: "attorney" }, { name: "Sam", role: "friend_or_family" }];

test("executor pack: what and where, never numbers, addresses or (by default) values", () => {
  const pack = buildExecutorPack({ ownerName: "Bill Smith", rows, documentCounts: new Map([["w1", 1]]), people, now: new Date("2026-11-20") });
  const text = JSON.stringify(pack);
  assert.doesNotMatch(text, /12345678|10-20-30|Secret Lane|£2,500/);
  assert.deepEqual(pack.sections.map((s) => s.heading), ["Legal", "Money", "Property"]);
  assert.equal(pack.sections[1].items[0].provider, "Barclays");
  assert.equal(pack.executors.length, 1); assert.equal(pack.attorneys.length, 1);
  assert.match(pack.willNote, /copy of the Will is stored/);
  assert.equal(pack.totals.records, 3);
  const withValues = buildExecutorPack({ ownerName: "Bill", rows, documentCounts: new Map(), people, includeValues: true });
  assert.equal(withValues.sections[1].items[0].value, "£2,500");
});

test("executor pack: first steps point to reporting a death; page prints only the pack", () => {
  assert.match(firstSteps("https://test.mylegacyfortress.com/").at(-1), /test\.mylegacyfortress\.com\/estate\/report-death/);
  const css = readFileSync(new URL("../app/v3-screens.css", import.meta.url), "utf8");
  assert.match(css, /body\.lf-print-pack \.lf-pack, body\.lf-print-pack \.lf-pack \* \{ visibility: visible !important; \}/);
});
