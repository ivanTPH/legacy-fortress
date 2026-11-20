import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous Vault mix for the Partner Portal (owner decision 18 Nov 2026): what share of an organisation's
 * members have each kind of thing in their Vault. Percentages only, never names, values, titles or contents,
 * only members who consented to organisation reporting, and nothing at all for groups smaller than the
 * minimum (5). Counted server-side with the service role; the partner only ever receives the percentages.
 */
export const VAULT_MIX_ITEMS = [
  { key: "will", label: "A Will" },
  { key: "pension", label: "A pension" },
  { key: "property", label: "Property" },
  { key: "insurance", label: "Insurance" },
  { key: "investments", label: "Savings or investments" },
  { key: "bank", label: "A bank account" },
  { key: "documents", label: "Key documents" },
  { key: "named", label: "Someone named to act" },
] as const;

export type VaultMixKey = (typeof VAULT_MIX_ITEMS)[number]["key"];
export type VaultMix =
  | { status: "ready"; counted: number; items: Array<{ key: VaultMixKey; label: string; percent: number }> }
  | { status: "too_few"; minimum: number }
  | { status: "no_consent" };

type Row = { owner_user_id: string; section_key: string | null; category_key: string | null };

export function classifyVaultRow(row: Pick<Row, "section_key" | "category_key">): VaultMixKey | null {
  const section = String(row.section_key ?? "").toLowerCase();
  const category = String(row.category_key ?? "").toLowerCase();
  if (section === "legal" && /will/.test(category)) return "will";
  if (/pension/.test(category)) return "pension";
  if (section === "property" || /property|home|mortgage/.test(category)) return "property";
  if (/insurance|life-cover|policy/.test(category)) return "insurance";
  if (/invest|isa|shares|savings|stock|bond|crypto/.test(category)) return "investments";
  if (/bank|current-account|savings-account/.test(category)) return "bank";
  if (section === "personal" && /identity|passport|document/.test(category)) return "documents";
  return null;
}

/** Turns per-member flags into rounded percentages; returns too_few under the minimum group size. */
export function summariseVaultMix(perMember: Map<string, Set<VaultMixKey>>, minimum: number): VaultMix {
  const counted = perMember.size;
  if (counted < minimum) return { status: "too_few", minimum };
  return {
    status: "ready",
    counted,
    items: VAULT_MIX_ITEMS.map((item) => {
      const have = [...perMember.values()].filter((flags) => flags.has(item.key)).length;
      return { key: item.key, label: item.label, percent: Math.round((have / counted) * 100) };
    }),
  };
}

export async function loadVaultMix(client: SupabaseClient, input: { memberUserIds: string[]; reportingConsent: boolean; minimum: number }): Promise<VaultMix> {
  if (!input.reportingConsent) return { status: "no_consent" };
  const ids = [...new Set(input.memberUserIds.filter(Boolean))];
  if (ids.length < input.minimum) return { status: "too_few", minimum: input.minimum };
  const perMember = new Map<string, Set<VaultMixKey>>(ids.map((id) => [id, new Set<VaultMixKey>()]));
  for (let start = 0; start < ids.length; start += 300) {
    const chunk = ids.slice(start, start + 300);
    const [assets, records, links, nominations] = await Promise.all([
      client.from("assets").select("owner_user_id,section_key,category_key").in("owner_user_id", chunk).is("deleted_at", null),
      client.from("records").select("owner_user_id,section_key,category_key").in("owner_user_id", chunk),
      client.from("record_links").select("owner_user_id,role").in("owner_user_id", chunk).is("removed_at", null),
      client.from("vault_nominations").select("owner_user_id,status").in("owner_user_id", chunk).eq("status", "active"),
    ]);
    if (assets.error || records.error) throw new Error("vault_mix_unavailable");
    for (const row of [...(assets.data ?? []), ...(records.data ?? [])] as Row[]) {
      const key = classifyVaultRow(row);
      if (key) perMember.get(row.owner_user_id)?.add(key);
    }
    for (const row of (links.data ?? []) as Array<{ owner_user_id: string; role: string | null }>) {
      if (/executor|attorney/i.test(row.role ?? "")) perMember.get(row.owner_user_id)?.add("named");
    }
    for (const row of (nominations.data ?? []) as Array<{ owner_user_id: string }>) perMember.get(row.owner_user_id)?.add("named");
  }
  return summariseVaultMix(perMember, input.minimum);
}
