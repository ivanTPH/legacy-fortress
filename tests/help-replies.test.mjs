import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanReplyText, renderHelpReplyEmail, sendHelpReply } from "../lib/admin/helpReplies.ts";
import { planNextSteps } from "../lib/readiness/nextSteps.ts";

function fakeClient(original) {
  const writes = [];
  const chain = (table) => {
    const state = { table, op: "select", filters: {} };
    const api = {
      select() { return api; },
      eq(k, v) { state.filters[k] = v; return api; },
      in() { return api; },
      insert(row) { state.op = "insert"; writes.push({ op: "insert", row }); return api; },
      update(row) { state.op = "update"; writes.push({ op: "update", row }); return api; },
      async maybeSingle() { return { data: original && state.filters.id === original.id ? original : null, error: null }; },
      async single() { return { data: { id: "reply-1" }, error: null }; },
      then(resolve) { resolve({ data: null, error: null }); },
    };
    return api;
  };
  return { client: { from: chain }, writes };
}

test("help reply: saved as the customer's own support row and the message marked replied", async () => {
  const { client, writes } = fakeClient({ id: "m1", user_id: "u1", title: "Billing and my plan", details: { source: "help_page" } });
  const result = await sendHelpReply(client, { messageId: "m1", text: "  Hello there  ", adminUserId: "admin-1", sendEmail: false });
  assert.equal(result.ok, true);
  const insert = writes.find((w) => w.op === "insert").row;
  assert.equal(insert.user_id, "u1");
  assert.equal(insert.section_key, "support");
  assert.equal(insert.category_key, "help_replies");
  assert.equal(insert.summary, "Hello there");
  assert.equal(insert.details.reply_to, "m1");
  assert.equal(insert.details.read_at, null);
  const update = writes.find((w) => w.op === "update").row;
  assert.equal(update.details.reply_count, 1);
  assert.equal(update.details.source, "help_page");
});

test("help reply: empty text and unknown messages are refused", async () => {
  const { client } = fakeClient(null);
  assert.equal((await sendHelpReply(client, { messageId: "m1", text: "   ", adminUserId: "a", sendEmail: false })).ok, false);
  assert.equal((await sendHelpReply(client, { messageId: "m1", text: "Hi", adminUserId: "a", sendEmail: false })).status, 404);
  assert.equal(cleanReplyText("x".repeat(5000)).length, 4000);
});

test("help reply email never carries the message or the reply", () => {
  const email = renderHelpReplyEmail("https://test.mylegacyfortress.com/");
  assert.match(email.text, /\/help#messages/);
  assert.doesNotMatch(`${email.subject} ${email.text} ${email.html}`, /Re:|Billing|Hello/);
});

test("an unread reply is a to-do in the Inbox until it is read", () => {
  const base = { rows: [], willDocumentCount: 0, contacts: [], invitations: [], links: [], suggestions: [], nominations: [] };
  assert.ok(planNextSteps({ ...base, unreadHelpReplies: 1 }).all.some((s) => s.key === "help_reply" && s.href === "/help#messages"));
  assert.ok(!planNextSteps({ ...base, unreadHelpReplies: 0 }).all.some((s) => s.key === "help_reply"));
});

test("admin reply route needs support:manage and audits without the text", () => {
  const route = readFileSync(new URL("../app/api/internal/admin/help-reply/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminCapability\(admin\.access, "support:manage"\)/);
  assert.doesNotMatch(route, /metadata: \{[^}]*text/);
});

test("Admin Inbox read state follows the admin (own inbox_reads rows) and stays out of their Vault Inbox", () => {
  const admin = readFileSync(new URL("../components/admin/AdminInbox.tsx", import.meta.url), "utf8");
  const vault = readFileSync(new URL("../lib/notifications/inboxUpdates.ts", import.meta.url), "utf8");
  assert.match(admin, /from\("inbox_reads"\)\.select\("item_key"\)\.like\("item_key", `\$\{SERVER_PREFIX\}%`\)/);
  assert.match(admin, /SERVER_PREFIX = "admin-inbox:"/);
  assert.match(vault, /\.not\("item_key", "like", "admin-inbox:%"\)/);
});
