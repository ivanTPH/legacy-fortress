import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3012";
const PASSWORD = `Phase4aDashboard-${Date.now()}-Aa1!`;
const RUN_ID = `${Date.now()}`;

const accounts = {
  empty: "phase4a-empty-customer@legacyfortress.test",
  populated: "phase4a-populated-customer@legacyfortress.test",
  mixed: "phase4a-mixed-customer@legacyfortress.test",
  isolated: "phase4a-isolation-customer@legacyfortress.test",
};

test.describe.serial("Phase 4A customer dashboard consistency", () => {
  let adminClient: SupabaseClient;
  let userIds: Record<keyof typeof accounts, string>;

  test.beforeAll(async () => {
    test.skip(!LOCAL_SUPABASE_URL.includes("127.0.0.1") && !LOCAL_SUPABASE_URL.includes("localhost"), "Local Supabase env is required.");
    test.skip(!ANON_KEY || !SERVICE_KEY, "Local anon and service-role keys are required.");
    adminClient = createClient(LOCAL_SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    userIds = await preparePhase4aCustomers(adminClient);
  });

  test("empty customer sees add actions without private snippets", async ({ page }) => {
    await signIn(page, accounts.empty);
    await page.goto(`${BASE_URL}/property`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Property Records summary/i })).toContainText("Add record");
    await expect(page.getByText(/phase4a-private/i)).toHaveCount(0);

    await page.goto(`${BASE_URL}/vault/digital`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Social media summary/i })).toContainText("Add record");
    await expect(page.getByText(/storage_path|account number|contact email/i)).toHaveCount(0);
  });

  test("populated customer sees canonical counts on selected dashboards after refresh", async ({ page }) => {
    await signIn(page, accounts.populated);

    await page.goto(`${BASE_URL}/property`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Property Records summary/i })).toContainText("1 active record");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Property Records summary/i })).toContainText("1 active record");

    await page.goto(`${BASE_URL}/business`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Business Interests summary/i })).toContainText("1 active record");

    await page.goto(`${BASE_URL}/vault/digital`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Social media summary/i })).toContainText("1 active record");
    await expect(page.getByRole("link", { name: /Subscriptions summary/i })).toContainText("1 active record");

    await page.goto(`${BASE_URL}/vault/personal`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Watches & jewellery summary/i })).toContainText("1 active record");
    await expect(page.getByRole("link", { name: /Art & paintings summary/i })).toContainText("1 active record");
  });

  test("mixed customer shows independent empty and populated states", async ({ page }) => {
    await signIn(page, accounts.mixed);
    await page.goto(`${BASE_URL}/property`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Property Records summary/i })).toContainText("Add record");

    await page.goto(`${BASE_URL}/business`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Business Interests summary/i })).toContainText("1 active record");

    await page.goto(`${BASE_URL}/vault/personal`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Collections summary/i })).toContainText("1 active record");
    await expect(page.getByRole("link", { name: /Watches & jewellery summary/i })).toContainText("Add record");
  });

  test("owner isolation prevents unrelated local customer records appearing", async ({ page }) => {
    await signIn(page, accounts.empty);
    await page.goto(`${BASE_URL}/business`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Business Interests summary/i })).toContainText("Add record");
    await expect(page.getByText(new RegExp(userIds.populated, "i"))).toHaveCount(0);
    await expect(page.getByText(/Phase4A Populated/i)).toHaveCount(0);
  });

  test("selected dashboard add CTA navigates to canonical add form", async ({ page }) => {
    await signIn(page, accounts.empty);
    await page.goto(`${BASE_URL}/property`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Property Records summary/i }).click();
    await expect(page).toHaveURL(/\/vault\/property\?add=1/);
    await expect(page.getByRole("heading", { name: /Add new record/i })).toBeVisible();
  });

  test("canonical UI create is retrieved by dashboard", async ({ page }) => {
    await signIn(page, accounts.isolated);
    await page.goto(`${BASE_URL}/vault/digital/records?add=1&digitalType=social_media`, { waitUntil: "networkidle" });
    await fillIfVisible(page, /Asset name/i, `Phase4A Social ${RUN_ID}`);
    await fillIfVisible(page, /Platform \/ Provider/i, "Phase4A Social Platform");
    await selectIfVisible(page, /Jurisdiction/i, "United Kingdom");
    await selectIfVisible(page, /Status/i, "Active");
    await page.getByRole("button", { name: /Save digital asset/i }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`${BASE_URL}/vault/digital`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Social media summary/i })).toContainText("1 active record");
  });

  test("mobile selected dashboards keep CTA and counts visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, accounts.populated);
    for (const route of ["/property", "/business", "/vault/digital", "/vault/personal"]) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
      await expect(page.locator(".lf-dashboard-summary-card").first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Hydration failed");
    }
  });
});

