import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recently deleted (UX review 2; owner approved 30 days, 18 Nov 2026).
 *
 * - Records (public.records) move to public.deleted_items through lf_bin_record and come back with
 *   lf_restore_deleted_record (both run with the owner's own permissions).
 * - Assets already soft-delete with deleted_at; restoring clears it.
 * - Stored files are kept until the item is removed for good by the daily job, 30 days after deletion.
 * Only the owner sees their own deleted items. Nothing here grants access to anyone.
 */
export const RECENTLY_DELETED_DAYS = 30;
/** Assets deleted before the bin existed keep their old behaviour: the daily job never removes them. */
export const RECENTLY_DELETED_SINCE = "2026-11-19T00:00:00.000Z";

export type DeletedItem = {
  kind: "record" | "asset";
  /** deleted_items.id for records; the asset id for assets. */
  id: string;
  title: string;
  sectionKey: string;
  categoryKey: string;
  deletedAt: string;
  daysLeft: number;
};

const DAY = 24 * 60 * 60 * 1000;

export function daysLeft(deletedAt: string, now = Date.now()) {
  const left = new Date(deletedAt).getTime() + RECENTLY_DELETED_DAYS * DAY - now;
  return Math.max(0, Math.ceil(left / DAY));
}

/** The owner's own deleted items, newest first (RLS limits both reads to the signed-in owner). */
export async function listRecentlyDeleted(client: SupabaseClient, ownerUserId: string, now = Date.now()): Promise<DeletedItem[]> {
  const since = new Date(Math.max(now - RECENTLY_DELETED_DAYS * DAY, new Date(RECENTLY_DELETED_SINCE).getTime())).toISOString();
  const [bin, assets] = await Promise.all([
    client.from("deleted_items").select("id,title,section_key,category_key,deleted_at,purge_after").eq("owner_user_id", ownerUserId).gt("purge_after", new Date(now).toISOString()).order("deleted_at", { ascending: false }),
    client.from("assets").select("id,title,provider_name,section_key,category_key,deleted_at").eq("owner_user_id", ownerUserId).not("deleted_at", "is", null).gte("deleted_at", since).order("deleted_at", { ascending: false }),
  ]);
  const items: DeletedItem[] = [
    ...((bin.data ?? []) as Array<{ id: string; title: string | null; section_key: string; category_key: string; deleted_at: string }>).map((row) => ({
      kind: "record" as const, id: row.id, title: row.title?.trim() || "Untitled record", sectionKey: row.section_key, categoryKey: row.category_key, deletedAt: row.deleted_at, daysLeft: daysLeft(row.deleted_at, now),
    })),
    ...((assets.data ?? []) as Array<{ id: string; title: string | null; provider_name: string | null; section_key: string | null; category_key: string | null; deleted_at: string }>).map((row) => ({
      kind: "asset" as const, id: row.id, title: row.title?.trim() || row.provider_name?.trim() || "Untitled record", sectionKey: row.section_key ?? "", categoryKey: row.category_key ?? "", deletedAt: row.deleted_at, daysLeft: daysLeft(row.deleted_at, now),
    })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Plain words for a refused restore. */
export function restoreErrorMessage(message: string) {
  if (/PLAN_LIMIT_DOCUMENT/.test(message)) return "Your Vault is at its document limit. Remove a document or upgrade, then restore this.";
  if (/EXPIRED/.test(message)) return "This was deleted more than 30 days ago and can’t be restored.";
  if (/row-level security|42501/.test(message)) return "This Vault can’t be changed at the moment.";
  return "This couldn’t be restored. Please try again.";
}

export async function restoreDeletedItem(client: SupabaseClient, ownerUserId: string, item: Pick<DeletedItem, "kind" | "id" | "deletedAt">) {
  if (item.kind === "record") {
    const result = await client.rpc("lf_restore_deleted_record", { p_bin_id: item.id });
    return result.error ? { ok: false as const, message: restoreErrorMessage(result.error.message) } : { ok: true as const };
  }
  if (daysLeft(item.deletedAt) <= 0) return { ok: false as const, message: restoreErrorMessage("EXPIRED") };
  const result = await client.from("assets").update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", item.id).eq("owner_user_id", ownerUserId).not("deleted_at", "is", null).select("id");
  if (result.error) return { ok: false as const, message: restoreErrorMessage(result.error.message) };
  return (result.data ?? []).length ? { ok: true as const } : { ok: false as const, message: restoreErrorMessage("") };
}

/** Move a record to Recently deleted. Falls back to the old outright delete only if the bin isn't installed yet. */
export async function binRecord(client: SupabaseClient, ownerUserId: string, recordId: string) {
  const result = await client.rpc("lf_bin_record", { p_record_id: recordId });
  if (!result.error) return { ok: true as const, binned: true };
  if (/lf_bin_record|PGRST202|function .* does not exist/i.test(`${result.error.code ?? ""} ${result.error.message}`)) {
    const fallback = await client.from("records").delete().eq("id", recordId).eq("owner_user_id", ownerUserId);
    return fallback.error ? { ok: false as const, message: fallback.error.message } : { ok: true as const, binned: false };
  }
  return { ok: false as const, message: result.error.message };
}

type StoredFile = { storage_bucket?: string | null; storage_path?: string | null };

async function removeFiles(admin: SupabaseClient, files: StoredFile[]) {
  const byBucket = new Map<string, string[]>();
  for (const file of files) {
    if (!file.storage_path) continue;
    const bucket = file.storage_bucket || "vault-docs";
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), file.storage_path]);
  }
  for (const [bucket, paths] of byBucket) {
    const removed = await admin.storage.from(bucket).remove(paths);
    if (removed.error) throw new Error("storage_remove_failed");
  }
}

/**
 * Daily job (service role): remove for good what has been in Recently deleted for 30 days, with its stored
 * files. Returns counts only. A failure leaves the item in place to be tried again the next day.
 */
export async function purgeRecentlyDeleted(admin: SupabaseClient, now = new Date(), limit = 200) {
  const result = { ok: true, records: 0, assets: 0, failed: 0 };
  const expired = await admin.from("deleted_items").select("id,owner_user_id,attachment_rows").lte("purge_after", now.toISOString()).limit(limit);
  if (expired.error) return { ...result, ok: false };
  for (const row of (expired.data ?? []) as Array<{ id: string; owner_user_id: string; attachment_rows: StoredFile[] | null }>) {
    try {
      await removeFiles(admin, row.attachment_rows ?? []);
      const deleted = await admin.from("deleted_items").delete().eq("id", row.id).eq("owner_user_id", row.owner_user_id);
      if (deleted.error) throw deleted.error;
      result.records += 1;
    } catch {
      result.failed += 1;
    }
  }
  const cutoff = new Date(now.getTime() - RECENTLY_DELETED_DAYS * DAY).toISOString();
  const oldAssets = await admin.from("assets").select("id,owner_user_id").not("deleted_at", "is", null).gte("deleted_at", RECENTLY_DELETED_SINCE).lte("deleted_at", cutoff).limit(limit);
  if (oldAssets.error) return { ...result, ok: false };
  for (const asset of (oldAssets.data ?? []) as Array<{ id: string; owner_user_id: string }>) {
    try {
      const documents = await admin.from("documents").select("storage_bucket,storage_path").eq("asset_id", asset.id).eq("owner_user_id", asset.owner_user_id);
      if (documents.error) throw documents.error;
      await removeFiles(admin, (documents.data ?? []) as StoredFile[]);
      const deleted = await admin.from("assets").delete().eq("id", asset.id).eq("owner_user_id", asset.owner_user_id).not("deleted_at", "is", null);
      if (deleted.error) throw deleted.error;
      result.assets += 1;
    } catch {
      result.failed += 1;
    }
  }
  result.ok = result.failed === 0;
  return result;
}
