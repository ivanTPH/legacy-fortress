import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

test("Next steps live only in To do, not on Home (owner, 10 Nov 2026: on Home they repeated the To do button)", () => {
  const home = fs.readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(home, /nextSteps=/);
  const overview = fs.readFileSync("app/(app)/components/dashboard/V3DashboardOverview.tsx", "utf8");
  assert.doesNotMatch(overview, /Your next steps|lf-v3-next-steps/);
  assert.doesNotMatch(fs.readFileSync("app/v3-screens.css", "utf8"), /\.lf-v3-next-steps\b/);
  // The To do count on Home's figures strip and the To do button stay.
  assert.match(home, /actionCount=\{viewer\.mode === "linked" \? undefined : getActionCentreToDoCount/);
});