async function preparePhase4aCustomers(client: SupabaseClient) {
  const result: Record<keyof typeof accounts, string> = {
    empty: "",
    populated: "",
    mixed: "",
    isolated: "",
  };

  for (const [key, email] of Object.entries(accounts) as Array<[keyof typeof accounts, string]>) {
    const user = await upsertConfirmedUser(client, email);
    result[key] = user.id;
    await ensureProfile(client, user.id, `Phase4A ${key}`);
    await ensureOnboardingComplete(client, user.id);
    await ensureTermsAccepted(client, user.id);
    await clearPhase4aAssets(client, user.id);
  }

  await seedCanonicalAssetSet(client, result.populated, [
    { section_key: "property", category_key: "property", title: "Phase4A Populated Property", metadata_json: { phase4a_marker: RUN_ID }, value_minor: 25000000 },
    { section_key: "business", category_key: "business", title: "Phase4A Populated Business", metadata_json: { phase4a_marker: RUN_ID }, value_minor: 5000000 },
    { section_key: "digital", category_key: "digital", title: "Phase4A Social", metadata_json: { phase4a_marker: RUN_ID, digital_asset_type: "social_media" } },
    { section_key: "digital", category_key: "digital", title: "Phase4A Subscription", metadata_json: { phase4a_marker: RUN_ID, digital_asset_type: "subscription" } },
    { section_key: "personal", category_key: "possessions", title: "Phase4A Watch", metadata_json: { phase4a_marker: RUN_ID, category: "watches" }, value_minor: 100000 },
    { section_key: "personal", category_key: "possessions", title: "Phase4A Painting", metadata_json: { phase4a_marker: RUN_ID, category: "art", subtype: "painting" }, value_minor: 200000 },
  ]);

  await seedCanonicalAssetSet(client, result.mixed, [
    { section_key: "business", category_key: "business", title: "Phase4A Mixed Business", metadata_json: { phase4a_marker: RUN_ID }, value_minor: 3000000 },
    { section_key: "personal", category_key: "possessions", title: "Phase4A Collection", metadata_json: { phase4a_marker: RUN_ID, category: "collectibles" }, value_minor: 50000 },
  ]);

  return result;
}

async function upsertConfirmedUser(client: SupabaseClient, email: string) {
  const list = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  const res = existing
    ? await client.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true, user_metadata: { phase4a: true } })
    : await client.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { phase4a: true } });
  if (res.error || !res.data.user) throw res.error ?? new Error(`Could not prepare ${email}`);
  return res.data.user;
}

async function ensureProfile(client: SupabaseClient, userId: string, label: string) {
  const existing = await client.from("user_profiles").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const payload = {
    user_id: userId,
    display_name: label,
    first_name: "Phase4A",
    last_name: label,
    updated_at: new Date().toISOString(),
  };
  const res = existing.data?.id
    ? await client.from("user_profiles").update(payload).eq("id", existing.data.id)
    : await client.from("user_profiles").insert(payload);
  if (res.error) throw res.error;
}

async function ensureOnboardingComplete(client: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    current_step: "complete",
    completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"],
    is_completed: true,
    terms_accepted: true,
    marketing_opt_in: false,
    tour_opt_in: false,
    updated_at: now,
  };
  const existing = await client.from("user_onboarding_state").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const res = existing.data?.id
    ? await client.from("user_onboarding_state").update(payload).eq("id", existing.data.id)
    : await client.from("user_onboarding_state").insert({ ...payload, created_at: now });
  if (res.error) throw res.error;
}

