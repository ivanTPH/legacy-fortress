import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EXPECTED_SHA = process.env.EXPECTED_STAGING_SHA ?? "";
const RUN_MARKER = `staging-admin-boundary-${Date.now()}`;
const PASSWORD = `StagingAdminBoundary-${Date.now()}-Aa1!`;

const requiredHostedFlag = process.env.LEGACY_FORTRESS_ALLOW_STAGING_BROWSER === "true";
const targetIsStaging = BASE_URL === "https://test.mylegacyfortress.com"
  && SUPABASE_URL === "https://supabase-test.mylegacyfortress.com";

test.describe.configure({ mode: "serial" });

let adminClient: SupabaseClient;
let organisationId = "";
const users: Array<{ id: string; email: string }> = [];

test.beforeAll(async () => {
  test.skip(!requiredHostedFlag, "Staging browser acceptance requires explicit authorization.");
  if (!targetIsStaging) throw new Error("staging_browser_target_mismatch");
  if (!/^[0-9a-f]{40}$/.test(EXPECTED_SHA)) throw new Error("staging_browser_expected_sha_missing");
  if (!ANON_KEY || !SERVICE_KEY) throw new Error("staging_browser_credentials_missing");

  const version = await fetch(`${BASE_URL}/api/version`).then((response) => response.json());
  if (version.env !== "staging" || version.commitSha !== EXPECTED_SHA) {
    throw new Error("staging_browser_version_mismatch");
  }

  adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const platform = await createUser("platform");
  const enterprise = await createUser("enterprise");
  await createUser("personal");

  const adminRow = await adminClient.from("admin_users").insert({
    email_normalized: platform.email,
    user_id: platform.id,
    display_name: "Staging Platform Admin",
    status: "active",
    is_master: false,
    role: "super_admin",
  });
  if (adminRow.error) throw adminRow.error;

  const organisation = await adminClient.from("enterprise_organisations").insert({
    legal_name: `Staging Boundary ${RUN_MARKER}`,
    trading_name: `Staging Boundary ${RUN_MARKER}`,
    organisation_type: "employer",
    status: "active",
    created_by_user_id: platform.id,
  }).select("id").single();
  if (organisation.error || !organisation.data) throw organisation.error ?? new Error("staging_browser_organisation_missing");
  organisationId = organisation.data.id;

  const membership = await adminClient.from("enterprise_memberships").insert({
    organisation_id: organisationId,
    user_id: enterprise.id,
    email_normalized: enterprise.email,
    full_name: "Staging Enterprise Admin",
    organisation_role: "organisation_admin",
    membership_status: "active",
    onboarding_status: "complete",
    consent_status: "accepted",
    synthetic_run_marker: RUN_MARKER,
    created_by_user_id: platform.id,
    updated_by_user_id: platform.id,
  });
  if (membership.error) throw membership.error;
});

test.afterAll(async () => {
  if (!adminClient) return;
  await adminClient.from("enterprise_memberships").delete().eq("synthetic_run_marker", RUN_MARKER);
  if (organisationId) await adminClient.from("enterprise_organisations").delete().eq("id", organisationId);
  for (const user of users) {
    await adminClient.from("admin_users").delete().eq("user_id", user.id);
    await adminClient.auth.admin.deleteUser(user.id);
  }
});

test("platform admin remains in admin context while using users, invitations, organisation resources and account menu", async ({ page }) => {
  await signIn(page, users[0].email, "/admin");
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Customer users" })).toBeVisible();
  await page.goto(`${BASE_URL}/admin/invitations`, { waitUntil: "networkidle" });
  await expect(page.getByText("Platform Administration").first()).toBeVisible();
  await page.goto(`${BASE_URL}/admin/organisations/${organisationId}`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(new RegExp(`/admin/organisations/${organisationId}`));
  await expect(page).not.toHaveURL(/\/enterprise/);
  await assertAccountMenu(page);
});

test("enterprise admin is organisation-scoped and cannot use platform administration", async ({ page, request }) => {
  await signIn(page, users[1].email, "/enterprise");
  await expect(page.getByText(/Enterprise Operations/i).first()).toBeVisible();
  await assertAccountMenu(page);
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admin\/access-denied|\/sign-in/);
  const response = await request.get(`${BASE_URL}/api/internal/admin/admin-users`);
  expect(response.status()).toBe(403);
});

test("personal user cannot enter administrative workspaces", async ({ page }) => {
  await signIn(page, users[2].email, "/dashboard");
  await assertAccountMenu(page);
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admin\/access-denied|\/sign-in/);
  await page.goto(`${BASE_URL}/enterprise`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/enterprise\/access-denied|\/sign-in|\/dashboard/);
});

async function createUser(role: string) {
  const email = `${RUN_MARKER}-${role}@example.test`;
  const result = await adminClient.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Staging ${role} Admin` } });
  if (result.error || !result.data.user) throw result.error ?? new Error("staging_browser_user_missing");
  users.push({ id: result.data.user.id, email });
  const profile = await adminClient.from("user_profiles").insert({ user_id: result.data.user.id, display_name: `Staging ${role === "personal" ? "Personal User" : `${role[0].toUpperCase()}${role.slice(1)} Admin`}` });
  if (profile.error) throw profile.error;
  return { id: result.data.user.id, email };
}

async function signIn(page: Page, email: string, next: string) {
  await page.context().clearCookies();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/sign-in?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByLabel(/Email/i).fill(email);
  await page.getByRole("textbox", { name: /Password/i }).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL(/\/(admin|dashboard|onboarding|app\/dashboard|app\/onboarding|profile|account\/terms)/, { timeout: 15_000 });
  if (page.url().includes("/onboarding")) {
    const terms = page.getByLabel(/i accept the terms and conditions/i);
    if (await terms.count()) {
      await terms.check();
      await page.getByRole("button", { name: /go to dashboard/i }).click();
    }
    await expect(page).toHaveURL(/\/(app\/dashboard|dashboard)/);
  }
  await page.waitForLoadState("networkidle");
}

async function assertAccountMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /Open account menu for/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Account menu" })).toHaveCount(0);
  await trigger.click();
  await page.getByRole("heading").first().click();
  await expect(page.getByRole("menu", { name: "Account menu" })).toHaveCount(0);
}
