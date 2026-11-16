import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAccounts } from "./testAccounts";
import type { AdminAccessState } from "./access.ts";

type AnySupabaseClient = SupabaseClient;

export type AdminDashboardMetricStatus = "ok" | "warning" | "unavailable";

export type AdminDashboardMetric = {
  key: string;
  label: string;
  value: number | null;
  available: boolean;
  status: AdminDashboardMetricStatus;
  definition: string;
  source: string;
  updatedAt: string;
  warning?: string;
};

export type AdminDashboardSummary = {
  generatedAt: string;
  environment: "Local" | "Staging" | "Production";
  role: string;
  metrics: AdminDashboardMetric[];
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

type CountQuery = PromiseLike<CountResult> & {
  eq: (column: string, value: unknown) => CountQuery;
  neq: (column: string, value: unknown) => CountQuery;
  in: (column: string, values: unknown[]) => CountQuery;
  lt: (column: string, value: unknown) => CountQuery;
  not: (column: string, operator: string, value: unknown) => CountQuery;
};

const FIVE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 5;

export function getAdminRuntimeEnvironment(): AdminDashboardSummary["environment"] {
  const explicit = String(process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "").toLowerCase();
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (explicit.includes("prod") || process.env.VERCEL_ENV === "production") return "Production";
  if (explicit.includes("stag") || process.env.VERCEL_ENV === "preview") return "Staging";
  if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")) return "Local";
  return "Staging";
}

export function getAdminDashboardMetricKeysForRole(role: string) {
  if (role === "support_agent") {
    return ["totalUsers", "activeVaults", "incompleteVaults", "pendingInvitations", "failedEmails", "openSupportIssues", "riskFlags"];
  }
  if (role === "probate_reviewer" || role === "verification_reviewer") {
    return ["pendingInvitations", "pendingProbateReviews", "riskFlags"];
  }
  if (role === "auditor") {
    return ["totalUsers", "activeVaults", "incompleteVaults", "pendingInvitations", "failedEmails", "pendingProbateReviews", "riskFlags"];
  }
  if (role === "enterprise_admin") {
    return ["enterpriseOrganisations", "licenceSeats", "riskFlags"];
  }
  return [
    "totalUsers",
    "activeVaults",
    "incompleteVaults",
    "usersWithoutWill",
    "staleWills",
    "oldDocuments",
    "usersWithoutExecutor",
    "pendingInvitations",
    "failedEmails",
    "pendingProbateReviews",
    "openSupportIssues",
    "riskFlags",
  ];
}

export async function loadAdminDashboardSummary(
  client: AnySupabaseClient,
  access: AdminAccessState,
  options: { includeTests?: boolean } = {},
): Promise<AdminDashboardSummary> {
  const generatedAt = new Date().toISOString();
  const allMetrics = await buildAdminDashboardMetrics(client, generatedAt, options.includeTests ?? false);
  const allowedKeys = new Set(getAdminDashboardMetricKeysForRole(access.adminRole));
  return {
    generatedAt,
    environment: getAdminRuntimeEnvironment(),
    role: access.adminRole,
    metrics: allMetrics.filter((metric) => allowedKeys.has(metric.key)),
  };
}

async function buildAdminDashboardMetrics(client: AnySupabaseClient, generatedAt: string, includeTests: boolean) {
  // Every account (not just the first 1,000), without automated test accounts unless asked (16 Nov 2026).
  const accounts = await loadAccounts(client).catch(() => null);
  const testIds = accounts?.testIds ?? new Set<string>();
  const customers = (accounts?.all ?? []).filter((user) => includeTests || !testIds.has(user.id));
  const [
    totalUsers,
    activeVaults,
    incompleteVaults,
    usersWithoutWill,
    staleWills,
    oldDocuments,
    usersWithoutExecutor,
    pendingInvitations,
    failedEmails,
    pendingProbateReviews,
    openSupportIssues,
  ] = await Promise.all([
    accounts ? countAuthUsers(customers) : unavailable("Auth user count is unavailable from the current admin client."),
    safeCount("activeVaults", "user_profiles", (query) => query.eq("account_status", "active")),
    safeCount("incompleteVaults", "user_profiles", (query) => query.neq("onboarding_complete", true)),
    accounts ? countUsersWithoutActiveWill(client, customers) : unavailable("Auth users could not be loaded for no-will calculation."),
    safeCount("staleWills", "assets", (query) =>
      query.eq("section_key", "legal").eq("category_key", "wills").neq("status", "archived").lt("updated_at", staleThresholdIso()),
    ),
    safeCount("oldDocuments", "documents", (query) => query.lt("updated_at", staleThresholdIso())),
    accounts ? countUsersWithoutExecutor(client, customers) : unavailable("Auth users could not be loaded for executor calculation."),
    safeCount("pendingInvitations", "contact_invitations", (query) => query.eq("invitation_status", "pending").not("sent_at", "is", null)),
    safeCount("failedEmails", "invitation_events", (query) => query.in("event_type", ["failed", "bounced", "delivery_failed"])),
    safeCount("pendingProbateReviews", "probate_cases", (query) => query.in("status", ["submitted", "needs_information", "under_review"])),
    safeCount("openSupportIssues", "support_cases", (query) => query.in("status", ["open", "pending", "escalated"])),
  ]);

  return [
    metric("totalUsers", "Total users", totalUsers, "Valid authenticated customer accounts.", "Supabase Auth admin listUsers", generatedAt),
    metric("activeVaults", "Active vaults", activeVaults, "Profiles marked as active where the schema supports account_status.", "user_profiles.account_status", generatedAt),
    metric("incompleteVaults", "Incomplete vaults", incompleteVaults, "Profiles where onboarding/completion is not marked complete.", "user_profiles.onboarding_complete", generatedAt),
    metric("usersWithoutWill", "Users with no will", usersWithoutWill, "Users without an active canonical Will asset.", "auth.users + assets legal/wills", generatedAt),
    metric("staleWills", "Stale wills", staleWills, "Active Will records updated more than five years ago.", "assets legal/wills updated_at", generatedAt),
    metric("oldDocuments", "Old documents", oldDocuments, "Documents updated more than five years ago.", "documents.updated_at", generatedAt),
    metric("usersWithoutExecutor", "Users with no executor", usersWithoutExecutor, "Users without an active canonical executor/contact relationship.", "auth.users + contacts", generatedAt),
    metric("pendingInvitations", "Pending invitations", pendingInvitations, "Invitations that have been sent or opened but not accepted/revoked.", "contact_invitations.invitation_status", generatedAt),
    metric("failedEmails", "Failed emails", failedEmails, "Actual failed/bounced invitation delivery events where available.", "invitation_events.event_type", generatedAt),
    metric("pendingProbateReviews", "Pending probate/death-certificate reviews", pendingProbateReviews, "Real probate cases awaiting information, review or decision.", "probate_cases.status", generatedAt),
    metric("openSupportIssues", "Open support issues", openSupportIssues, "Open support case records where support_cases exists.", "support_cases.status", generatedAt),
    metric(
      "riskFlags",
      "Risk flags / operational alerts",
      buildRiskFlagCount([pendingInvitations, failedEmails, pendingProbateReviews, openSupportIssues]),
      "System-level alerts derived only from aggregate thresholds.",
      "aggregate metric status",
      generatedAt,
    ),
    metric("enterpriseOrganisations", "Organisations", unavailable("Enterprise organisation tables are not configured in this foundation phase."), "Enterprise organisation count placeholder.", "future enterprise schema", generatedAt),
    metric("licenceSeats", "Licence seats", unavailable("Licence entitlement tables are not configured in this foundation phase."), "Licence seat usage placeholder.", "future licence schema", generatedAt),
  ];

  async function safeCount(key: string, table: string, apply?: (query: CountQuery) => CountQuery) {
    if (includeTests) {
      const baseQuery = client.from(table).select("id", { count: "exact", head: true }) as unknown as CountQuery;
      const query = apply ? apply(baseQuery) : baseQuery;
      const res = await query as CountResult;
      if (res.error) return unavailable(`${key} is unavailable because ${table} could not be queried.`);
      return res.count ?? 0;
    }
    // Count only customers' rows: read the owner of each matching row and leave out test accounts.
    const ownerColumn = table === "user_profiles" ? "user_id" : "owner_user_id";
    const baseQuery = client.from(table).select(ownerColumn).limit(20000) as unknown as CountQuery;
    const query = apply ? apply(baseQuery) : baseQuery;
    const res = await query as unknown as { data: Array<Record<string, unknown>> | null; error: unknown };
    if (res.error) return unavailable(`${key} is unavailable because ${table} could not be queried.`);
    return (res.data ?? []).filter((row) => !testIds.has(String(row[ownerColumn] ?? ""))).length;
  }
}

function metric(
  key: string,
  label: string,
  value: number | ReturnType<typeof unavailable>,
  definition: string,
  source: string,
  updatedAt: string,
): AdminDashboardMetric {
  if (typeof value === "object") {
    return {
      key,
      label,
      value: null,
      available: false,
      status: "unavailable",
      definition,
      source,
      updatedAt,
      warning: value.warning,
    };
  }
  return {
    key,
    label,
    value,
    available: true,
    status: value > 0 && /failed|pending|stale|old|risk|without|with no|incomplete/i.test(label) ? "warning" : "ok",
    definition,
    source,
    updatedAt,
  };
}

function unavailable(warning: string) {
  return { warning };
}

async function countAuthUsers(customers: Array<{ email?: string | null }>) {
  const users = customers.filter((user) => {
    const email = String(user.email ?? "").toLowerCase();
    return !email.includes("service") && !email.includes("system");
  });
  return users.length;
}

async function countUsersWithoutActiveWill(client: AnySupabaseClient, customers: Array<{ id: string }>) {
  const assetsRes = await client
    .from("assets")
    .select("owner_user_id")
    .eq("section_key", "legal")
    .eq("category_key", "wills")
    .neq("status", "archived");
  if (assetsRes.error) return unavailable("Canonical Will records could not be queried.");
  const ownersWithWill = new Set((assetsRes.data ?? []).map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "")));
  return customers.filter((user) => !ownersWithWill.has(user.id)).length;
}

async function countUsersWithoutExecutor(client: AnySupabaseClient, customers: Array<{ id: string }>) {
  const contactsRes = await client
    .from("contacts")
    .select("owner_user_id")
    .in("relationship", ["executor", "Executor"]);
  if (contactsRes.error) return unavailable("Canonical executor contacts could not be queried.");
  const ownersWithExecutor = new Set((contactsRes.data ?? []).map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "")));
  return customers.filter((user) => !ownersWithExecutor.has(user.id)).length;
}

function staleThresholdIso() {
  return new Date(Date.now() - FIVE_YEARS_MS).toISOString();
}

function buildRiskFlagCount(values: Array<number | ReturnType<typeof unavailable>>) {
  const availableValues = values.filter((value): value is number => typeof value === "number");
  if (!availableValues.length) return unavailable("No operational alert sources are available yet.");
  return availableValues.filter((value) => value > 0).length;
}
