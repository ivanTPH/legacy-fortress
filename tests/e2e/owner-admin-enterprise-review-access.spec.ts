import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3012";
const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = `OwnerReview-${Date.now()}-Aa1!`;

const REVIEW_ACCOUNTS = [
  { email: "phase4c.owner.superadmin@local.test", role: "super_admin", displayName: "Phase 4C Owner Super Admin" },
  { email: "phase4c.owner.support@local.test", role: "support_agent", displayName: "Phase 4C Support Agent" },
  { email: "phase4c.owner.probate@local.test", role: "probate_reviewer", displayName: "Phase 4C Probate Reviewer" },
  { email: "phase4c.owner.auditor@local.test", role: "auditor", displayName: "Phase 4C Auditor" },
  { email: "phase4c.owner.enterprise@local.test", role: "organisation_admin", displayName: "Phase 4C Enterprise Admin" },
  { email: "phase4c.owner.customer@local.test", role: null, displayName: "Phase 4C Standard Customer" },
];

test.describe.serial("owner admin and enterprise review access", () => {
  let adminClient: SupabaseClient;

  test.beforeAll(async () => {
    test.skip(!LOCAL_SUPABASE_URL.includes("127.0.0.1") && !LOCAL_SUPABASE_URL.includes("localhost"), "Local Supabase env is required.");
    test.skip(!ANON_KEY || !SERVICE_KEY, "Local anon and service-role keys are required.");
    adminClient = createClient(LOCAL_SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await prepareReviewAccounts(adminClient);
  });

  test("standard customer is denied from internal admin route", async ({ page }) => {
    await signIn(page, "phase4c.owner.customer@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/access-denied|\/sign-in/, { timeout: 30_000 });
    await expect(page.getByText(/Access not available|Sign in/i)).toBeVisible();
  });

  test("super admin can review application-control dashboard and safe placeholders", async ({ page }) => {
    await signIn(page, "phase4c.owner.superadmin@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
    await expect(page.getByLabel("Current admin context").getByText("Super Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Total users" })).toBeVisible();
    await expect(page.getByText("Customer vault contents, documents, notes and private record details are not shown here.")).toBeVisible();
    await expect(page.getByLabel("Local UAT role testing")).toBeVisible();
    await expect(page.getByText(/Enterprise and licences/i)).toBeVisible();
    await expect(page.getByText(/Future phase/i)).toHaveCount(4);
  });

  test("role-specific owner review surfaces remain limited", async ({ page }) => {
    await signIn(page, "phase4c.owner.support@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
    await expect(page.getByLabel("Current admin context").getByText("Support Agent", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Local UAT role testing")).toHaveCount(0);

    await signIn(page, "phase4c.owner.probate@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByLabel("Current admin context").getByText("Probate Reviewer", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Pending probate/death-certificate reviews" })).toBeVisible();

    await signIn(page, "phase4c.owner.auditor@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByLabel("Current admin context").getByText("Auditor", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Apply role/i })).toHaveCount(0);
  });

  test("enterprise/licence foundation is labelled as unavailable rather than operational", async ({ page }) => {
    await signIn(page, "phase4c.owner.enterprise@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
    await expect(page.getByLabel("Current admin context").getByText("Enterprise Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Organisations" }).getByText("Unavailable")).toHaveCount(2);
    await expect(page.getByRole("article").filter({ hasText: "Licence seats" }).getByText("Unavailable")).toHaveCount(2);
  });

  test("internal dashboard remains usable at a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "phase4c.owner.superadmin@local.test");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Application command dashboard/i })).toBeVisible();
    await expect(page.getByText("Local UAT role testing")).toBeVisible();
  });
});

async function prepareReviewAccounts(client: SupabaseClient) {
  const list = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;

  for (const account of REVIEW_ACCOUNTS) {
    const existing = list.data.users.find((user) => user.email?.toLowerCase() === account.email);
    const userRes = existing
      ? await client.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { phase4c_owner_review: true },
      })
      : await client.auth.admin.createUser({
        email: account.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { phase4c_owner_review: true },
      });
    if (userRes.error || !userRes.data.user) throw userRes.error ?? new Error(`Could not create ${account.email}`);

    await ensureProfile(client, userRes.data.user.id, account.displayName);
    await ensureOnboardingComplete(client, userRes.data.user.id);

    if (account.role) {
      const adminRes = await client.from("admin_users").upsert({
        email_normalized: account.email,
        user_id: userRes.data.user.id,
        display_name: account.displayName,
        status: "active",
        is_master: account.role === "super_admin",
        role: account.role,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email_normalized" });
      if (adminRes.error) throw adminRes.error;
    } else {
      const deleteRes = await client.from("admin_users").delete().eq("email_normalized", account.email);
      if (deleteRes.error) throw deleteRes.error;
    }
  }
}

async function ensureProfile(client: SupabaseClient, userId: string, displayName: string) {
  const existing = await client.from("user_profiles").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const payload = {
    user_id: userId,
    display_name: displayName,
    first_name: displayName.split(" ")[2] ?? "Owner",
    last_name: displayName.split(" ").at(-1) ?? "Review",
    updated_at: new Date().toISOString(),
  };
  const res = existing.data?.id
    ? await client.from("user_profiles").update(payload).eq("id", existing.data.id)
    : await client.from("user_profiles").insert(payload);
  if (res.error) throw res.error;
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
}

async function signIn(page: Page, email: string) {
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
