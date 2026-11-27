/**
 * People's own photos (owner, 27 Nov 2026). A person's photo shows wherever they appear in someone's Vault, but only
 * once they have accepted an invitation and linked their account (contacts.linked_user_id). Until then: initials.
 * The photo is the one they set themselves: uploaded in Profile, or copied once from their Google sign-in.
 * Apple sign-in never shares a photo, so Apple users show initials until they upload one.
 *
 * Server only (uses the admin client). Returns short-lived signed links, never storage paths.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AVATAR_BUCKET_CANDIDATES, getProfileAvatarPreview } from "../profile/workspace";

export async function getContactPhotos(admin: SupabaseClient, ownerUserId: string): Promise<Record<string, string>> {
  const contacts = await admin.from("contacts").select("id,linked_user_id").eq("owner_user_id", ownerUserId).not("linked_user_id", "is", null).limit(500);
  if (contacts.error) return {};
  const rows = (contacts.data ?? []) as Array<{ id: string; linked_user_id: string | null }>;
  const userIds = [...new Set(rows.map((row) => row.linked_user_id).filter((id): id is string => Boolean(id) && id !== ownerUserId))];
  if (!userIds.length) return {};
  const profiles = await admin.from("user_profiles").select("user_id,avatar_path").in("user_id", userIds);
  if (profiles.error) return {};
  const pathByUser = new Map(((profiles.data ?? []) as Array<{ user_id: string; avatar_path: string | null }>)
    .filter((row) => String(row.avatar_path ?? "").trim())
    .map((row) => [row.user_id, String(row.avatar_path)]));
  const signedByUser = new Map<string, string>();
  for (const [userId, path] of pathByUser) {
    const preview = await getProfileAvatarPreview(admin, path).catch(() => null);
    if (preview?.signedUrl) signedByUser.set(userId, preview.signedUrl);
  }
  const photos: Record<string, string> = {};
  for (const row of rows) {
    const url = row.linked_user_id ? signedByUser.get(row.linked_user_id) : undefined;
    if (url) photos[row.id] = url;
  }
  return photos;
}

/** Google's profile photo address from a Google sign-in, if there is one. Apple never provides a photo. */
export function googlePhotoUrl(user: { app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null; identities?: Array<{ provider?: string }> | null }) {
  const providers = new Set<string>([String(user.app_metadata?.provider ?? ""), ...((user.app_metadata?.providers as string[] | undefined) ?? []), ...(user.identities ?? []).map((identity) => String(identity.provider ?? ""))]);
  if (!providers.has("google")) return null;
  const url = String(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? "").trim();
  return /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//i.test(url) ? url : null;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Store a photo as the person's own profile photo (their account only), replacing any earlier one. */
export async function saveOwnPhoto(admin: SupabaseClient, userId: string, bytes: ArrayBuffer, contentType: string, source: "upload" | "google") {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (!PHOTO_TYPES.has(type)) return { ok: false as const, error: "That isn't a photo we can use. Please choose a JPEG, PNG or HEIC picture." };
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false as const, error: "Please choose a photo under 5 MB." };
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type.startsWith("image/hei") ? "heic" : "jpg";
  const path = `${userId}/avatar-${Date.now()}-${source}.${extension}`;
  let stored = false;
  for (const bucket of AVATAR_BUCKET_CANDIDATES) {
    const upload = await admin.storage.from(bucket).upload(path, new Blob([bytes], { type }), { contentType: type, upsert: true, cacheControl: "3600" });
    if (!upload.error) { stored = true; break; }
    if (!/bucket not found/i.test(upload.error.message)) return { ok: false as const, error: "We couldn't save that photo. Please try again." };
  }
  if (!stored) return { ok: false as const, error: "We couldn't save that photo. Please try again." };
  const existing = await admin.from("user_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  const write = existing.data
    ? await admin.from("user_profiles").update({ avatar_path: path, updated_at: new Date().toISOString() }).eq("user_id", userId)
    : await admin.from("user_profiles").insert({ user_id: userId, avatar_path: path });
  if (write.error) return { ok: false as const, error: "We couldn't save that photo. Please try again." };
  return { ok: true as const, path };
}

/**
 * Google sign-in: if the person has no photo of their own yet, copy their Google photo in once, so it is stored with
 * their Vault (not loaded from Google every time). Never replaces a photo they chose.
 */
export async function importGooglePhotoIfMissing(admin: SupabaseClient, user: Parameters<typeof googlePhotoUrl>[0] & { id: string }, currentAvatarPath: string | null | undefined) {
  if (String(currentAvatarPath ?? "").trim()) return null;
  const source = googlePhotoUrl(user);
  if (!source) return null;
  try {
    const large = source.replace(/=s\d+(-c)?$/, "=s400-c");
    const response = await fetch(large, { cache: "no-store", redirect: "error" });
    if (!response.ok) return null;
    const saved = await saveOwnPhoto(admin, user.id, await response.arrayBuffer(), response.headers.get("content-type") ?? "", "google");
    return saved.ok ? saved.path : null;
  } catch {
    return null;
  }
}
