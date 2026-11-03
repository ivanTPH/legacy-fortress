import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Website screenshots from a synthetic demo account on TEST (owner approved 3 Nov 2026).
 * Creates a throwaway "Bill Smith" account, fills it with the synthetic review data, photographs the main
 * screens on desktop and phone, then deletes the account. The TEST banner is hidden in these photos only.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RUN_MARKER = `staging-demo-shots-${Date.now()}`;
const EMAIL = `${RUN_MARKER}@example.test`;
const PASSWORD = `StagingDemoShots-${Date.now()}-Aa1!`;
const OUT = "test-results/demo-shots";
const PAGES = ["/dashboard", "/finances", "/finances/bank", "/property", "/legal", "/personal", "/contacts", "/access-sharing", "/account/billing"];

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
  const created = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Bill Smith" } });
  if (created.error || !created.data.user) throw created.error ?? new Error("demo_user_missing");
  userId = created.data.user.id;
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

test.afterAll(async () => {
  if (!admin || !userId) return;
  const removed = await admin.auth.admin.deleteUser(userId);
  console.log(`Demo-cleanup: ${removed.error ? `left for manual removal (${removed.error.message})` : "account deleted"}`);
});

async function signIn(page: Page) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (auth.error || !auth.data.session) throw auth.error ?? new Error("demo_sign_in_failed");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((session) => { window.localStorage.clear(); window.localStorage.setItem("sb-supabase-test-auth-token", JSON.stringify(session)); }, auth.data.session);
}

async function shoot(page: Page, name: string) {
  await page.addStyleTag({ content: ".lf-uat-environment-banner{display:none!important}" }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`Demo-shot: ${name} ${new URL(page.url()).pathname}`);
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
  // The Premium sheet as it appears when a free limit is reached.
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lf:premium-required", { detail: { reason: "records" } })));
  await expect(page.getByRole("dialog", { name: /Premium/ })).toBeVisible();
  await shoot(page, `${kind}-premium-sheet`);
  await context.close();
}

test("desktop screens", async ({ browser }) => { test.setTimeout(240_000); await capture(browser, "desk"); });
test("phone screens", async ({ browser }) => { test.setTimeout(240_000); await capture(browser, "phone"); });
