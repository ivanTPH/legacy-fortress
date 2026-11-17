import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Messages a customer sent us from Help › Contact us (UX review Stage 4). These are written TO Legacy Fortress, so
 * Admin may show the topic and text. This reads only section_entries rows with section_key "support" and
 * category_key "help_requests" — never Vault records, documents, people or values.
 */
export type HelpMessage = { id: string; userId: string; topic: string; text: string; at: string };

export async function loadHelpMessages(client: SupabaseClient, since: string): Promise<HelpMessage[]> {
  try {
    const { data, error } = await client.from("section_entries").select("id,user_id,title,summary,created_at")
      .eq("section_key", "support").eq("category_key", "help_requests").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(500);
    if (error) return [];
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), userId: String(row.user_id), topic: String(row.title ?? "Help"),
      text: String(row.summary ?? "").slice(0, 1000), at: String(row.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}
