import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "./supabaseErrors";

type AnySupabaseClient = SupabaseClient;

export type OwnerPlanKey = "starter" | "premium";
export type OwnerPlanStatus = "active" | "trialing" | "past_due" | "canceled";
export type AccountKind = "owner" | "linked_view_only" | "demo_reviewer" | "admin_internal";

export type OwnerPlanProfile = {
  userId: string;
  accountPlan: OwnerPlanKey;
  planStatus: OwnerPlanStatus;
  planSource: string;
  trialEndsAt: string | null;
  recordLimit: number | null;
  invitationLimit: number | null;
  monthlyCharge: number;
  billingCurrency: string;
};

export class PlanLimitError extends Error {
  readonly kind: "record_limit" | "invitation_limit";
  readonly limit: number;
  readonly href: string;

  constructor(kind: "record_limit" | "invitation_limit", limit: number) {
    super(
      kind === "record_limit"
        ? `Starter plan limit reached: ${limit} saved records. Upgrade in Billing and Account to continue adding records.`
        : `Starter plan limit reached: ${limit} invitations. Upgrade in Billing and Account to continue sharing access.`,
    );
    this.name = "PlanLimitError";
    this.kind = kind;
    this.limit = limit;
    this.href = "/account/billing?reason=plan-limit";
  }
}

type RawBillingProfileRow = {
  user_id?: string | null;
  account_plan?: string | null;
  plan_status?: string | null;
  plan_source?: string | null;
  trial_ends_at?: string | null;
  record_limit?: number | null;
  invitation_limit?: number | null;
  monthly_charge?: number | null;
  billing_currency?: string | null;
};

export const STARTER_RECORD_LIMIT = 25;
export const STARTER_INVITATION_LIMIT = 5;
export const DEFAULT_OWNER_PLAN: OwnerPlanKey = "starter";
export const DEFAULT_OWNER_PLAN_STATUS: OwnerPlanStatus = "active";

export function normalizeOwnerPlanProfile(userId: string, row?: RawBillingProfileRow | null): OwnerPlanProfile {
  const accountPlan = row?.account_plan === "premium" ? "premium" : DEFAULT_OWNER_PLAN;
  const planStatus = normalizeOwnerPlanStatus(row?.plan_status);
  return {
    userId,
    accountPlan,
    planStatus,
    planSource: String(row?.plan_source ?? "manual").trim() || "manual",
    trialEndsAt: row?.trial_ends_at ?? null,
    recordLimit: accountPlan === "premium" ? null : Number(row?.record_limit ?? STARTER_RECORD_LIMIT),
    invitationLimit: accountPlan === "premium" ? null : Number(row?.invitation_limit ?? STARTER_INVITATION_LIMIT),
    monthlyCharge: Number(row?.monthly_charge ?? (accountPlan === "premium" ? 9.99 : 0)),
    billingCurrency: String(row?.billing_currency ?? "GBP").trim().toUpperCase() || "GBP",
  };
}

export async function loadOwnerPlanProfile(client: AnySupabaseClient, userId: string) {
  let res = await client
    .from("billing_profiles")
    .select("user_id,account_plan,plan_status,plan_source,trial_ends_at,record_limit,invitation_limit,monthly_charge,billing_currency")
    .eq("user_id", userId)
    .maybeSingle();

  if (res.error && isPlanColumnError(res.error)) {
    res = await client
      .from("billing_profiles")
      .select("user_id,monthly_charge,billing_currency")
      .eq("user_id", userId)
      .maybeSingle();
  }

  if (res.error) {
    throw new Error(res.error.message);
  }

  return normalizeOwnerPlanProfile(userId, (res.data ?? null) as RawBillingProfileRow | null);
}

