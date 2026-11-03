import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notifications the person has cleared (owner request 2 Nov 2026: swipe or tap to clear;
 * 3 Nov 2026: clearing follows you across devices). The server list is the source of truth;
 * this device keeps a copy so the list doesn't flicker, and still works if the server is unavailable.
 * Clearing only hides a notification for this person; it never changes the notification itself.
 */
const KEY = "lf:notifications:cleared";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadClearedNotificationIds(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveClearedNotificationIds(ids: string[]) {
  const unique = Array.from(new Set(ids)).slice(-500);
  try { window.localStorage.setItem(KEY, JSON.stringify(unique)); } catch { /* optional on this device */ }
  return unique;
}

/** This device's list merged with what was cleared on other devices. */
export async function syncClearedNotificationIds(client: SupabaseClient): Promise<string[]> {
  const local = loadClearedNotificationIds();
  try {
    const { data, error } = await client.from("notification_clears").select("item_id").order("cleared_at", { ascending: false }).limit(500);
    if (error) return local;
    const remote = ((data ?? []) as Array<{ item_id: string }>).map((row) => String(row.item_id));
    const missingRemotely = local.filter((id) => UUID.test(id) && !remote.includes(id));
    if (missingRemotely.length) void persistClears(client, missingRemotely);
    return saveClearedNotificationIds([...local, ...remote]);
  } catch {
    return local;
  }
}

async function persistClears(client: SupabaseClient, ids: string[]) {
  try {
    const { data } = await client.auth.getUser();
    const userId = data.user?.id;
    const rows = ids.filter((id) => UUID.test(id)).map((item_id) => ({ user_id: userId, item_id }));
    if (!userId || !rows.length) return;
    await client.from("notification_clears").upsert(rows, { onConflict: "user_id,item_id", ignoreDuplicates: true });
  } catch { /* this device still remembers */ }
}

export function clearNotificationIds(client: SupabaseClient, current: string[], ids: string[]) {
  void persistClears(client, ids);
  return saveClearedNotificationIds([...current, ...ids]);
}

export function restoreNotificationIds(client: SupabaseClient, current: string[], ids: string[]) {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length) void Promise.resolve(client.from("notification_clears").delete().in("item_id", valid)).catch(() => undefined);
  return saveClearedNotificationIds(current.filter((id) => !ids.includes(id)));
}
