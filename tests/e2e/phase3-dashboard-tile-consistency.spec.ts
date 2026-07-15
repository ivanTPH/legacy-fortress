import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3012";
const EMAIL = "phase3-dashboard-empty-owner@legacyfortress.test";
const PASSWORD = `Phase3Dashboard-${Date.now()}-Aa1!`;

test.describe.serial("Phase 3 customer dashboard tile consistency", () => {
  let adminClient: SupabaseClient;

  test.beforeAll(async () => {
    test.skip(!LOCAL_SUPABASE_URL.includes("127.0.0.1") && !LOCAL_SUPABASE_URL.includes("localhost"), "Local Supabase env is required.");
    test.skip(!ANON_KEY || !SERVICE_KEY, "Local anon and service-role keys are required.");
    adminClient = createClient(LOCAL_SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await prepareEmptyOwner(adminClient);
  });

  test("empty finance dashboard tiles show a single Add record action and open the add form", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/finances`, { waitUntil: "networkidle" });
    await expect(page.getByRole("banner").getByText("All finances")).toBeVisible();
    await expect(page.getByRole("link", { name: /Pensions summary/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add record" }).first()).toBeVisible();

    await page.getByRole("link", { name: "Add record" }).first().click();
    await expect(page).toHaveURL(/\/finances\/(pensions|bank|investments|insurance|debts)\?add=1/);
    await expect(page.getByRole("heading", { name: /Add new record/i })).toBeVisible();
  });

  test("empty finance dashboard remains usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto(`${BASE_URL}/finances`, { waitUntil: "networkidle" });
    await expect(page.getByRole("banner").getByText("All finances")).toBeVisible();
    await expect(page.getByRole("link", { name: /Pensions summary/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add record" }).first()).toBeVisible();
  });
});

async function prepareEmptyOwner(client: SupabaseClient) {
  const list = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((user) => user.email?.toLowerCase() === EMAIL);
  const userRes = existing
    ? await client.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true, user_metadata: { phase3_dashboard_tiles: true } })
    : await client.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { phase3_dashboard_tiles: true } });
  if (userRes.error || !userRes.data.user) throw userRes.error ?? new Error(`Could not prepare ${EMAIL}`);

  await client.from("admin_users").delete().eq("email_normalized", EMAIL);
  await ensureProfile(client, userRes.data.user.id);
  await ensureOnboardingComplete(client, userRes.data.user.id);
  await ensureTermsAccepted(client, userRes.data.user.id);
}

async function ensureProfile(client: SupabaseClient, userId: string) {
  const existing = await client.from("user_profiles").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const payload = {
    user_id: userId,
    display_name: "Phase 3 Empty Owner",
    first_name: "Phase",
    last_name: "Owner",
    updated_at: new Date().toISOString(),
  };
  const result = existing.data?.id
    ? await client.from("user_profiles").update(payload).eq("id", existing.data.id)
    : await client.from("user_profiles").insert(payload);
  if (result.error) throw result.error;
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

async function ensureTermsAccepted(client: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const existing = await client.from("terms_acceptances").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const payload = {
    user_id: userId,
    terms_version: "phase3-dashboard-tile-consistency",
    accepted: true,
    accepted_at: now,
    source: "phase3-dashboard-tile-consistency",
    updated_at: now,
  };
  const result = existing.data?.id
    ? await client.from("terms_acceptances").update(payload).eq("id", existing.data.id)
    : await client.from("terms_acceptances").insert({ ...payload, created_at: now });
  if (result.error) throw result.error;
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/sign-in?next=${encodeURIComponent("/finances")}`, { waitUntil: "networkidle" });
  await page.getByLabel(/Email/i).fill(EMAIL);
  await page.getByRole("textbox", { name: /Password/i }).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL(/\/finances|\/dashboard/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}
