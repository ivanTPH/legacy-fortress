import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Test ID checks (owner, 25 Nov 2026). Every release runs an ID-check acceptance with throwaway @example.test
 * accounts, and each run used to leave one check "waiting for review". Admin hides test accounts by default, so
 * the staff email counted hundreds of checks while the queue it linked to looked empty.
 *
 * Same rule as Admin's "Show test accounts": reserved test addresses only (RFC 2606), so a real customer's check
 * is never counted as a test or closed.
 */
export function isTestEmail(email: string | null | undefined) {
  const domain = String(email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return /^example\.(test|com|net|org)$/.test(domain) || /\.(test|invalid|localhost)$/.test(domain);
}

export async function listTestUserIds(client: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let page = 1; page <= 50; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new Error(result.error.message);
    const batch = result.data?.users ?? [];
    for (const user of batch) if (isTestEmail(user.email)) ids.add(user.id);
    if (batch.length < 200) break;
  }
  return ids;
}

/** Waiting ID checks split into real customers and test accounts (counts only). */
export async function countWaitingIdChecks(client: SupabaseClient) {
  const { data, error } = await client.from("identity_verification_requests").select("user_id").eq("status", "review_required").limit(5000);
  if (error) return { real: 0, test: 0 };
  const rows = (data ?? []) as Array<{ user_id: string | null }>;
  if (!rows.length) return { real: 0, test: 0 };
  const testIds = await listTestUserIds(client);
  const test = rows.filter((row) => testIds.has(String(row.user_id ?? ""))).length;
  return { real: rows.length - test, test };
}

/** TEST only: the Supabase project behind the TEST site. Production never runs the clear-out. */
export function isTestProject(url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  return /^https:\/\/supabase-test\.mylegacyfortress\.com\/?$/i.test(url.trim());
}

/**
 * Daily on TEST: close test-account ID checks left waiting by release checks, keeping the newest `keep` so there
 * is always something to try the review screen on. Closed means status "cancelled" (the row stays; nothing is
 * deleted). Real customers' checks are never touched.
 */
export async function closeOldTestIdChecks(client: SupabaseClient, options: { keep?: number; force?: boolean } = {}) {
  const keep = options.keep ?? 2;
  if (!options.force && !isTestProject()) return { ok: true, skipped: "not_test_project" as const, closed: 0, kept: 0 };
  try {
    const { data, error } = await client.from("identity_verification_requests").select("id,user_id,created_at")
      .eq("status", "review_required").order("created_at", { ascending: false }).limit(5000);
    if (error) return { ok: false, closed: 0, kept: 0 };
    const testIds = await listTestUserIds(client);
    const tests = ((data ?? []) as Array<{ id: string; user_id: string | null }>).filter((row) => testIds.has(String(row.user_id ?? "")));
    const toClose = tests.slice(keep).map((row) => row.id);
    let closed = 0;
    for (let i = 0; i < toClose.length; i += 200) {
      const ids = toClose.slice(i, i + 200);
      const result = await client.from("identity_verification_requests")
        .update({ status: "cancelled", manual_review_required: false, last_reason_code: "test_check_closed", updated_at: new Date().toISOString() })
        .in("id", ids).eq("status", "review_required");
      if (result.error) return { ok: false, closed, kept: Math.min(keep, tests.length) };
      closed += ids.length;
    }
    return { ok: true, closed, kept: Math.min(keep, tests.length) };
  } catch {
    return { ok: false, closed: 0, kept: 0 };
  }
}
