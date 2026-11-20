import test from "node:test";
import assert from "node:assert/strict";
import { buildFunnel, weekStart } from "../lib/admin/activationFunnel.ts";

test("activation funnel: weekly sign-ups and the share reaching each step (counts only)", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const users = [
    { id: "a", created_at: "2026-11-18T10:00:00Z" }, { id: "b", created_at: "2026-11-17T10:00:00Z" },
    { id: "c", created_at: "2026-11-05T10:00:00Z" }, { id: "d", created_at: "2026-11-04T10:00:00Z" },
    { id: "old", created_at: "2026-01-01T10:00:00Z" },
  ];
  const funnel = buildFunnel({ users, setUp: new Set(["a", "b", "c", "old"]), withRecord: new Set(["a", "b"]), invited: new Set(["a"]), premium: new Set(["a"]), now });
  assert.equal(funnel.weeks.length, 12);
  assert.equal(funnel.weeks.at(-1).weekStart, weekStart(now.toISOString()));
  assert.equal(funnel.weeks.at(-1).signUps, 2);
  assert.deepEqual(funnel.steps.map((s) => [s.key, s.count, s.percent]), [["signed_up", 4, 100], ["set_up", 3, 75], ["first_record", 2, 50], ["invited", 1, 25], ["premium", 1, 25]]);
  for (const step of funnel.steps) assert.deepEqual(Object.keys(step).sort(), ["count", "key", "label", "percent"]);
});

test("the funnel loads after the Overview shows, never holding the page up", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../components/admin/AdminControlPlaneWorkspace.tsx", import.meta.url), "utf8");
  const summary = readFileSync(new URL("../lib/admin/dashboardSummary.ts", import.meta.url), "utf8");
  assert.match(page, /authFetch\("\/api\/internal\/admin\/dashboard-summary\?part=funnel"\)/);
  assert.match(page, /if \(item\.key === "summary"\) setMetrics\(item\.json\.summary\?\.metrics \?\? \[\]\);/);
  assert.match(summary, /const funnel = null;/);
});
