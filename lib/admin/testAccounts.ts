import type { SupabaseClient } from "@supabase/supabase-js";
import { isTestAccountEmail, listAuthUsersNewestFirst } from "./operations";

/**
 * One rule for automated test accounts across all of Admin (owner, 16 Nov 2026): hidden from every list and count
 * unless the admin turns on "Show test accounts", which applies everywhere (sent as the x-lf-include-tests header).
 * Test accounts use reserved test addresses only, so a real customer is never hidden.
 */
export const INCLUDE_TESTS_HEADER = "x-lf-include-tests";

export function includeTestsFrom(request: Request) {
  return request.headers.get(INCLUDE_TESTS_HEADER) === "1" || new URL(request.url).searchParams.get("tests") === "1";
}

type Accounts = { all: Array<{ id: string; email?: string | null; created_at?: string | null }>; testIds: Set<string> };
let cache: { at: number; value: Accounts } | null = null;

/** Every account (all pages, not just the first 1,000) and which are test accounts. Cached for a minute. */
export async function loadAccounts(client: SupabaseClient): Promise<Accounts> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const all = await listAuthUsersNewestFirst(client);
  const value = { all, testIds: new Set(all.filter((user) => isTestAccountEmail(user.email)).map((user) => user.id)) };
  cache = { at: Date.now(), value };
  return value;
}

/** Leaves out rows that belong to test accounts, unless asked to include them. */
export function withoutTests<T>(rows: T[], testIds: Set<string>, includeTests: boolean, owner: (row: T) => string | null | undefined) {
  return includeTests ? rows : rows.filter((row) => !testIds.has(String(owner(row) ?? "")));
}
