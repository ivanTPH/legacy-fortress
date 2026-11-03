import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isDue, mayEmail, periodStart, renderSummaryEmail, signSchedulerRequest, verifySchedulerRequest } from "../lib/summaryEmail/service.ts";

test("summary email has counts, the normal sign-in and change/turn-off links only", () => {
  const message = renderSummaryEmail({ todo: 3, updates: 5, since: new Date("2026-10-01T00:00:00Z"), frequency: "monthly", appUrl: "https://test.example", token: "00000000-0000-4000-8000-000000000001" });
  assert.match(message.text, /3 things to do and 5 updates since 1 Oct/);
  assert.match(message.text, /https:\/\/test\.example\/sign-in/);
  assert.match(message.text, /communications-preferences/);
  assert.match(message.text, /email\/summary-off\?token=/);
  assert.match(message.html, /Change frequency/);
  assert.match(message.html, /Turn off/);
  assert.doesNotMatch(message.text + message.html, /access_token|magic|otp|refresh_token/i);
  assert.equal(renderSummaryEmail({ todo: 1, updates: 0, since: new Date(), frequency: "weekly", appUrl: "x", token: "t" }).subject, "Your weekly Legacy Fortress summary");
  assert.match(renderSummaryEmail({ todo: 1, updates: 1, since: new Date("2026-10-27T00:00:00Z"), frequency: "weekly", appUrl: "x", token: "t" }).text, /1 thing to do and 1 update since/);
});

test("due rules: once a calendar month, or every 7 days; never when off", () => {
  const now = new Date("2026-11-03T09:23:00Z");
  assert.equal(isDue({ frequency: "off", last_sent_at: null }, now), false);
  assert.equal(isDue({ frequency: "monthly", last_sent_at: null }, now), true);
  assert.equal(isDue({ frequency: "monthly", last_sent_at: "2026-11-01T09:23:00Z" }, now), false);
  assert.equal(isDue({ frequency: "monthly", last_sent_at: "2026-10-30T09:23:00Z" }, now), true);
  assert.equal(isDue({ frequency: "weekly", last_sent_at: "2026-10-31T09:23:00Z" }, now), false);
  assert.equal(isDue({ frequency: "weekly", last_sent_at: "2026-10-27T09:23:00Z" }, now), true);
  assert.equal(periodStart("monthly", now).toISOString(), "2026-10-01T00:00:00.000Z");
});

test("outside production only people who chose a frequency are emailed", () => {
  assert.equal(mayEmail({ chosen_at: null }, false), false);
  assert.equal(mayEmail({ chosen_at: "2026-11-03T00:00:00Z" }, false), true);
  assert.equal(mayEmail({ chosen_at: null }, true), true);
});

test("scheduler requests are signed, fresh and never carry the key", () => {
  const key = "synthetic-key";
  const now = Date.UTC(2026, 10, 3, 9, 23);
  const ts = String(Math.floor(now / 1000));
  const signed = new Request("https://x/api/internal/summary-email/run", { method: "POST", headers: { "x-lf-timestamp": ts, "x-lf-signature": signSchedulerRequest(ts, key) } });
  assert.equal(verifySchedulerRequest(signed, key, now), true);
  assert.equal(verifySchedulerRequest(signed, "other-key", now), false);
  assert.equal(verifySchedulerRequest(signed, key, now + 10 * 60 * 1000), false);
  assert.equal(verifySchedulerRequest(new Request("https://x", { method: "POST" }), key, now), false);
  const workflow = fs.readFileSync(new URL("../.github/workflows/summary-email.yml", import.meta.url), "utf8");
  assert.match(workflow, /openssl dgst -sha256 -hmac/);
  assert.doesNotMatch(workflow, /-H "[^"]*SIGNING_KEY/);
});
