import type { SupabaseClient } from "@supabase/supabase-js";

/** Browser helpers for suggested documents. Reads use the person's own session (RLS: owner or proposer only). */
export type Suggestion = {
  id: string;
  owner_user_id: string;
  asset_id: string;
  proposer_user_id: string;
  proposer_name: string | null;
  record_title: string | null;
  status: "pending" | "approved" | "applied" | "rejected" | "withdrawn";
  note: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  reject_reason: string | null;
  reject_comment: string | null;
  decided_at: string | null;
  created_at: string;
  file_removed_at: string | null;
};
export type SuggestionComment = { id: string; suggestion_id: string; author_user_id: string | null; author_name: string | null; body: string; created_at: string };

const COLUMNS = "id,owner_user_id,asset_id,proposer_user_id,proposer_name,record_title,status,note,file_name,mime_type,size_bytes,reject_reason,reject_comment,decided_at,created_at,file_removed_at";

export const REJECT_REASON_LABELS: Record<string, string> = {
  wrong_record: "Wrong record",
  wrong_document: "Wrong document",
  cant_read: "Can’t read it",
  other: "Other",
};

export const SUGGESTION_STATUS: Record<Suggestion["status"], { label: string; icon: string; tone: "pending" | "approved" | "rejected" | "neutral" }> = {
  pending: { label: "Pending approval", icon: "hourglass_top", tone: "pending" },
  approved: { label: "Approved", icon: "check", tone: "approved" },
  applied: { label: "Added", icon: "done_all", tone: "approved" },
  rejected: { label: "Rejected", icon: "close", tone: "rejected" },
  withdrawn: { label: "Withdrawn", icon: "undo", tone: "neutral" },
};

/** Suggestions waiting for this owner's decision. Empty when the feature isn't on this server yet. */
export async function loadPendingSuggestionsForOwner(client: SupabaseClient, ownerUserId: string): Promise<Suggestion[]> {
  const { data, error } = await client.from("record_suggestions").select(COLUMNS).eq("owner_user_id", ownerUserId).in("status", ["pending", "approved"]).order("created_at", { ascending: true }).limit(50);
  return error ? [] : ((data ?? []) as Suggestion[]);
}

export async function loadMySuggestions(client: SupabaseClient, proposerUserId: string): Promise<Suggestion[]> {
  const { data, error } = await client.from("record_suggestions").select(COLUMNS).eq("proposer_user_id", proposerUserId).order("created_at", { ascending: false }).limit(100);
  return error ? [] : ((data ?? []) as Suggestion[]);
}

export async function loadSuggestion(client: SupabaseClient, id: string) {
  const [row, comments] = await Promise.all([
    client.from("record_suggestions").select(COLUMNS).eq("id", id).maybeSingle(),
    client.from("record_suggestion_comments").select("id,suggestion_id,author_user_id,author_name,body,created_at").eq("suggestion_id", id).order("created_at", { ascending: true }),
  ]);
  return { suggestion: (row.data ?? null) as Suggestion | null, comments: ((comments.data ?? []) as SuggestionComment[]) };
}

export async function loadSuggestionTargets(client: SupabaseClient): Promise<Array<{ asset_id: string; owner_user_id: string; owner_name: string; record_title: string }>> {
  const { data, error } = await client.rpc("lf_suggestion_targets");
  return error ? [] : ((data ?? []) as Array<{ asset_id: string; owner_user_id: string; owner_name: string; record_title: string }>);
}

async function authHeaders(client: SupabaseClient): Promise<Record<string, string>> {
  const session = await client.auth.getSession();
  const token = session.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function suggestionAction(client: SupabaseClient, id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/suggestions/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders(client)) },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = (await response?.json().catch(() => ({}))) as { ok?: boolean; message?: string; assetId?: string } | undefined;
  return { ok: Boolean(response?.ok && json?.ok), message: json?.message ?? "That didn’t work. Try again.", assetId: json?.assetId };
}

export async function sendSuggestion(client: SupabaseClient, input: { assetId: string; file: File; note: string }) {
  const form = new FormData();
  form.set("assetId", input.assetId);
  form.set("file", input.file);
  form.set("note", input.note);
  const response = await fetch("/api/suggestions", { method: "POST", headers: await authHeaders(client), body: form }).catch(() => null);
  const json = (await response?.json().catch(() => ({}))) as { ok?: boolean; message?: string } | undefined;
  return { ok: Boolean(response?.ok && json?.ok), message: json?.message ?? "That didn’t work. Try again." };
}

export async function openSuggestionPreview(client: SupabaseClient, id: string) {
  const response = await fetch(`/api/suggestions/${encodeURIComponent(id)}/preview`, { headers: await authHeaders(client) }).catch(() => null);
  const json = (await response?.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string } | undefined;
  if (json?.url) { window.open(json.url, "_blank", "noopener,noreferrer"); return null; }
  return json?.message ?? "The file couldn’t be opened.";
}

export function formatUkDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function firstName(name: string | null | undefined, fallback = "They") {
  return String(name ?? "").trim().split(/\s+/)[0] || fallback;
}
