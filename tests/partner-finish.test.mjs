import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { invoiceLabel, weeklyJoins } from "../lib/enterprise/partnerOverview.ts";
import { renderHelpReplyEmail } from "../lib/admin/helpReplies.ts";

test("partner overview: sign-ups each week (12 weeks, removed members not counted)", () => {
  const now = new Date("2026-11-23T12:00:00Z"); // a Monday
  const weeks = weeklyJoins([
    { joinedAt: "2026-11-23T09:00:00Z", status: "active" },
    { joinedAt: "2026-11-17T09:00:00Z", status: "active" },
    { joinedAt: "2026-11-18T09:00:00Z", status: "removed" },
    { joinedAt: "2026-01-01T09:00:00Z", status: "active" },
    { joinedAt: null, status: "invited" },
  ], now);
  assert.equal(weeks.length, 12);
  assert.equal(weeks[11].count, 1);
  assert.equal(weeks[10].count, 1);
  assert.equal(weeks.reduce((sum, week) => sum + week.count, 0), 2);
});

test("partner overview: invoice status in plain words", () => {
  assert.equal(invoiceLabel([{ billingStatus: "current", status: "active" }]), "Paid");
  assert.equal(invoiceLabel([{ billingStatus: "overdue", status: "active" }]), "Overdue");
  assert.equal(invoiceLabel([{ billingStatus: "pending", status: "draft" }]), "Awaiting payment");
  assert.equal(invoiceLabel([{ billingStatus: "not_configured", status: "active" }]), "Not invoiced yet");
});

test("partner help: messages marked as from the Partner Portal; replies link back there, not to the Vault", () => {
  const help = readFileSync(new URL("../components/enterprise/PartnerHelp.tsx", import.meta.url), "utf8");
  assert.match(help, /source: "partner_portal"/);
  assert.match(renderHelpReplyEmail("https://test.mylegacyfortress.com", true).text, /\/enterprise\?tab=help#messages/);
  assert.match(renderHelpReplyEmail("https://test.mylegacyfortress.com").text, /\/help#messages/);
  const facts = readFileSync(new URL("../lib/readiness/vaultFacts.ts", import.meta.url), "utf8");
  assert.match(facts, /row\.details\?\.place !== "partner_portal"/);
  const nav = readFileSync(new URL("../components/admin/adminNavigation.ts", import.meta.url), "utf8");
  assert.match(nav, /key: "enterprise-help", label: "Help", href: "\/enterprise\?tab=help"/);
});

test("licence ended: members are emailed, with nothing named", async () => {
  const { renderPartnerEndedEmail } = await import("../lib/billing/partnerPlan.ts");
  const email = renderPartnerEndedEmail("https://test.mylegacyfortress.com/");
  assert.match(email.text, /\/account\/billing/);
  assert.match(email.text, /Nothing has been deleted/);
  const source = readFileSync(new URL("../lib/billing/partnerPlan.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!isDeliverableAddress\(email\)\) return false;/);
});