export async function ensureOwnerPlanProfile(client: AnySupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    account_plan: DEFAULT_OWNER_PLAN,
    plan_status: DEFAULT_OWNER_PLAN_STATUS,
    plan_source: "manual",
    record_limit: STARTER_RECORD_LIMIT,
    invitation_limit: STARTER_INVITATION_LIMIT,
    monthly_charge: 0,
    billing_currency: "GBP",
    updated_at: now,
  };

  let existing = await client
    .from("billing_profiles")
    .select("user_id,account_plan,plan_status,plan_source,trial_ends_at,record_limit,invitation_limit,monthly_charge,billing_currency")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error && isPlanColumnError(existing.error)) {
    existing = await client
      .from("billing_profiles")
      .select("user_id,monthly_charge,billing_currency")
      .eq("user_id", userId)
      .maybeSingle();
  }

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data) {
    return normalizeOwnerPlanProfile(userId, existing.data as RawBillingProfileRow);
  }

  let write = await client.from("billing_profiles").upsert(payload, { onConflict: "user_id" });
  if (write.error && isPlanColumnError(write.error)) {
    write = await client.from("billing_profiles").upsert(
      {
        user_id: userId,
        monthly_charge: 0,
        billing_currency: "GBP",
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
  }
  if (write.error) {
    throw new Error(write.error.message);
  }
  return normalizeOwnerPlanProfile(userId, payload);
}

export function getOwnerPlanLabel(plan: OwnerPlanKey) {
  return plan === "premium" ? "Premium" : "Starter";
}

export function getOwnerPlanSupportMessage(plan: OwnerPlanProfile) {
  if (plan.accountPlan === "premium") {
    return "Unlimited owner record creation and invitation sending, ready for future billing activation.";
  }
  return `Starter includes up to ${plan.recordLimit ?? STARTER_RECORD_LIMIT} saved records and ${plan.invitationLimit ?? STARTER_INVITATION_LIMIT} invitations before upgrade.`;
}

export function getAccountKindLabel(kind: AccountKind) {
  if (kind === "demo_reviewer") return "Demo reviewer";
  if (kind === "linked_view_only") return "Linked view-only";
  if (kind === "admin_internal") return "Admin";
  return "Owner";
}

export function resolveAccountKind({
  viewerMode,
  isDemoExperience,
  isAdmin,
}: {
  viewerMode: "owner" | "linked";
  isDemoExperience: boolean;
  isAdmin: boolean;
}): AccountKind {
  if (isAdmin) return "admin_internal";
  if (isDemoExperience) return "demo_reviewer";
  if (viewerMode === "linked") return "linked_view_only";
  return "owner";
}

export function assertOwnerCanCreateRecord(plan: OwnerPlanProfile, currentRecordCount: number) {
  if (plan.accountPlan === "premium") return;
  const limit = plan.recordLimit ?? STARTER_RECORD_LIMIT;
  if (currentRecordCount >= limit) {
    throw new PlanLimitError("record_limit", limit);
  }
}

export function assertOwnerCanSendInvitation(plan: OwnerPlanProfile, currentInvitationCount: number) {
  if (plan.accountPlan === "premium") return;
  const limit = plan.invitationLimit ?? STARTER_INVITATION_LIMIT;
  if (currentInvitationCount > limit) {
    throw new PlanLimitError("invitation_limit", limit);
  }
}

export function getPlanLimitRedirectHref(error: unknown) {
  return error instanceof PlanLimitError ? error.href : null;
}

function normalizeOwnerPlanStatus(value: string | null | undefined): OwnerPlanStatus {
  if (value === "trialing" || value === "past_due" || value === "canceled") return value;
  return "active";
}

function isPlanColumnError(error: { message?: string } | null | undefined) {
  return (
    isMissingColumnError(error ?? null, "account_plan")
    || isMissingColumnError(error ?? null, "plan_status")
    || isMissingColumnError(error ?? null, "plan_source")
    || isMissingColumnError(error ?? null, "trial_ends_at")
    || isMissingColumnError(error ?? null, "record_limit")
    || isMissingColumnError(error ?? null, "invitation_limit")
  );
}
