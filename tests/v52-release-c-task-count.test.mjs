import assert from "node:assert/strict";
import test from "node:test";

import { countOpenNeedsYou, getVaultTaskGroup } from "../lib/workflow/taskGroups.ts";

test("mobile To do badge counts only open Needs you tasks", () => {
  const rows = [
    ...Array.from({ length: 3 }, () => ({ status: "Required", taskType: "system_generated" })),
    ...Array.from({ length: 9 }, () => ({ status: "Suggested", taskType: "system_generated" })),
    { status: "Complete", taskType: "user_created" },
  ];
  assert.equal(countOpenNeedsYou(rows), 3);
  assert.equal(rows.filter((row) => getVaultTaskGroup(row) === "waiting").length, 0);
  assert.equal(rows.filter((row) => getVaultTaskGroup(row) === "suggested").length, 9);
  assert.equal(countOpenNeedsYou([...rows, { status: "Pending", taskType: "user_created" }]), 3);
  assert.equal(countOpenNeedsYou([...rows, { status: "Required", taskType: "user_created" }]), 4);
});
