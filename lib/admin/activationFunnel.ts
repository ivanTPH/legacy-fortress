import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Activation funnel for Admin Overview (UX review 2): sign-ups each week, and how many of the last 12 weeks'
 * sign-ups went on to finish set-up, add a first record, invite someone and choose Premium. Counts only:
 * never names, record titles or values. Test accounts are left out unless the admin asks for them.
 */
export type FunnelStep = { key: "signed_up" | "set_up" | "first_record" | "invited" | "premium"; label: string; count: number; percent: number };
export type ActivationFunnel = { weeks: Array<{ weekStart: string; signUps: number }>; steps: FunnelStep[]; windowWeeks: number };

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function weekStart(iso: string) {
  const date = new Date(iso);
  const day = (date.getUTCDay() + 6) % 7; // Monday
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day)).toISOString().slice(0, 10);
}

export function buildFunnel(input: {
  users: Array<{ id: string; created_at?: string | null }>;
  setUp: Set<string>; withRecord: Set<string>; invited: Set<string>; premium: Set<string>;
  now?: Date; windowWeeks?: number;
}): ActivationFunnel {
  const windowWeeks = input.windowWeeks ?? 12;
  const now = input.now ?? new Date();
  const since = now.getTime() - windowWeeks * WEEK;
  const cohort = input.users.filter((user) => user.created_at && Date.parse(user.created_at) >= since);
  const weeks = new Map<string, number>();
  for (let i = windowWeeks - 1; i >= 0; i -= 1) weeks.set(weekStart(new Date(now.getTime() - i * WEEK).toISOString()), 0);
  for (const user of cohort) {
    const key = weekStart(String(user.created_at));
    if (weeks.has(key)) weeks.set(key, (weeks.get(key) ?? 0) + 1);
  }
  const total = cohort.length;
  const count = (set: Set<string>) => cohort.filter((user) => set.has(user.id)).length;
  const step = (key: FunnelStep["key"], label: string, value: number): FunnelStep => ({ key, label, count: value, percent: total ? Math.round((value / total) * 100) : 0 });
  return {
    windowWeeks,
    weeks: [...weeks.entries()].map(([weekStartDate, signUps]) => ({ weekStart: weekStartDate, signUps })),
    steps: [
      step("signed_up", "Signed up", total),
      step("set_up", "Finished set-up", count(input.setUp)),
      step("first_record", "Added a first record", count(input.withRecord)),
      step("invited", "Invited someone", count(input.invited)),
      step("premium", "Chose Premium", count(input.premium)),
    ],
  };
}

export async function loadActivationFunnel(client: SupabaseClient, users: Array<{ id: string; created_at?: string | null }>, now = new Date()): Promise<ActivationFunnel> {
  const since = new Date(now.getTime() - 12 * WEEK).toISOString();
  const ids = users.filter((user) => user.created_at && user.created_at >= since).map((user) => user.id);
  const setUp = new Set<string>(), withRecord = new Set<string>(), invited = new Set<string>(), premium = new Set<string>();
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += 150) chunks.push(ids.slice(start, start + 150));
  // Chunks run side by side (a few at a time) so a large TEST project still answers quickly.
  for (let start = 0; start < chunks.length; start += 4) {
    await Promise.all(chunks.slice(start, start + 4).map(async (chunk) => {
      const [onboarding, assets, records, invitations, billing] = await Promise.all([
        client.from("user_onboarding_state").select("user_id").in("user_id", chunk).eq("is_completed", true),
        client.from("assets").select("owner_user_id").in("owner_user_id", chunk).is("deleted_at", null).limit(5000),
        client.from("records").select("owner_user_id").in("owner_user_id", chunk).limit(5000),
        client.from("contact_invitations").select("owner_user_id").in("owner_user_id", chunk).limit(5000),
        client.from("billing_profiles").select("user_id").in("user_id", chunk).eq("account_plan", "premium"),
      ]);
      for (const row of (onboarding.data ?? []) as Array<{ user_id: string }>) setUp.add(row.user_id);
      for (const row of [...(assets.data ?? []), ...(records.data ?? [])] as Array<{ owner_user_id: string }>) withRecord.add(row.owner_user_id);
      for (const row of (invitations.data ?? []) as Array<{ owner_user_id: string }>) invited.add(row.owner_user_id);
      for (const row of (billing.data ?? []) as Array<{ user_id: string }>) premium.add(row.user_id);
    }));
  }
  return buildFunnel({ users, setUp, withRecord, invited, premium, now });
}
