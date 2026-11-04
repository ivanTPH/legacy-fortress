import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLegalCategoryForAsset } from "../legalCategories.ts";

/**
 * "Maya Adviser suggested a document for your Power of Attorney" (owner request 4 Nov 2026).
 * Stored notifications never hold record details (AGENTS rule): the record is looked up when the
 * owner's own app shows the notification, from their own Vault, so it never reaches email or storage.
 */
const SUGGESTION_KINDS = new Set(["suggestion_pending", "suggestion_comment"]);
const LEGAL_NAMES: Record<string, string> = {
  wills: "your Will",
  "power-of-attorney": "your Power of Attorney",
  trusts: "your trust",
  "identity-documents": "your identity documents",
};

export function suggestionIdFromLink(link: string | null | undefined) {
  const match = String(link ?? "").match(/[?&]review=([0-9a-f-]{36})/i);
  return match ? match[1] : null;
}

/** Map of suggestion id → "your Power of Attorney" / "“HSBC Everyday Current”". Empty when unavailable. */
export async function loadSuggestionRecordLabels(client: SupabaseClient, items: Array<{ kind: string; link: string | null | undefined }>) {
  const ids = [...new Set(items.filter((item) => SUGGESTION_KINDS.has(item.kind)).map((item) => suggestionIdFromLink(item.link)).filter((id): id is string => Boolean(id)))];
  const labels: Record<string, string> = {};
  if (!ids.length) return labels;
  const suggestions = await client.from("record_suggestions").select("id,asset_id").in("id", ids);
  if (suggestions.error || !suggestions.data?.length) return labels;
  const assetIds = [...new Set(suggestions.data.map((row) => row.asset_id as string).filter(Boolean))];
  const assets = await client.from("assets").select("id,title,section_key,category_key,metadata_json").in("id", assetIds);
  if (assets.error) return labels;
  const byId = new Map((assets.data ?? []).map((row) => [row.id as string, row]));
  for (const row of suggestions.data) {
    const asset = byId.get(row.asset_id as string);
    if (!asset) continue;
    const legal = resolveLegalCategoryForAsset(asset);
    labels[row.id as string] = (legal && LEGAL_NAMES[legal]) || (asset.title ? `“${String(asset.title).slice(0, 60)}”` : "one of your records");
  }
  return labels;
}

/** The notification title with the record added, for suggestion notifications only. */
export function titleWithRecord(kind: string, title: string, link: string | null | undefined, labels: Record<string, string>) {
  const id = suggestionIdFromLink(link);
  const label = id ? labels[id] : undefined;
  if (!label) return title;
  if (kind === "suggestion_pending") return `${title} for ${label}`;
  if (kind === "suggestion_comment") return `${title} about ${label}`;
  return title;
}
