import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENT_UPLOAD_MIME_TYPES, sanitizeFileName } from "../validation/upload.ts";
import { isDeliverableAddress } from "../identity-verification/resultEmail.ts";
import { validateStagingSender } from "../auth/sendEmailHook.ts";

/**
 * Suggested documents (V5.2 approval path 7a–7f; owner decision 3 Nov 2026).
 * Every decision is made by the database as the signed-in person (owner or proposer). The server
 * only moves files: it holds a suggested file in the private bucket, and on approval adds it to the
 * record as the System. Emails carry no record details.
 */
export const SUGGESTION_BUCKET = "record-suggestions";
export const SUGGESTION_MAX_BYTES = 15 * 1024 * 1024;
export const SUGGESTION_MIME_TYPES = DOCUMENT_UPLOAD_MIME_TYPES;
export const REJECT_REASONS = ["wrong_record", "wrong_document", "cant_read", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export function clientAsUser(request: Request): SupabaseClient {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return createClient(String(process.env.NEXT_PUBLIC_SUPABASE_URL), String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function heldFilePath(ownerUserId: string, proposerUserId: string, fileName: string) {
  return `${ownerUserId}/${proposerUserId}/${crypto.randomUUID()}/${sanitizeFileName(fileName).slice(-120) || "document"}`;
}

export function validateSuggestedFile(file: { type: string; size: number; name: string } | null) {
  if (!file || !file.name) return "Choose a file to suggest.";
  if (!SUGGESTION_MIME_TYPES.includes(file.type)) return "That type of file can’t be added. Use a PDF, photo, Word, Excel or CSV file.";
  if (file.size <= 0 || file.size > SUGGESTION_MAX_BYTES) return "Files can be up to 15MB.";
  return null;
}

/** Owner chose to approve: copy the held file into the record's documents, then mark it applied. */
export async function applyApprovedSuggestion(admin: SupabaseClient, suggestionId: string, approved: {
  storage_path: string; file_name: string; mime_type: string; size_bytes: number; asset_id: string; owner_user_id: string;
}) {
  const asset = await admin.from("assets").select("id,owner_user_id,organisation_id,wallet_id,deleted_at").eq("id", approved.asset_id).maybeSingle();
  if (asset.error || !asset.data || asset.data.owner_user_id !== approved.owner_user_id || asset.data.deleted_at) throw new Error("record_unavailable");
  const held = await admin.storage.from(SUGGESTION_BUCKET).download(approved.storage_path);
  if (held.error || !held.data) throw new Error("held_file_missing");
  const target = `users/${approved.owner_user_id}/assets/${approved.asset_id}/documents/${Date.now()}-${sanitizeFileName(approved.file_name)}`;
  const upload = await admin.storage.from("vault-docs").upload(target, held.data, { contentType: approved.mime_type, upsert: false });
  if (upload.error) throw new Error("copy_failed");
  const inserted = await admin.from("documents").insert({
    organisation_id: asset.data.organisation_id,
    wallet_id: asset.data.wallet_id,
    asset_id: approved.asset_id,
    owner_user_id: approved.owner_user_id,
    storage_bucket: "vault-docs",
    storage_path: target,
    file_name: approved.file_name,
    mime_type: approved.mime_type,
    size_bytes: approved.size_bytes,
    checksum: null,
    document_kind: "document",
  }).select("id").single();
  if (inserted.error || !inserted.data) {
    await admin.storage.from("vault-docs").remove([target]);
    throw new Error("document_link_failed");
  }
  const marked = await admin.rpc("lf_mark_suggestion_applied", { p_suggestion_id: suggestionId, p_document_id: inserted.data.id });
  if (marked.error) throw new Error("mark_applied_failed");
  await removeHeldFile(admin, suggestionId, approved.storage_path);
  return inserted.data.id as string;
}

export async function removeHeldFile(admin: SupabaseClient, suggestionId: string, storagePath: string | null | undefined) {
  if (!storagePath) return;
  const removed = await admin.storage.from(SUGGESTION_BUCKET).remove([storagePath]);
  if (!removed.error) await admin.rpc("lf_mark_suggestion_file_removed", { p_suggestion_id: suggestionId });
}

/** Content-free email: "You have an update to review in Legacy Fortress" (7b). */
export async function sendSuggestionEmail(admin: SupabaseClient, recipientUserId: string, kind: "review" | "decided" | "comment", idempotencyKey: string) {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return false;
  const recipient = await admin.auth.admin.getUserById(recipientUserId);
  const email = recipient.data.user?.email ?? null;
  if (!isDeliverableAddress(email)) return false;
  const appUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com").replace(/\/$/, "");
  const subject = kind === "review" ? "You have an update to review in Legacy Fortress" : kind === "decided" ? "There’s an update on your suggestion" : "You have a new comment in Legacy Fortress";
  const text = `${subject}.\n\nSign in to see it: ${appUrl}/sign-in\n\nFor your security this email doesn’t include any details.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? "")), to: [email], subject, text, html: text.split("\n\n").map((part) => `<p>${part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/(https:\/\/\S+)/, '<a href="$1">$1</a>')}</p>`).join("") }),
  }).catch(() => null);
  return Boolean(response?.ok);
}

export function friendlyRpcError(message: string | undefined) {
  const text = String(message ?? "");
  if (/can’t suggest|not found|42501/i.test(text)) return "You can’t do that for this record.";
  if (/decided|withdrawn|waiting to be applied/i.test(text)) return "This suggestion has already been decided.";
  if (/Too many/i.test(text)) return "You have 20 suggestions waiting. Wait for a decision before sending more.";
  if (/reason|comment/i.test(text)) return text;
  return "That didn’t work. Try again.";
}
