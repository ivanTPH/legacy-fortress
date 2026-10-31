import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Release a deceased owner's nominations (server only; admin client = service role).
 * The database function re-checks everything: the estate is locked, the probate case is
 * approved with the grant of probate, and each nominee's ID is verified.
 */

export type ReleaseReadiness = { activeNominations: number; releasedNominations: number; idVerified: number; notJoined: number };

export async function loadReleaseReadiness(client: SupabaseClient, ownerUserId: string): Promise<ReleaseReadiness> {
  const { data, error } = await client.rpc("lf_release_readiness", { p_owner_user_id: ownerUserId });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { activeNominations: 0, releasedNominations: 0, idVerified: 0, notJoined: 0 };
  return {
    activeNominations: Number(row.active_nominations ?? 0),
    releasedNominations: Number(row.released_nominations ?? 0),
    idVerified: Number(row.id_verified ?? 0),
    notJoined: Number(row.not_joined ?? 0),
  };
}

export class EstateReleaseError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.name = "EstateReleaseError"; this.status = status; }
}

export async function releaseNominations(client: SupabaseClient, input: { ownerUserId: string; reviewerUserId: string; probateCaseId: string }) {
  const { data, error } = await client.rpc("lf_release_vault_nominations", {
    p_owner_user_id: input.ownerUserId,
    p_reviewer_user_id: input.reviewerUserId,
    p_probate_case_id: input.probateCaseId,
  });
  if (error) throw new EstateReleaseError(error.message.replace(/^.*?:\s*/, ""));
  const row = Array.isArray(data) ? data[0] : null;
  return { released: Number(row?.released ?? 0), waitingForId: Number(row?.waiting_for_id ?? 0), notJoined: Number(row?.not_joined ?? 0) };
}
