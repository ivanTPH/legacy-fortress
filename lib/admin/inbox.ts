import type { SupabaseClient } from "@supabase/supabase-js";
import { isTestAccountEmail, listAuthUsersNewestFirst } from "./operations";
import { DIRECT_ORIGIN, loadAccountOrigins, type AccountOrigin } from "./accountOrigins";
import { loadHelpMessages } from "./helpMessages";

/**
 * Admin Inbox (owner decision 16 Nov 2026): what happened across customer accounts, newest first, built from what is
 * already recorded. Privacy (owner-approved): account details only. Links and documents are COUNTS per account per
 * day; never the invited person's name or email, never file names, record names, values or contents.
 */
export type AdminInboxKind = "accounts" | "plans" | "links" | "documents" | "messages" | "needs";
export type AdminInboxItem = {
  id: string;
  kind: AdminInboxKind;
  title: string;
  detail: string;
  at: string;
  href: string;
  accountEmail: string | null;
  /** Messages only: what the customer wrote to us from Help (they chose to send it to us). */
  message?: string;
  /** Messages only: replies already sent from the Admin Inbox. */
  replies?: number;
  /** New accounts only: how the account was created, and whether it is a test account. */
  origin?: AccountOrigin;
  isTest?: boolean;
};

type AnyClient = SupabaseClient;
const DAY = 24 * 60 * 60 * 1000;

