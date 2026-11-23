import { supabase } from "../supabaseClient";
import { waitForActiveUser } from "../auth/session";

export type HelpThread = { id: string; topic: string; text: string; at: string; replies: Array<{ id: string; text: string; at: string; isNew: boolean }> };

/**
 * The signed-in person's own messages to us and our replies (stage 3, 20 Nov 2026). Opening them marks replies as
 * read. "partner_portal" shows only messages sent from the Partner Portal's Help (23 Nov 2026); "help_page" shows
 * the rest, so each place shows its own conversations.
 */
export async function loadHelpThreads(place: "help_page" | "partner_portal"): Promise<HelpThread[]> {
  const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
  if (!user) return [];
  const { data, error } = await supabase.from("section_entries").select("id,category_key,title,summary,details,created_at")
    .eq("user_id", user.id).eq("section_key", "support").in("category_key", ["help_requests", "help_replies"])
    .order("created_at", { ascending: true }).limit(200);
  if (error) return [];
  type Row = { id: string; category_key: string; title: string | null; summary: string | null; details: Record<string, unknown> | null; created_at: string };
  const rows = (data ?? []) as Row[];
  const threads = new Map<string, HelpThread>();
  for (const row of rows.filter((item) => item.category_key === "help_requests")) {
    const fromPartner = row.details?.source === "partner_portal";
    if ((place === "partner_portal") !== fromPartner) continue;
    threads.set(row.id, { id: row.id, topic: String(row.title ?? "Message"), text: String(row.summary ?? ""), at: row.created_at, replies: [] });
  }
  const unread: Row[] = [];
  for (const row of rows.filter((item) => item.category_key === "help_replies")) {
    const thread = threads.get(String(row.details?.reply_to ?? ""));
    if (!thread) continue;
    const isNew = !row.details?.read_at;
    if (isNew) unread.push(row);
    thread.replies.push({ id: row.id, text: String(row.summary ?? ""), at: row.created_at, isNew });
  }
  const readAt = new Date().toISOString();
  await Promise.all(unread.map((row) => supabase.from("section_entries").update({ details: { ...(row.details ?? {}), read_at: readAt } }).eq("id", row.id)));
  return [...threads.values()].reverse().slice(0, 10);
}
