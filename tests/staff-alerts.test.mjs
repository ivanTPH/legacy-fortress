import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alertStaff, renderStaffAlert, STAFF_ALERT_KINDS } from "../lib/admin/staffAlerts.ts";

function fakeClient({ waiting = 1, recent = 0, admins = [] } = {}) {
  const writes = [];
  const chain = (table) => {
    const q = { table, head: false };
    const api = {
      select(_c, opts) { q.head = Boolean(opts?.head); return api; },
      eq() { return api; }, in() { return api; }, gte() { return api; }, limit() { return api; },
      insert(row) { writes.push({ table, row }); return Promise.resolve({ error: null }); },
      then(resolve) {
        if (table === "audit_events") return resolve({ count: recent, error: null });
        if (table === "admin_users") return resolve({ data: admins, error: null });
        return resolve({ count: waiting, data: [], error: null });
      },
    };
    return api;
  };
  return { client: { from: chain }, writes };
}

test("staff alert emails name no customer, only what is waiting and a link", () => {
  const email = renderStaffAlert("id_check", 1, "https://test.mylegacyfortress.com/");
  assert.match(email.text, /1 ID check is waiting for review\./);
  assert.match(email.text, /https:\/\/test\.mylegacyfortress\.com\/admin\/verification/);
  assert.match(email.subject, /^Admin: 1 ID check waiting$/);
  assert.match(renderStaffAlert("help_message", 3, "https://x.test").text, /3 Help messages are waiting/);
});

test("staff alerts: nothing waiting, sent within the hour, or nobody able to deal with it means no email", async () => {
  assert.equal((await alertStaff(fakeClient({ waiting: 0 }).client, "id_check")).skipped, "nothing_waiting");
  assert.equal((await alertStaff(fakeClient({ recent: 1 }).client, "id_check")).skipped, "recently_sent");
  const onlyTestAddress = [{ user_id: "a", email_normalized: "admin@example.test", status: "active", role: "super_admin", is_master: true }];
  assert.equal((await alertStaff(fakeClient({ admins: onlyTestAddress }).client, "id_check")).skipped, "no_recipients");
});

test("every kind maps to the capability that can deal with it; triggers are wired", () => {
  assert.equal(STAFF_ALERT_KINDS.id_check.capability, "verification:review");
  assert.equal(STAFF_ALERT_KINDS.death_report.capability, "estate_case_review");
  assert.equal(STAFF_ALERT_KINDS.help_message.capability, "support:manage");
  const idv = readFileSync(new URL("../lib/identity-verification/service.ts", import.meta.url), "utf8");
  assert.match(idv, /if \(decision\.decision === "review_required"\) await alertStaff\(client, "id_check"/);
  const death = readFileSync(new URL("../app/api/estate/death-reports/route.ts", import.meta.url), "utf8");
  assert.match(death, /await alertStaff\(access\.admin, "death_report"/);
  const route = readFileSync(new URL("../app/api/staff-alerts/route.ts", import.meta.url), "utf8");
  assert.match(route, /\.eq\("user_id", access\.user\.id\)/, "only someone who just sent a message can trigger it");
  const daily = readFileSync(new URL("../app/api/internal/daily/run/route.ts", import.meta.url), "utf8");
  assert.match(daily, /alertStaffForAllWaiting\(admin\)/);
  const shell = readFileSync(new URL("../components/admin/AdminWorkspaceShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /item\.key === "inbox" && waiting > 0/);
});

test("test-account ID checks: email says so and links with test accounts shown; release checks close their own", async () => {
  const email = renderStaffAlert("id_check", 2, "https://test.mylegacyfortress.com", { testOnly: true });
  assert.match(email.subject, /^Admin: 2 test ID checks waiting$/);
  assert.match(email.text, /\/admin\/verification\?tests=1/);
  const { isTestEmail, isTestProject } = await import("../lib/admin/testIdChecks.ts");
  assert.equal(isTestEmail("phase3b-idv-1-owner@example.test"), true);
  assert.equal(isTestEmail("someone@gmail.com"), false);
  assert.equal(isTestProject("https://supabase-test.mylegacyfortress.com"), true);
  assert.equal(isTestProject("https://abc.supabase.co"), false, "never runs on production");
  const daily = readFileSync(new URL("../app/api/internal/daily/run/route.ts", import.meta.url), "utf8");
  assert.match(daily, /closeOldTestIdChecks\(admin\)/);
  const acceptance = readFileSync(new URL("../scripts/staging/run-invitation-idv-acceptance.mjs", import.meta.url), "utf8");
  assert.match(acceptance, /status: "cancelled"[^\n]+\.eq\("status", "review_required"\)/);
  const workspace = readFileSync(new URL("../components/admin/AdminControlPlaneWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /get\("tests"\) === "1"\) writeIncludeTests\(true\)/);
  const alerts = readFileSync(new URL("../lib/admin/staffAlerts.ts", import.meta.url), "utf8");
  assert.match(alerts, /testOnly && options\.source !== "daily-run"/);
});
