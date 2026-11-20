import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Partner licences (owner decision 18 Nov 2026). Legacy Fortress invoices the partner; each member who joins on a
 * partner seat gets Premium at no cost to them. If the member's seat ends (the partner ends its licence, or the
 * member is removed), they become a Legacy Fortress customer: back to Free, told why, and offered Premium.
 * Nothing they saved is deleted; the free plan's limits only stop new additions.
 *
 * Runs as the server (service role); billing_profiles only accepts plan changes from the server.
 *   plan_source "partner"        Premium paid for by a partner licence
 *   plan_source "partner_ended"  back on Free after a partner seat ended; the member hasn't chosen yet
 *   plan_source "stripe"         the member pays; never changed here
 */
const FREE = { account_plan: "starter", plan_status: "active", record_limit: 6, invitation_limit: 1, monthly_charge: 0, trial_ends_at: null };

type Profile = { user_id: string; account_plan: string | null; plan_source: string | null; plan_status: string | null };

async function loadProfile(admin: SupabaseClient, userId: string) {
  const result = await admin.from("billing_profiles").select("user_id,account_plan,plan_source,plan_status").eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? null) as Profile | null;
}

/** A member who pays Stripe themselves keeps their own subscription; anyone else gets partner Premium. */
export async function grantPartnerPremium(admin: SupabaseClient, userId: string) {
  const profile = await loadProfile(admin, userId);
  if (profile?.account_plan === "premium" && profile.plan_source === "stripe") return { changed: false, reason: "already_paying" as const };
  const now = new Date().toISOString();
  const values = { account_plan: "premium", plan_status: "active", plan_source: "partner", monthly_charge: 0, trial_ends_at: null, updated_at: now };
  const result = profile
    ? await admin.from("billing_profiles").update(values).eq("user_id", userId)
    : await admin.from("billing_profiles").insert({ user_id: userId, ...values });
  if (result.error) throw new Error(result.error.message);
  return { changed: true as const };
}

/** Ends partner Premium, unless the member still has another active partner seat or pays Stripe themselves. */
export async function endPartnerPremium(admin: SupabaseClient, userId: string, options: { exceptLicenceId?: string; exceptSeatId?: string } = {}) {
  const profile = await loadProfile(admin, userId);
  if (!profile || profile.plan_source !== "partner") return { changed: false as const };
  let query = admin.from("enterprise_seats").select("id").eq("user_id", userId).eq("seat_status", "active");
  if (options.exceptLicenceId) query = query.neq("licence_id", options.exceptLicenceId);
  if (options.exceptSeatId) query = query.neq("id", options.exceptSeatId);
  const other = await query.limit(1);
  if (!other.error && (other.data ?? []).length) return { changed: false as const };
  const result = await admin.from("billing_profiles").update({ ...FREE, plan_source: "partner_ended", updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (result.error) throw new Error(result.error.message);
  return { changed: true as const };
}

/** The member has seen the notice and chosen to stay on Free. */
export async function acknowledgePartnerEnded(admin: SupabaseClient, userId: string) {
  const result = await admin.from("billing_profiles").update({ plan_source: "manual", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("plan_source", "partner_ended");
  if (result.error) throw new Error(result.error.message);
}

/** Ends partner Premium for everyone on a licence's seats (licence cancelled or expired). Counts only. */
export async function endPartnerPremiumForLicence(admin: SupabaseClient, licenceId: string) {
  const seats = await admin.from("enterprise_seats").select("user_id").eq("licence_id", licenceId).not("user_id", "is", null);
  if (seats.error) throw new Error(seats.error.message);
  let ended = 0;
  for (const userId of new Set(((seats.data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id))) {
    if ((await endPartnerPremium(admin, userId, { exceptLicenceId: licenceId })).changed) ended += 1;
  }
  return { ended };
}

/** True while the member holds an active partner seat (used to keep Premium if their own Stripe plan ends). */
export async function hasActivePartnerSeat(admin: SupabaseClient, userId: string) {
  const result = await admin.from("enterprise_seats").select("id").eq("user_id", userId).eq("seat_status", "active").limit(1);
  return !result.error && (result.data ?? []).length > 0;
}
