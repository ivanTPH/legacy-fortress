import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hideReadinessCard, readinessCardMode, showReadinessCard } from "../lib/readiness/cardVisibility.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const empty = { groups: {}, subsections: {}, applicability: {}, guidance: {} };

test("readiness card: shown by default, hidden on request, back when a new step appears, gone at 100%", () => {
  assert.equal(readinessCardMode(63, ["will", "executor"], empty), "shown");
  const hidden = hideReadinessCard(empty, ["will", "executor"], new Date("2026-11-27T12:00:00Z"));
  assert.equal(readinessCardMode(63, ["will", "executor"], hidden), "hidden");
  assert.equal(readinessCardMode(70, ["will"], hidden), "hidden", "finishing a step keeps it hidden");
  assert.equal(readinessCardMode(70, ["will", "lpa"], hidden), "shown", "a new step brings it back");
  assert.equal(readinessCardMode(100, [], hidden), "complete");
  assert.equal(readinessCardMode(100, [], empty), "complete");
  assert.equal(readinessCardMode(63, ["will"], showReadinessCard(hidden)), "shown");
  assert.deepEqual(Object.keys(showReadinessCard(hidden).guidance), []);
});

test("readiness card: slim line on Home, placeholder while loading, hidden line at the bottom", () => {
  const card = read("app/(app)/components/dashboard/ReadinessCard.tsx");
  assert.match(card, /className="lf-readiness-line" aria-expanded=\{drawerOpen\}/);
  assert.match(card, /Hide this/);
  assert.match(card, /export function ReadinessPlaceholder/);
  assert.match(card, /export function ReadinessHiddenLine/);
  const page = read("app/(app)/dashboard/page.tsx");
  assert.match(page, /loading \|\| \(!readiness && !vaultFactsSettled\) \? <ReadinessPlaceholder \/>/);
  assert.match(page, /readinessMode === "shown" \? <ReadinessCard/);
  assert.match(page, /readinessFooter=\{readiness && !loading && readinessMode === "hidden"/);
  const css = read("app/v3-screens.css");
  assert.match(css, /\.lf-readiness-card\.is-placeholder \{ display: flex; align-items: center; gap: 12px; min-height: 64px/);
  assert.match(css, /\.lf-readiness-line \{[^}]*min-height: 64px/);
});
