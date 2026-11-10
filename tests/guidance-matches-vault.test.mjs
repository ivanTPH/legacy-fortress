import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assetMatchesLegalCategory } from "../lib/legalCategories.ts";
import { buildGuidanceItems } from "../lib/readiness/guidance.ts";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("To do and prompts count Wills with the Legal page's own rule, across new and older records", () => {
  const page = read("app/(app)/dashboard/page.tsx");
  assert.match(page, /\[\.\.\.assetRows, \.\.\.recordSearchRows\]/);
  assert.match(page, /assetMatchesLegalCategory\(row, "wills"\)/);
  assert.match(page, /assetMatchesLegalCategory\(row, "power-of-attorney"\)/);
  assert.match(page, /assetRows: \[\.\.\.input\.assetRows, \.\.\.\(input\.legacyLegalRecords \?\? \[\]\)\]/);
});

test("the sample account's Wills and Power of Attorney are recognised wherever they're saved", () => {
  // As saved by the sample data (personal/executors) and as an older Legal record.
  assert.equal(assetMatchesLegalCategory({ section_key: "personal", category_key: "executors", title: "Last Will and Testament" }, "wills"), true);
  assert.equal(assetMatchesLegalCategory({ section_key: "legal", category_key: "wills", title: "My Will" }, "wills"), true);
  assert.equal(assetMatchesLegalCategory({ section_key: "legal", category_key: "power-of-attorney", title: "LPA" }, "power-of-attorney"), true);
});

test("with a Will recorded, nobody is asked 'Do you have a Will?'", () => {
  const evidence = { willCount: 2, powerOfAttorneyCount: 1, trustedPeopleCount: 3, executorCount: 1, digitalRecordCount: 0, possessionCount: 0, wishesCount: 0, financeRecordCount: 2 };
  assert.equal(buildGuidanceItems(evidence).some((item) => item.key === "will"), false);
  assert.equal(buildGuidanceItems({ ...evidence, willCount: 0 }).some((item) => item.key === "will"), true, "and is asked when there isn't one");
});

test("a person's record that only mentions the Will is not counted as a Will (UX review, 10 Nov 2026)", () => {
  assert.equal(assetMatchesLegalCategory({ section_key: "personal", category_key: "executors", title: "Emma Carter (executor)", metadata_json: { instruction_reference: "Will oversight" } }, "wills"), false);
  assert.equal(assetMatchesLegalCategory({ section_key: "personal", category_key: "executors", title: "Emma Carter (executor)", metadata_json: { executor_type: "executor" } }, "wills"), false);
});