async function ensureTermsAccepted(client: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    terms_version: "phase4a-dashboard-consistency",
    accepted: true,
    accepted_at: now,
    source: "phase4a-dashboard-consistency",
    updated_at: now,
  };
  const existing = await client.from("terms_acceptances").select("id").eq("user_id", userId).limit(1).maybeSingle();
  const res = existing.data?.id
    ? await client.from("terms_acceptances").update(payload).eq("id", existing.data.id)
    : await client.from("terms_acceptances").insert({ ...payload, created_at: now });
  if (res.error) throw res.error;
}

async function clearPhase4aAssets(client: SupabaseClient, userId: string) {
  const existing = await client.from("assets").select("id").eq("owner_user_id", userId);
  if (existing.error) throw existing.error;
  const ids = (existing.data ?? [])
    .filter((row) => String((row as { id: string }).id ?? ""))
    .map((row) => (row as { id: string }).id);
  if (!ids.length) return;
  const res = await client.from("assets").delete().in("id", ids);
  if (res.error) throw res.error;
}

async function seedCanonicalAssetSet(
  client: SupabaseClient,
  userId: string,
  rows: Array<{
    section_key: string;
    category_key: string;
    title: string;
    metadata_json: Record<string, unknown>;
    value_minor?: number;
  }>,
) {
  const wallet = await ensureOrgWallet(client, userId);
  const now = new Date().toISOString();
  const res = await client.from("assets").insert(rows.map((row) => ({
    organisation_id: wallet.organisationId,
    wallet_id: wallet.walletId,
    owner_user_id: userId,
    section_key: row.section_key,
    category_key: row.category_key,
    title: row.title,
    provider_name: row.title,
    summary: "Phase 4A local synthetic record",
    value_minor: row.value_minor ?? 0,
    currency_code: "GBP",
    visibility: "private",
    status: "active",
    metadata_json: row.metadata_json,
    created_at: now,
    updated_at: now,
  })));
  if (res.error) throw res.error;
}

async function ensureOrgWallet(client: SupabaseClient, ownerUserId: string) {
  const existingOrg = await client.from("organisations").select("id").eq("owner_user_id", ownerUserId).limit(1).maybeSingle();
  let organisationId = existingOrg.data?.id as string | undefined;
  if (!organisationId) {
    const org = await client.from("organisations").insert({
      owner_user_id: ownerUserId,
      name: `Phase4A Local Org ${ownerUserId.slice(0, 8)}`,
    }).select("id").single();
    if (org.error || !org.data) throw org.error ?? new Error("Could not create organisation");
    organisationId = org.data.id;
  }

  const existingWallet = await client.from("wallets").select("id").eq("owner_user_id", ownerUserId).eq("organisation_id", organisationId).limit(1).maybeSingle();
  if (existingWallet.data?.id) return { organisationId, walletId: existingWallet.data.id as string };

  const wallet = await client.from("wallets").insert({
    owner_user_id: ownerUserId,
    organisation_id: organisationId,
    label: "Phase4A Local Wallet",
    status: "active",
  }).select("id").single();
  if (wallet.error || !wallet.data) throw wallet.error ?? new Error("Could not create wallet");
  return { organisationId, walletId: wallet.data.id as string };
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/sign-in?next=${encodeURIComponent("/dashboard")}`, { waitUntil: "networkidle" });
  await page.getByLabel(/Email/i).fill(email);
  await page.getByRole("textbox", { name: /Password/i }).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL(/\/dashboard|\/app\/onboarding/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function fillIfVisible(page: Page, label: RegExp, value: string) {
  const input = page.getByLabel(label).first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(value);
}

async function selectIfVisible(page: Page, label: RegExp, value: string) {
  const input = page.getByLabel(label).first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.selectOption({ label: value }).catch(async () => {
    await input.selectOption(value);
  });
}
