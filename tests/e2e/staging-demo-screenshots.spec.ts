import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Website screenshots from a synthetic demo account on TEST (owner approved 3 Nov 2026).
 * Uses one fixed synthetic "Bill Smith" account (TEST keeps accounts that have audit history), refreshes its
 * synthetic review data, and photographs the main screens on desktop and phone. The TEST banner is hidden in
 * these photos only. Images are printed to the log as JPEG base64 (artifact downloads aren't reachable).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL = "staging-demo-shots@example.test";
const PASSWORD = `StagingDemoShots-${Date.now()}-Aa1!`;
const OUT = "test-results/demo-shots";
const PAGES_ALL = ["/dashboard", "/finances", "/finances/bank", "/property", "/legal", "/legal/wills", "/personal", "/contacts", "/people-access", "/people-access?view=vault-access", "/people-access?view=sharing", "/access-sharing", "/account/billing",
  // UX review (10 Nov 2026): the rest of the everyday screens.
  "/business", "/vault/digital", "/vault/personal", "/notifications", "/action-centre", "/settings", "/settings/security", "/settings/my-vault", "/support", "/profile", "/add"]; // /onboarding has its own guided set-up test below
// Tour video (owner request 7 Nov 2026): the same steps with a record opened, so the film can zoom in on it.
const PAGES = PAGES_ALL;
const OPENED_ALL = ["/finances/bank", "/legal/wills", "/contacts"];

const allowed = process.env.LEGACY_FORTRESS_ALLOW_STAGING_BROWSER === "true";
const targetIsStaging = BASE_URL === "https://test.mylegacyfortress.com" && SUPABASE_URL === "https://supabase-test.mylegacyfortress.com";

test.describe.configure({ mode: "serial" });
let admin: SupabaseClient;
let userId = "";

test.beforeAll(async () => {
  test.skip(!allowed, "Staging screenshots require explicit authorization.");
  if (!targetIsStaging) throw new Error("staging_target_mismatch");
  if (!ANON_KEY || !SERVICE_KEY) throw new Error("staging_credentials_missing");
  admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = await findUser(EMAIL);
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing, { password: PASSWORD });
    if (updated.error) throw updated.error;
    userId = existing;
  } else {
    const created = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Bill Smith" } });
    if (created.error || !created.data.user) throw created.error ?? new Error("demo_user_missing");
    userId = created.data.user.id;
  }
  const now = new Date().toISOString();
  for (const [table, row, conflict] of [
    ["user_onboarding_state", { user_id: userId, current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"], is_completed: true, terms_accepted: true, marketing_opt_in: false, tour_opt_in: false }, "user_id"],
    ["terms_acceptances", { user_id: userId, terms_version: "legacy-fortress-2026-03", accepted: true, accepted_at: now, source: "staging_demo_screenshots" }, "user_id"],
    ["identity_assurance_states", { user_id: userId, identity_level: 2, provider_key: "staging_synthetic", provider_assurance_class: "level_2_synthetic", verified_at: now }, "user_id"],
  ] as const) {
    const result = await admin.from(table).upsert(row, { onConflict: conflict });
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
  }
  // The existing synthetic review data set (accounts, property, will, LPA, pension, insurance, business, people).
  execFileSync("node", ["scripts/seed-bill-smith-review-account.mjs"], { stdio: "inherit", env: { ...process.env, SEED_TARGET_EMAIL: EMAIL } });
  fs.mkdirSync(OUT, { recursive: true });
});

const OPENED = OPENED_ALL;

async function findUser(email: string) {
  for (let page = 1; page < 50; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (result.data.users.length < 200) return null;
  }
  return null;
}

/** New-device check (4 Nov 2026): mark this synthetic password session trusted, as "Remember this device" does. */
async function trustSession(client: SupabaseClient, accessToken: string) {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: string; sub?: string };
    if (!claims.session_id || !claims.sub) return;
    await client.from("trusted_sessions").upsert({ session_id: claims.session_id, user_id: claims.sub, method: "remembered_device" }, { onConflict: "session_id" });
  } catch { /* before the new-device migration there is nothing to record */ }
}

