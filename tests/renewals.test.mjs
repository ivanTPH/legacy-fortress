import test from "node:test";
import assert from "node:assert/strict";
import { planNextSteps, renewalsDue } from "../lib/readiness/nextSteps.ts";

const now = new Date("2026-11-20T12:00:00Z");
const row = (id, category_key, meta, kind = "asset") => ({ id, kind, section_key: category_key === "insurance" ? "finances" : "property", category_key, title: "x", status: "active", metadata_json: meta, created_at: "2026-10-01T00:00:00Z" });
const base = { willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [] };

test("renewals: insurance within 30 days and tenancies within 60, soonest first", () => {
  const rows = [
    row("far", "insurance", { policy_type: "home_insurance", renewal_date: "2027-02-01" }),
    row("home", "insurance", { policy_type: "home_insurance", renewal_date: "2026-12-03" }),
    row("car", "insurance", { policy_type: "vehicle_insurance", renewal_date: "2026-11-25" }, "record"),
    row("let", "property", { occupancy_status: "rental_property", tenancy_end_date: "2027-01-10" }),
    row("lapsed", "insurance", { renewal_date: "2026-09-01" }),
    row("mine", "property", { occupancy_status: "owner_occupied", tenancy_end_date: "2026-12-01" }),
  ];
  const due = renewalsDue(rows, now);
  assert.deepEqual(due.map((d) => d.id), ["car", "home", "let"]);
  assert.equal(due[0].label, "Your vehicle insurance");
  assert.equal(due[0].href, "/finances/insurance?record=car");
  assert.equal(due[2].href, "/property?asset=let");
});

test("renewals: one Inbox step with a general email title", () => {
  const rows = [row("home", "insurance", { policy_type: "home_insurance", renewal_date: "2026-12-03" })];
  const step = planNextSteps({ ...base, rows }, undefined, now).all.find((s) => s.key === "renewal_due");
  assert.ok(step);
  assert.match(step.title, /Your home insurance renews on 3 December/);
  assert.equal(step.emailTitle, "Something in your Vault is due for renewal");
  assert.ok(!planNextSteps({ ...base, rows }, { applicability: {}, guidance: { renewal_due: { state: "unknown", snoozedUntil: "2026-12-30T00:00:00Z" } } }, now).all.some((s) => s.key === "renewal_due"));
});
