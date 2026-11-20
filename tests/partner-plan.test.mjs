import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { grantPartnerPremium, endPartnerPremium, endPartnerPremiumForLicence, acknowledgePartnerEnded } from "../lib/billing/partnerPlan.ts";
import { buildNextSteps } from "../lib/readiness/nextSteps.ts";

function fakeDb({ profiles = [], seats = [] } = {}) {
  const tables = { billing_profiles: profiles, enterprise_seats: seats };
  const from = (table) => {
    const state = { filters: [], op: "select", values: null };
    const q = {
      select() { return q; }, eq(c, v) { state.filters.push((r) => r[c] === v); return q; }, neq(c, v) { state.filters.push((r) => r[c] !== v); return q; },
      not(c, _o, v) { state.filters.push((r) => r[c] !== v && r[c] != null); return q; }, limit() { return q; },
      update(values) { state.op = "update"; state.values = values; return q; },
      insert(values) { tables[table].push({ ...values }); return Promise.resolve({ error: null }); },
      maybeSingle() { const rows = tables[table].filter((r) => state.filters.every((f) => f(r))); return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(resolve) {
        const rows = tables[table].filter((r) => state.filters.every((f) => f(r)));
        if (state.op === "update") rows.forEach((r) => Object.assign(r, state.values));
        resolve({ data: rows, error: null });
      },
    };
    return q;
  };
  return { from, tables };
}

test("joining on a partner seat gives Premium; someone paying Stripe keeps their own plan (18 Nov 2026)", async () => {
  const db = fakeDb({ profiles: [{ user_id: "payer", account_plan: "premium", plan_source: "stripe" }] });
  await grantPartnerPremium(db, "new-member");
  assert.equal(db.tables.billing_profiles.find((r) => r.user_id === "new-member").account_plan, "premium");
  assert.equal(db.tables.billing_profiles.find((r) => r.user_id === "new-member").plan_source, "partner");
  assert.deepEqual(await grantPartnerPremium(db, "payer"), { changed: false, reason: "already_paying" });
  assert.equal(db.tables.billing_profiles.find((r) => r.user_id === "payer").plan_source, "stripe");
});

test("a licence ending moves its members to Free and flags them to choose; others are untouched", async () => {
  const db = fakeDb({
    profiles: [
      { user_id: "a", account_plan: "premium", plan_source: "partner" },
      { user_id: "b", account_plan: "premium", plan_source: "partner" },
      { user_id: "c", account_plan: "premium", plan_source: "stripe" },
    ],
    seats: [
      { id: "s1", licence_id: "L1", user_id: "a", seat_status: "active" },
      { id: "s2", licence_id: "L1", user_id: "b", seat_status: "active" },
      { id: "s3", licence_id: "L2", user_id: "b", seat_status: "active" },
      { id: "s4", licence_id: "L1", user_id: "c", seat_status: "active" },
    ],
  });
  assert.deepEqual(await endPartnerPremiumForLicence(db, "L1"), { ended: 1 });
  const a = db.tables.billing_profiles.find((r) => r.user_id === "a");
  assert.equal(a.account_plan, "starter");
  assert.equal(a.plan_source, "partner_ended");
  assert.equal(db.tables.billing_profiles.find((r) => r.user_id === "b").account_plan, "premium", "still covered by another partner seat");
  assert.equal(db.tables.billing_profiles.find((r) => r.user_id === "c").plan_source, "stripe", "pays for themselves");
  await acknowledgePartnerEnded(db, "a");
  assert.equal(a.plan_source, "manual");
  assert.deepEqual(await endPartnerPremium(db, "nobody"), { changed: false });
});

test("the member is told in the Inbox, first, until they choose", () => {
  const facts = { rows: [], willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [], planSource: "partner_ended" };
  const steps = buildNextSteps(facts);
  assert.equal(steps[0].key, "partner_licence_ended");
  assert.equal(steps[0].href, "/account/billing?from=partner");
  assert.ok(!buildNextSteps({ ...facts, planSource: "manual" }).some((s) => s.key === "partner_licence_ended"));
  const ops = fs.readFileSync("lib/admin/enterpriseOperations.ts", "utf8");
  assert.match(ops, /await grantPartnerPremium\(client, userId\)/);
  assert.match(ops, /\(normalized === "cancelled" \|\| normalized === "expired"\) && current\.licence_status !== normalized/);
  const accept = fs.readFileSync("app/api/enterprise/invitations/accept/route.ts", "utf8");
  assert.match(accept, /Your Legacy Fortress account is ready on the Free plan/);
});
