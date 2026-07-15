import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RoleName =
  | "super_admin"
  | "support_agent"
  | "probate_reviewer"
  | "auditor"
  | "enterprise_admin"
  | "standard_user"
  | "revoked_admin"
  | "invalid_role";

type TestAccount = {
  email: string;
  role: RoleName;
  adminRole?: string;
  adminStatus?: "active" | "inactive";
  displayName: string;
};

const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3012";
const PASSWORD = `LocalRoleMatrix-${Date.now()}-Aa1!`;
const FIXTURE_ID = Date.now();
const FIXTURE_LABEL = `Admin role matrix ${FIXTURE_ID}`;

const ACCOUNTS: TestAccount[] = [
  { email: "uat.superadmin@local.test", role: "super_admin", adminRole: "super_admin", adminStatus: "active", displayName: "UAT Super Admin" },
  { email: "uat.support@local.test", role: "support_agent", adminRole: "support_agent", adminStatus: "active", displayName: "UAT Support Agent" },
  { email: "uat.probate@local.test", role: "probate_reviewer", adminRole: "probate_reviewer", adminStatus: "active", displayName: "UAT Probate Reviewer" },
  { email: "uat.auditor@local.test", role: "auditor", adminRole: "auditor", adminStatus: "active", displayName: "UAT Auditor" },
  { email: "uat.enterprise@local.test", role: "enterprise_admin", adminRole: "organisation_admin", adminStatus: "active", displayName: "UAT Enterprise Admin" },
  { email: "uat.standard@local.test", role: "standard_user", displayName: "UAT Standard User" },
  { email: "uat.revoked@local.test", role: "revoked_admin", adminRole: "super_admin", adminStatus: "inactive", displayName: "UAT Revoked Admin" },
  { email: "uat.invalidrole@local.test", role: "invalid_role", displayName: "UAT Invalid Role" },
];

const ADMIN_ROUTES = [
  { path: "/api/internal/admin/session", method: "GET" },
  { path: "/api/internal/admin/dashboard-summary", method: "GET" },
  { path: "/api/internal/admin/users", method: "GET" },
  { path: "/api/internal/admin/support", method: "GET" },
  { path: "/api/internal/admin/verifications", method: "GET" },
  { path: "/api/internal/admin/audit-history", method: "GET" },
  { path: "/api/internal/admin/admin-users", method: "GET" },
  { path: "/api/internal/admin/local-role-override", method: "POST", body: { role: "support_agent" } },
];

const ROLE_EXPECTATIONS: Record<RoleName, Partial<Record<string, number>>> = {
  super_admin: {
    session: 200,
    "dashboard-summary": 200,
    users: 200,
    support: 200,
    verifications: 200,
    "audit-history": 200,
    "admin-users": 200,
    "local-role-override": 200,
  },
  support_agent: {
    session: 200,
    "dashboard-summary": 200,
    users: 200,
    support: 200,
    verifications: 403,
    "audit-history": 403,
    "admin-users": 403,
    "local-role-override": 403,
  },
  probate_reviewer: {
    session: 200,
    "dashboard-summary": 200,
    users: 403,
    support: 403,
    verifications: 200,
    "audit-history": 403,
    "admin-users": 403,
    "local-role-override": 403,
  },
  auditor: {
    session: 200,
    "dashboard-summary": 200,
    users: 403,
    support: 403,
    verifications: 403,
    "audit-history": 200,
    "admin-users": 403,
    "local-role-override": 403,
  },
  enterprise_admin: {
    session: 200,
    "dashboard-summary": 200,
    users: 403,
    support: 403,
    verifications: 403,
    "audit-history": 403,
    "admin-users": 403,
    "local-role-override": 403,
  },
  standard_user: {
    session: 403,
    "dashboard-summary": 403,
    users: 403,
    support: 403,
    verifications: 403,
    "audit-history": 403,
    "admin-users": 403,
    "local-role-override": 403,
  },
  revoked_admin: {
    session: 403,
    "dashboard-summary": 403,
    users: 403,
    support: 403,
    verifications: 403,
    "audit-history": 403,
    "admin-users": 403,
    "local-role-override": 403,
  },
  invalid_role: {
    session: 403,
    "dashboard-summary": 403,
    users: 403,
    support: 403,
    verifications: 403,
    "audit-history": 403,
    "admin-users": 403,
    "local-role-override": 403,
  },
};

