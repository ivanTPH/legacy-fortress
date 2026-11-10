import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

test("Home shows Your next steps from the same rule as To do, owners only (UX review, 10 Nov 2026)", () => {
  const home = fs.readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  assert.match(home, /nextSteps=\{viewer\.mode === "linked" \? undefined : guidanceItems\.map/);
  const overview = fs.readFileSync("app/(app)/components/dashboard/V3DashboardOverview.tsx", "utf8");
  assert.match(overview, /Your next steps/);
  assert.match(overview, /href="\/action-centre">See all/);
});
