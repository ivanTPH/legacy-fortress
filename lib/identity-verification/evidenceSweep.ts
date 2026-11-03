import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanupExpiredIdentityEvidence } from "./service.ts";

/**
 * Daily sweep (production gate "ID evidence deletion", 3 Nov 2026). Photos are already deleted when a check
 * is decided; this catches the rest once their retention date has passed: checks people started and never
 * finished, and decided checks whose deletion failed. A check still waiting for a reviewer is left alone
 * and counted, so a person can still decide it. Returns counts only.
 */
const WAITING_FOR_REVIEW = new Set(["review_required"]);

export async function sweepExpiredIdentityEvidence(admin: SupabaseClient, now = new Date(), limit = 200) {
  const cutoff = now.toISOString();
  const [docs, challenges] = await Promise.all([
    admin.from("identity_verification_documents").select("request_id").lt("retention_until", cutoff).neq("extraction_status", "deleted").limit(limit),
    admin.from("identity_presence_challenges").select("request_id").lt("retention_until", cutoff).not("storage_path", "is", null).limit(limit),
  ]);
  if (docs.error || challenges.error) return { ok: false as const, error: "evidence_lookup_failed" };
  const requestIds = Array.from(new Set([...(docs.data ?? []), ...(challenges.data ?? [])].map((row) => String((row as { request_id: string }).request_id))));
  const result = { ok: true as const, found: requestIds.length, deleted: 0, waitingForReview: 0, failed: 0 };
  if (!requestIds.length) return result;
  const requests = await admin.from("identity_verification_requests").select("id,user_id,status").in("id", requestIds);
  for (const request of (requests.data ?? []) as Array<{ id: string; user_id: string; status: string }>) {
    if (WAITING_FOR_REVIEW.has(request.status)) { result.waitingForReview += 1; continue; }
    try {
      await cleanupExpiredIdentityEvidence(admin, request.user_id, request.id);
      // The selfie rows keep their record but no longer point at a file.
      await admin.from("identity_presence_challenges").update({ storage_path: null, updated_at: cutoff }).eq("request_id", request.id).not("storage_path", "is", null);
      result.deleted += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