export async function loadAdminInbox(client: AnyClient, options: { days?: number; includeTests?: boolean; now?: number } = {}) {
  const now = options.now ?? Date.now();
  const since = new Date(now - (options.days ?? 30) * DAY).toISOString();
  const users = await listAuthUsersNewestFirst(client);
  const emailById = new Map(users.map((user) => [user.id, String(user.email ?? "")]));
  const isTest = (userId: string) => !options.includeTests && isTestAccountEmail(emailById.get(userId) ?? "");
  const items: AdminInboxItem[] = [];
  const account = (userId: string) => ({ href: `/admin/users/${encodeURIComponent(userId)}`, accountEmail: emailById.get(userId) || null });

  // New accounts.
  const plans = await safe(client.from("billing_profiles").select("user_id,account_plan,plan_status,trial_ends_at,cancel_at_period_end,updated_at").gte("updated_at", since).limit(1000));
  const planByUser = new Map((plans as Array<Record<string, unknown>>).map((row) => [String(row.user_id), row]));
  const newAccounts = users.filter((user) => String(user.created_at ?? "") >= since && !isTest(user.id));
  const origins = await loadAccountOrigins(client, newAccounts.map((user) => user.id));
  for (const user of newAccounts) {
    const plan = planByUser.get(user.id);
    const origin = origins.get(user.id) ?? DIRECT_ORIGIN;
    items.push({
      id: `account:${user.id}`, kind: "accounts", title: "New account",
      detail: `${user.email ?? "No email"} · ${plan?.account_plan === "premium" ? "Premium" : "Free"} plan`,
      at: String(user.created_at ?? ""), origin, isTest: isTestAccountEmail(user.email), ...account(user.id),
    });
  }

  // Plan changes, from each billing profile's current state.
  for (const row of plans as Array<Record<string, unknown>>) {
    const userId = String(row.user_id);
    if (isTest(userId)) continue;
    const status = String(row.plan_status ?? "");
    const title = status === "past_due" || status === "unpaid" ? "Payment failed"
      : row.cancel_at_period_end ? "Premium cancelled"
      : row.account_plan === "premium" && status === "trialing" ? "Premium trial started"
      : row.account_plan === "premium" ? "Premium started" : null;
    if (!title) continue;
    items.push({ id: `plan:${userId}:${title}:${String(row.updated_at).slice(0, 10)}`, kind: "plans", title, detail: emailById.get(userId) || "Account", at: String(row.updated_at), ...account(userId) });
  }

  // People links: counts per account per day. The invited person is never named.
  const events = await safe(client.from("invitation_events").select("owner_user_id,event_type,created_at").gte("created_at", since).in("event_type", ["auth_request_accepted", "sent", "resent", "accepted"]).limit(5000));
  for (const [key, group] of groupByOwnerDay(events as Array<Record<string, unknown>>, (row) => row.event_type === "accepted" ? "accepted" : "sent")) {
    const [userId, , type] = key.split("|");
    if (isTest(userId)) continue;
    const n = group.length;
    items.push({
      id: `links:${key}`, kind: "links",
      title: type === "accepted" ? `${n} ${n === 1 ? "invitation" : "invitations"} accepted` : `Invited ${n} ${n === 1 ? "person" : "people"}`,
      detail: emailById.get(userId) || "Account", at: latest(group), ...account(userId),
    });
  }

  // Documents: counts per account per day. Never file names or contents.
  const [documents, attachments] = await Promise.all([
    safe(client.from("documents").select("owner_user_id,created_at").gte("created_at", since).is("deleted_at", null).limit(5000)),
    safe(client.from("attachments").select("owner_user_id,created_at").gte("created_at", since).limit(5000)),
  ]);
  for (const [key, group] of groupByOwnerDay([...documents, ...attachments] as Array<Record<string, unknown>>, () => "documents")) {
    const [userId] = key.split("|");
    if (isTest(userId)) continue;
    items.push({ id: `documents:${key}`, kind: "documents", title: `Added ${group.length} ${group.length === 1 ? "document" : "documents"}`, detail: emailById.get(userId) || "Account", at: latest(group), ...account(userId) });
  }

  // Messages sent from Help › Contact us (UX review Stage 4). The customer wrote these to us, so the text is shown;
  // nothing else from their Vault is read. Staff reply to the account email.
  for (const row of await loadHelpMessages(client, since)) {
    if (isTest(row.userId)) continue;
    items.push({ id: `message:${row.id}`, kind: "messages", title: `Message: ${row.topic}`, detail: emailById.get(row.userId) || "Account", message: row.text, replies: row.replies, at: row.at, ...account(row.userId) });
  }

  // Needs you: what's waiting in the review queues (counts; each opens its own page).
  const queues = await Promise.all([
    // ID checks waiting for a person (23 Nov 2026): these live in identity_verification_requests. The Inbox used to
    // count only the older verification_requests table, so a selfie waiting for review never showed here.
    Promise.all([
      count(client.from("identity_verification_requests").select("id", { count: "exact", head: true }).eq("status", "review_required")),
      count(client.from("verification_requests").select("id", { count: "exact", head: true }).in("request_status", ["pending", "submitted"])),
    ]).then(([current, older]) => current + older),
    count(client.from("legal_authorities").select("id", { count: "exact", head: true }).in("status", ["pending_check", "needs_attention"])),
    count(client.from("probate_cases").select("id", { count: "exact", head: true }).in("status", ["submitted", "needs_information", "under_review"])),
    count(client.from("support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "pending", "escalated"])),
  ]);
  const stamp = new Date(now).toISOString();
  const needs: Array<[number, string, string, string, string]> = [
    [queues[0], "verification", "person waiting for a verification review", "people waiting for a verification review", "/admin/verification"],
    [queues[1], "authorities", "Power of Attorney waiting for a check", "Powers of Attorney waiting for a check", "/admin/authorities"],
    [queues[2], "probate", "probate case waiting for review", "probate cases waiting for review", "/admin/probate"],
    [queues[3], "support", "open support request", "open support requests", "/admin/support"],
  ];
  for (const [n, key, one, many, href] of needs) {
    if (n > 0) items.push({ id: `needs:${key}:${n}`, kind: "needs", title: `${n} ${n === 1 ? one : many}`, detail: "Waiting for you", at: stamp, href, accountEmail: null });
  }

  items.sort((left, right) => right.at.localeCompare(left.at));
  return items.slice(0, 300);
}

function groupByOwnerDay(rows: Array<Record<string, unknown>>, type: (row: Record<string, unknown>) => string) {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const key = `${String(row.owner_user_id)}|${String(row.created_at ?? "").slice(0, 10)}|${type(row)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function latest(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => String(row.created_at ?? "")).sort().at(-1) ?? "";
}

async function safe(query: PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query;
    return result.error ? [] : (result.data as unknown[] | null) ?? [];
  } catch {
    return [];
  }
}

async function count(query: PromiseLike<{ count: number | null; error: unknown }>) {
  try {
    const result = await query;
    return result.error ? 0 : result.count ?? 0;
  } catch {
    return 0;
  }
}