async function signIn(page: Page) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (auth.error || !auth.data.session) throw auth.error ?? new Error("demo_sign_in_failed");
  await trustSession(admin, auth.data.session.access_token);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((session) => { window.localStorage.clear(); window.localStorage.setItem("sb-supabase-test-auth-token", JSON.stringify(session)); }, auth.data.session);
}

async function shoot(page: Page, name: string) {
  await page.addStyleTag({ content: ".lf-uat-environment-banner{display:none!important}" }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const shot = await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82 });
  console.log(`Demo-shot: ${name} ${new URL(page.url()).pathname} ${shot.toString("base64")}`);
}

async function capture(browser: Browser, kind: "desk" | "phone") {
  const context = kind === "desk"
    ? await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await signIn(page);
  for (const path of PAGES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname, `${path} opened sign-in instead`).not.toMatch(/sign-in|login|onboarding/);
    await shoot(page, `${kind}${path.replace(/[^a-z0-9]+/gi, "-")}`);
  }
  for (const path of OPENED) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const row = page.locator("main button[aria-expanded='false'], main [role='button'][aria-expanded='false']").first();
    if (await row.isVisible().catch(() => false)) {
      await row.click().catch(() => undefined);
      await shoot(page, `${kind}${path.replace(/[^a-z0-9]+/gi, "-")}-open`);
    }
  }
  // The home dashboard, captured again once everything has loaded (the first shot of a run can miss it).
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Total recorded value").first()).toBeVisible({ timeout: 30_000 }).catch(() => undefined);
  await shoot(page, `${kind}-home`);
  // The Premium sheet as it appears when a free limit is reached.
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  // Ask until the page has finished loading and the sheet is listening.
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lf:premium-required", { detail: { reason: "type" } })));
    await expect(page.locator(".lf-premium-sheet")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  await shoot(page, `${kind}-premium-sheet`);
  await context.close();
}

test("To do agrees with the vault: the sample account has a Will, so it isn't asked for one", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page);
  await page.goto(`${BASE_URL}/actions`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.getByText("Do you have a Will?")).toHaveCount(0);
  await expect(page.getByText("No will has been uploaded")).toHaveCount(0);
  await context.close();
});

// Website and sign-in journey (owner question 7 Nov 2026), on a laptop and a phone, synthetic account only.
for (const kind of ["desk", "phone"] as const) {
  test(`website and sign-in journey (${kind})`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = kind === "desk"
      ? await browser.newContext({ viewport: { width: 1440, height: 900 } })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    // 1. A browser that has never signed in sees the website with Sign in / Start free.
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("header a[data-signup]").first()).toHaveAttribute("href", "/sign-up");
    await expect(page.getByText("Open my Vault")).toHaveCount(0);
    await shoot(page, `journey-${kind}-1-website-signed-out`);
    // 2. Signing in with a password on a new browser asks for the emailed code. The code request itself is
    //    blocked here, so no email is sent to the synthetic address.
    await page.route("**/auth/v1/otp**", (route) => route.abort());
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.locator("input[type=email]").first().fill(EMAIL);
    await page.locator("input[type=password]").first().fill(PASSWORD);
    await page.locator("button[type=submit]").filter({ hasText: /sign in/i }).first().click();
    await page.waitForURL(/verify-device|dashboard/, { timeout: 30_000 });
    const askedForCode = /verify-device/.test(page.url());
    console.log(`Journey ${kind}: new browser after password -> ${new URL(page.url()).pathname}`);
    await shoot(page, `journey-${kind}-2-after-password`);
    expect(askedForCode, "a new browser should be asked for the emailed code").toBe(true);
    await page.unroute("**/auth/v1/otp**");
    // 3. Once this browser is trusted (as "Remember this device" does), the website offers the Vault.
    await signIn(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const vault = page.locator("header a[data-signup]").first();
    await expect(vault).toHaveAttribute("href", "/dashboard");
    await expect(vault).toBeVisible();
    await expect(page.locator("section#top a[data-signup]").first()).toHaveText("Open my Vault");
    await shoot(page, `journey-${kind}-3-website-signed-in`);
    // 3b. The sign-in page knows too: "You're signed in" with Continue to my Vault (9 Nov 2026).
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Continue to my Vault/ })).toBeVisible({ timeout: 20_000 });
    await shoot(page, `journey-${kind}-3b-sign-in-page-signed-in`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    // 4. Tapping it opens the Vault without signing in again.
    await vault.click();
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
    // The phone dashboard has a different layout, so check we're in the Vault rather than for a desktop label.
    await expect(page.getByText(/Finances/).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).not.toMatch(/sign-in|verify-device/);
    await shoot(page, `journey-${kind}-4-vault`);
    await context.close();
  });
}

