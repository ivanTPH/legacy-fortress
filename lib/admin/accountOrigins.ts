import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How each customer account was created (owner decision 16 Nov 2026), for Admin tags and, later, different
 * follow-up messages. Recorded by the database (account_origins); no row means the person signed up directly.
 * Admin-only: read with the service role. Test is decided by the account's e-mail (isTestAccountEmail).
 */
export type AccountSource = "direct" | "partner" | "invited";
export type AccountOrigin = {
  source: AccountSource;
  organisationId: string | null;
  organisationName: string | null;
};

export const DIRECT_ORIGIN: AccountOrigin = { source: "direct", organisationId: null, organisationName: null };

export function accountSourceLabel(origin: AccountOrigin | null | undefined) {
  if (!origin || origin.source === "direct") return "Direct";
  if (origin.source === "invited") return "Invited by a customer";
  return origin.organisationName ? `Via ${origin.organisationName}` : "Via a partner";
}

export function organisationDisplayName(row: { legal_name?: string | null; trading_name?: string | null } | null | undefined) {
  return String(row?.trading_name ?? "").trim() || String(row?.legal_name ?? "").trim() || "Organisation";
}

/** Origins for the given accounts. Never throws: if the record can't be read, everyone shows as Direct. */
export async function loadAccountOrigins(client: SupabaseClient, userIds: string[]): Promise<Map<string, AccountOrigin>> {
  const result = new Map<string, AccountOrigin>();
  if (!userIds.length) return result;
  try {
    const rows: Array<{ user_id: string; source: string; organisation_id: string | null }> = [];
    for (let index = 0; index < userIds.length; index += 200) {
      const { data, error } = await client.from("account_origins").select("user_id,source,organisation_id").in("user_id", userIds.slice(index, index + 200));
      if (error) return result;
      rows.push(...((data ?? []) as typeof rows));
    }
    const organisationIds = [...new Set(rows.map((row) => row.organisation_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (organisationIds.length) {
      const { data } = await client.from("enterprise_organisations").select("id,legal_name,trading_name").in("id", organisationIds);
      for (const row of (data ?? []) as Array<{ id: string; legal_name?: string | null; trading_name?: string | null }>) names.set(row.id, organisationDisplayName(row));
    }
    for (const row of rows) {
      const source: AccountSource = row.source === "partner" || row.source === "invited" ? row.source : "direct";
      result.set(row.user_id, { source, organisationId: row.organisation_id, organisationName: row.organisation_id ? names.get(row.organisation_id) ?? null : null });
    }
  } catch {
    return result;
  }
  return result;
}