const ADMIN_METRIC_LABELS = {
  totalUsers: "Total users",
  usersWithoutWill: "Users with no will",
  staleWills: "Stale wills",
  oldDocuments: "Old documents",
  usersWithoutExecutor: "Users with no executor",
  pendingInvitations: "Pending invitations",
  failedEmails: "Failed emails",
  pendingProbateReviews: "Pending probate/death-certificate reviews",
};

test.describe.serial("admin role matrix local proof", () => {
  let adminClient: SupabaseClient;
  const userIds = new Map<string, string>();

  test.beforeAll(async () => {
    test.skip(!LOCAL_SUPABASE_URL.includes("127.0.0.1") && !LOCAL_SUPABASE_URL.includes("localhost"), "Local Supabase env is required.");
    test.skip(!ANON_KEY || !SERVICE_KEY, "Local anon and service-role keys are required.");
    adminClient = createClient(LOCAL_SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await createAccounts(adminClient, userIds);
    await seedDashboardFixture(adminClient, userIds);
  });

  for (const account of ACCOUNTS) {
    test(`${account.role} browser route and API access`, async ({ page, request }) => {
      await signInViaBrowser(page, account.email);

      if (account.adminStatus === "active") {
        await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
        await expect(page.getByLabel("Current admin context").getByText(formatRole(account.role), { exact: true })).toBeVisible();
      } else {
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
        await expect(page.getByText("Dashboard", { exact: true }).first()).toBeVisible();
        await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
        await expect(page).toHaveURL(/\/admin\/access-denied|\/sign-in/);
      }

      const direct = await getDirectApiStatuses(request, account.email);
      const expected = ROLE_EXPECTATIONS[account.role];
      for (const [route, status] of Object.entries(expected)) {
        expect(direct[route], `${account.role} ${route}`).toBe(status);
      }
    });
  }

  test("super admin dashboard values match direct aggregate truth and hide private payload fields", async ({ page, request }) => {
    const token = await getAccessToken("uat.superadmin@local.test");
    const response = await request.get(`${BASE_URL}/api/internal/admin/dashboard-summary`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    const json = await response.json();
    const metrics = Object.fromEntries(json.summary.metrics.map((metric: { key: string; value: number | null; available: boolean }) => [metric.key, metric]));
    const expected = await computeExpectedMetrics(adminClient);

    for (const key of ["totalUsers", "usersWithoutWill", "staleWills", "oldDocuments", "usersWithoutExecutor", "pendingInvitations", "failedEmails", "pendingProbateReviews"]) {
      expect(metrics[key]?.available, key).toBe(true);
      expect(metrics[key]?.value, key).toBe(expected[key as keyof typeof expected]);
    }

    await signInViaBrowser(page, "uat.superadmin@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
    for (const [key, label] of Object.entries(ADMIN_METRIC_LABELS)) {
      const card = page.getByRole("article").filter({ hasText: label });
      await expect(card.getByRole("heading", { name: label })).toBeVisible();
      await expect(card.getByText(expected[key as keyof typeof expected].toLocaleString(), { exact: true })).toBeVisible();
    }

    expect(JSON.stringify(json)).not.toMatch(/password|service_role|storage_path|signedUrl|account_number|policy_number/i);
    expect(metrics.activeVaults?.available).toBe(false);
    expect(metrics.incompleteVaults?.available).toBe(false);
  });

  test("revoking an active admin blocks the stale browser session and direct APIs", async ({ page, request }) => {
    const supportUserId = userIds.get("uat.support@local.test");
    expect(supportUserId).toBeTruthy();

    await signInViaBrowser(page, "uat.support@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();

    const revoke = await adminClient
      .from("admin_users")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("email_normalized", "uat.support@local.test");
    if (revoke.error) throw revoke.error;

    try {
      await page.reload({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/admin\/access-denied|\/sign-in/);

      const token = await getAccessToken("uat.support@local.test");
      const response = await request.get(`${BASE_URL}/api/internal/admin/dashboard-summary`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(403);
      expect(await response.text()).not.toMatch(/service_role|password|storage_path|signedUrl/i);
    } finally {
      const restore = await adminClient
        .from("admin_users")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("email_normalized", "uat.support@local.test");
      if (restore.error) throw restore.error;
    }
  });

  test("local role harness is visible only to super admin and changes API capability", async ({ page, request }) => {
    const auditStartedAt = new Date().toISOString();
    await signInViaBrowser(page, "uat.superadmin@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByLabel("Local UAT role testing")).toBeVisible();

    await page.getByLabel("Test role").selectOption("support_agent");
    await page.getByRole("button", { name: "Apply role" }).click();
    await expect(page.getByText("Support Agent")).toBeVisible();
    await expect(page.getByText("Local UAT role testing")).toHaveCount(0);

    const supportApi = await request.get(`${BASE_URL}/api/internal/admin/verifications`, {
      headers: { cookie: await cookieHeader(page), authorization: `Bearer ${await getAccessToken("uat.superadmin@local.test")}` },
    });
    expect(supportApi.status()).toBe(403);

    const audit = await adminClient
      .from("audit_events")
      .select("id, action, actor_email_normalized, actor_role, route, policy_decision")
      .eq("actor_email_normalized", "uat.superadmin@local.test")
      .eq("action", "Local admin role override started")
      .gte("created_at", auditStartedAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (audit.error) throw audit.error;
    expect(audit.data?.actor_role).toBe("super_admin");
    expect(audit.data?.route).toBe("/api/internal/admin/local-role-override");
    expect(audit.data?.policy_decision).toBe("allowed");

    await page.goto(`${BASE_URL}/admin/access-denied`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("mobile viewport preserves admin access and standard-user denial", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await signInViaBrowser(page, "uat.auditor@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
    await expect(page.getByLabel("Current admin context").getByText("Auditor", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Apply role/i })).toHaveCount(0);

    await signInViaBrowser(page, "uat.standard@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/access-denied|\/sign-in/);
  });

  test("invalid admin role fails closed at the database and server boundary", async () => {
    const invalidUserId = userIds.get("uat.invalidrole@local.test");
    expect(invalidUserId).toBeTruthy();
    const insert = await adminClient.from("admin_users").upsert({
      email_normalized: "uat.invalidrole@local.test",
      user_id: invalidUserId,
      display_name: "UAT Invalid Role",
      status: "active",
      is_master: false,
      role: "not_a_real_role",
      updated_at: new Date().toISOString(),
    }, { onConflict: "email_normalized" });
    expect(insert.error?.message ?? "").toMatch(/admin_users_role_check|violates check constraint/i);
  });
});

async function createAccounts(client: SupabaseClient, map: Map<string, string>) {
  const list = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;

  for (const account of ACCOUNTS) {
    const existing = list.data.users.find((user) => user.email?.toLowerCase() === account.email);
    const userRes = existing
      ? await client.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true, user_metadata: { uat_role_matrix: true } })
      : await client.auth.admin.createUser({ email: account.email, password: PASSWORD, email_confirm: true, user_metadata: { uat_role_matrix: true } });
    if (userRes.error || !userRes.data.user) throw userRes.error ?? new Error(`Could not create ${account.email}`);
    map.set(account.email, userRes.data.user.id);

    await ensureProfile(client, userRes.data.user.id, account.displayName);
    await ensureOnboardingComplete(client, userRes.data.user.id);

    if (account.adminRole) {
      const adminRes = await client.from("admin_users").upsert({
        email_normalized: account.email,
        user_id: userRes.data.user.id,
        display_name: account.displayName,
        status: account.adminStatus ?? "active",
        is_master: account.role === "super_admin",
        role: account.adminRole,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email_normalized" });
      if (adminRes.error) throw adminRes.error;
    } else {
      await client.from("admin_users").delete().eq("email_normalized", account.email);
    }
  }
}

async function ensureProfile(client: SupabaseClient, userId: string, displayName: string) {
  const existing = await client.from("user_profiles").select("id").eq("user_id", userId).limit(1).maybeSingle();
  if (existing.data?.id) {
    await client.from("user_profiles").update({ display_name: displayName, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
    return;
  }
  const profileRes = await client.from("user_profiles").insert({
    user_id: userId,
    display_name: displayName,
    first_name: displayName.split(" ")[1] ?? "UAT",
    last_name: displayName.split(" ").at(-1) ?? "User",
  });
  if (profileRes.error) throw profileRes.error;
}

async function ensureOnboardingComplete(client: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const completedSteps = ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"];
  const onboarding = await client.from("user_onboarding_state").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const onboardingPayload = {
    user_id: userId,
    current_step: "complete",
    completed_steps: completedSteps,
    is_completed: true,
    terms_accepted: true,
    marketing_opt_in: false,
    tour_opt_in: false,
    updated_at: now,
  };
  const onboardingRes = onboarding.data?.id
    ? await client.from("user_onboarding_state").update(onboardingPayload).eq("id", onboarding.data.id)
    : await client.from("user_onboarding_state").insert({ ...onboardingPayload, created_at: now });
  if (onboardingRes.error) throw onboardingRes.error;

  const terms = await client.from("terms_acceptances").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const termsPayload = {
    user_id: userId,
    terms_version: "local-role-matrix-uat",
    accepted: true,
    accepted_at: now,
    source: "admin-role-matrix-local-proof",
    updated_at: now,
  };
  const termsRes = terms.data?.id
    ? await client.from("terms_acceptances").update(termsPayload).eq("id", terms.data.id)
    : await client.from("terms_acceptances").insert({ ...termsPayload, created_at: now });
  if (termsRes.error) throw termsRes.error;
}

async function seedDashboardFixture(client: SupabaseClient, map: Map<string, string>) {
  const ownerId = map.get("uat.standard@local.test") ?? [...map.values()][0];
  const probateId = map.get("uat.probate@local.test") ?? ownerId;
  if (!ownerId) throw new Error("Missing local fixture owner.");

  await client.from("probate_cases").delete().like("applicant_status_message", `${FIXTURE_LABEL}%`);
  await client.from("contact_invitations").delete().like("contact_name", `${FIXTURE_LABEL}%`);
  await client.from("contacts").delete().like("full_name", `${FIXTURE_LABEL}%`);
  await client.from("documents").delete().like("file_name", `${FIXTURE_LABEL}%`);
  await client.from("assets").delete().like("title", `${FIXTURE_LABEL}%`);

  const orgWallet = await ensureOrgWallet(client, ownerId);
  const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 6).toISOString();
  const currentWill = await client.from("assets").insert({
    organisation_id: orgWallet.organisationId,
    wallet_id: orgWallet.walletId,
    owner_user_id: ownerId,
    section_key: "legal",
    category_key: "wills",
    title: `${FIXTURE_LABEL} current will`,
    provider_name: "Local UAT Solicitors",
    summary: "Synthetic will fixture",
    value_minor: 0,
    currency_code: "GBP",
    visibility: "private",
    status: "active",
    metadata_json: { uat: true },
  }).select("id").single();
  if (currentWill.error || !currentWill.data) throw currentWill.error ?? new Error("Missing will asset.");

  const staleWill = await client.from("assets").insert({
    organisation_id: orgWallet.organisationId,
    wallet_id: orgWallet.walletId,
    owner_user_id: ownerId,
    section_key: "legal",
    category_key: "wills",
    title: `${FIXTURE_LABEL} stale will`,
    provider_name: "Local UAT Solicitors",
    summary: "Synthetic stale will fixture",
    value_minor: 0,
    currency_code: "GBP",
    visibility: "private",
    status: "active",
    metadata_json: { uat: true },
    updated_at: staleDate,
  }).select("id").single();
  if (staleWill.error || !staleWill.data) throw staleWill.error ?? new Error("Missing stale will asset.");

  const documentRes = await client.from("documents").insert({
    organisation_id: orgWallet.organisationId,
    wallet_id: orgWallet.walletId,
    asset_id: currentWill.data.id,
    owner_user_id: ownerId,
    storage_bucket: "documents",
    storage_path: `uat/admin-role-matrix/${Date.now()}.pdf`,
    file_name: `${FIXTURE_LABEL} old-document.pdf`,
    mime_type: "application/pdf",
    size_bytes: 128,
    document_kind: "document",
    document_type: "uat",
    updated_at: staleDate,
  });
  if (documentRes.error) throw documentRes.error;

  const contactRes = await client.from("contacts").insert({
    owner_user_id: ownerId,
    full_name: `${FIXTURE_LABEL} Executor`,
    email: `uat.executor.${FIXTURE_ID}@local.test`,
    email_normalized: `uat.executor.${FIXTURE_ID}@local.test`,
    relationship: "executor",
    contact_role: "executor",
    linked_context: { uat: true },
    invite_status: "invite_sent",
    verification_status: "invited",
    source_type: "manual",
  }).select("id").single();
  if (contactRes.error || !contactRes.data) throw contactRes.error ?? new Error("Missing contact.");

  const invitationRes = await client.from("contact_invitations").insert({
    owner_user_id: ownerId,
    contact_id: contactRes.data.id,
    contact_name: `${FIXTURE_LABEL} Invitee`,
    contact_email: `uat.invitee.${FIXTURE_ID}@local.test`,
    assigned_role: "executor",
    invitation_status: "pending",
    sent_at: new Date().toISOString(),
  }).select("id").single();
  if (invitationRes.error || !invitationRes.data) throw invitationRes.error ?? new Error("Missing invitation.");

  const eventRes = await client.from("invitation_events").insert({
    owner_user_id: ownerId,
    invitation_id: invitationRes.data.id,
    event_type: "delivery_failed",
    payload: { uat: true, label: FIXTURE_LABEL },
  });
  if (eventRes.error) throw eventRes.error;

  const probateRes = await client.from("probate_cases").insert({
    owner_user_id: ownerId,
    applicant_user_id: probateId,
    contact_id: contactRes.data.id,
    contact_invitation_id: invitationRes.data.id,
    case_type: "probate_access",
    status: "under_review",
    assigned_reviewer_user_id: probateId,
    required_evidence: ["death_certificate"],
    applicant_status_message: `${FIXTURE_LABEL} probate case under review`,
  });
  if (probateRes.error) throw probateRes.error;
}

async function ensureOrgWallet(client: SupabaseClient, ownerUserId: string) {
  const org = await client.from("organisations").select("id").eq("owner_user_id", ownerUserId).limit(1).maybeSingle();
  let organisationId = org.data?.id;
  if (!organisationId) {
    const insertOrg = await client.from("organisations").insert({ owner_user_id: ownerUserId, name: "UAT Role Matrix Organisation" }).select("id").single();
    if (insertOrg.error || !insertOrg.data) throw insertOrg.error ?? new Error("Missing organisation.");
    organisationId = insertOrg.data.id;
  }
  const wallet = await client.from("wallets").select("id").eq("owner_user_id", ownerUserId).eq("organisation_id", organisationId).limit(1).maybeSingle();
  let walletId = wallet.data?.id;
  if (!walletId) {
    const insertWallet = await client.from("wallets").insert({ owner_user_id: ownerUserId, organisation_id: organisationId, label: "UAT Role Matrix Wallet" }).select("id").single();
    if (insertWallet.error || !insertWallet.data) throw insertWallet.error ?? new Error("Missing wallet.");
    walletId = insertWallet.data.id;
  }
  return { organisationId, walletId };
}

async function signInViaBrowser(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/sign-in?next=${encodeURIComponent("/admin")}`, { waitUntil: "networkidle" });
  await page.getByLabel(/Email/i).fill(email);
  await page.getByRole("textbox", { name: /Password/i }).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL(/\/(admin|dashboard|onboarding|profile|account\/terms)/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function getAccessToken(email: string) {
  const client = createClient(LOCAL_SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const res = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (res.error || !res.data.session) throw res.error ?? new Error(`No session for ${email}`);
  return res.data.session.access_token;
}

async function getDirectApiStatuses(request: APIRequestContext, email: string) {
  const token = await getAccessToken(email);
  const statuses: Record<string, number> = {};
  for (const route of ADMIN_ROUTES) {
    const key = route.path.split("/").at(-1) ?? route.path;
    const response = route.method === "POST"
      ? await request.post(`${BASE_URL}${route.path}`, {
        headers: { authorization: `Bearer ${token}` },
        data: route.body,
      })
      : await request.get(`${BASE_URL}${route.path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
    statuses[key] = response.status();
    const text = await response.text();
    expect(text).not.toMatch(/service_role|password|storage_path|signedUrl/i);
  }
  return statuses;
}

async function computeExpectedMetrics(client: SupabaseClient) {
  const users = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const visibleUsers = users.data.users.filter((user) => {
    const email = String(user.email ?? "").toLowerCase();
    return !email.includes("service") && !email.includes("system");
  });
  const userIds = visibleUsers.map((user) => user.id);

  const assets = await client.from("assets").select("owner_user_id, updated_at").eq("section_key", "legal").eq("category_key", "wills").neq("status", "archived");
  if (assets.error) throw assets.error;
  const ownersWithWill = new Set((assets.data ?? []).map((row) => row.owner_user_id));
  const staleThreshold = Date.now() - 1000 * 60 * 60 * 24 * 365 * 5;

  const documents = await client.from("documents").select("id, updated_at").lt("updated_at", new Date(staleThreshold).toISOString());
  if (documents.error) throw documents.error;
  const contacts = await client.from("contacts").select("owner_user_id").in("relationship", ["executor", "Executor"]);
  if (contacts.error) throw contacts.error;
  const ownersWithExecutor = new Set((contacts.data ?? []).map((row) => row.owner_user_id));
  const invitations = await client.from("contact_invitations").select("id", { count: "exact", head: true }).in("invitation_status", ["pending"]);
  if (invitations.error) throw invitations.error;
  const failedEmails = await client.from("invitation_events").select("id", { count: "exact", head: true }).in("event_type", ["failed", "bounced", "delivery_failed"]);
  if (failedEmails.error) throw failedEmails.error;
  const probate = await client.from("probate_cases").select("id", { count: "exact", head: true }).in("status", ["submitted", "needs_information", "under_review"]);
  if (probate.error) throw probate.error;

  return {
    totalUsers: visibleUsers.length,
    usersWithoutWill: userIds.filter((id) => !ownersWithWill.has(id)).length,
    staleWills: (assets.data ?? []).filter((row) => new Date(row.updated_at).getTime() < staleThreshold).length,
    oldDocuments: documents.data?.length ?? 0,
    usersWithoutExecutor: userIds.filter((id) => !ownersWithExecutor.has(id)).length,
    pendingInvitations: invitations.count ?? 0,
    failedEmails: failedEmails.count ?? 0,
    pendingProbateReviews: probate.count ?? 0,
  };
}

async function cookieHeader(page: Page) {
  const cookies = await page.context().cookies(BASE_URL);
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function formatRole(role: string) {
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