// Guided set-up (UX review, 10 Nov 2026), shown for the synthetic account without changing anything on TEST:
// the page is told set-up isn't finished yet, and every table write is answered here instead of reaching TEST.
for (const kind of ["desk", "phone"] as const) {
  test(`guided set-up screens (${kind})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = kind === "desk"
      ? await browser.newContext({ viewport: { width: 1440, height: 900 } })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await signIn(page);
    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const url = request.url();
      if (request.method() === "GET") {
        if (!/\/rest\/v1\/user_onboarding_state/.test(url)) return route.continue();
        const response = await route.fetch();
        const body = await response.json().catch(() => null);
        const notDone = (row: Record<string, unknown>) => ({ ...row, is_completed: false, current_step: "identity" });
        return route.fulfill({ response, json: Array.isArray(body) ? body.map(notDone) : body && typeof body === "object" ? notDone(body) : body });
      }
      if (/\/rest\/v1\/rpc\//.test(url)) return route.continue();
      let sent: unknown = null;
      try { sent = request.postDataJSON(); } catch { sent = null; }
      const rows = Array.isArray(sent) ? sent : sent ? [sent] : [];
      const single = /vnd\.pgrst\.object/.test(request.headers()["accept"] ?? "");
      console.log(`Set-up ${kind}: answered ${request.method()} ${new URL(url).pathname} here, nothing written`);
      return route.fulfill({ status: 201, json: single ? (rows[0] ?? {}) : rows });
    });
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Is this right\?|What’s your name\?/ })).toBeVisible({ timeout: 30_000 });
    await shoot(page, `setup-${kind}-1-name`);
    await page.getByRole("button", { name: /Yes, continue|^Continue$/ }).click();
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible({ timeout: 30_000 });
    await shoot(page, `setup-${kind}-2-welcome`);
    await page.getByRole("link", { name: /Watch a 1-minute tour first/ }).click();
    await page.waitForURL(/how-it-works\?from=setup/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Back to set-up/ })).toBeVisible({ timeout: 30_000 });
    await shoot(page, `setup-${kind}-3-tour`);
    await page.getByRole("link", { name: /Back to set-up/ }).click();
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Set up with me" }).click();
    await expect(page.getByRole("heading", { name: "Do you have a Will?" })).toBeVisible();
    await shoot(page, `setup-${kind}-4-question-will`);
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Do you have a Power of Attorney?" })).toBeVisible();
    await page.getByRole("button", { name: "Not sure", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Do you own your home?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip this question" }).click();
    await expect(page.getByRole("heading", { name: "Let’s add your first thing" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Your Will/ })).toBeVisible();
    await shoot(page, `setup-${kind}-5-first-thing`);
    await page.getByRole("button", { name: "I’ll do this later" }).click();
    await expect(page.getByRole("heading", { name: "Who should know about your Vault?" })).toBeVisible();
    await shoot(page, `setup-${kind}-6-person`);
    await context.close();
  });
}

test("desktop screens", async ({ browser }) => { test.setTimeout(600_000); await capture(browser, "desk"); });
test("phone screens", async ({ browser }) => { test.setTimeout(600_000); await capture(browser, "phone"); });
