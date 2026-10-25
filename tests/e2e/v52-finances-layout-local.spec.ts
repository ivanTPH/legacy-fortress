import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const localOnly = url === "http://127.0.0.1:55421" && baseUrl === "http://127.0.0.1:3012"
  && (() => { try { const db = new URL(databaseUrl); return db.hostname === "127.0.0.1" && db.port === "55422"; } catch { return false; } })();
const runId = randomUUID().slice(0, 8);
const email = `v52-finance-layout-${runId}@legacyfortress.test`;
const password = "V52FinanceLayout123!";
const admin = createClient(url || "http://127.0.0.1:55421", serviceKey || anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url || "http://127.0.0.1:55421", anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const ids: { user?: string; organisation?: string; wallet?: string; assets: string[] } = { assets: [] };

test.describe("V5.2 Dashboard and Finances structure on real local routes", () => {
  test.beforeAll(async () => {
    test.skip(!localOnly || !anonKey || !serviceKey, "Approved local app, Auth and database are required.");
    const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (user.error || !user.data.user) throw user.error ?? new Error("Synthetic user creation failed");
    ids.user = user.data.user.id;
    const onboardingClient = admin as unknown as Parameters<typeof saveOnboardingState>[0];
    await saveTermsAcceptance(onboardingClient, ids.user, { accepted: true, source: "v52_local_layout" });
    await saveOnboardingState(onboardingClient, ids.user, { current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"], is_completed: true, terms_accepted: true });
    const org = await admin.from("organisations").insert({ owner_user_id: ids.user, name: `Synthetic layout ${runId}` }).select("id").single();
    if (org.error || !org.data) throw org.error ?? new Error("Synthetic organisation creation failed");
    ids.organisation = org.data.id;
    const wallet = await admin.from("wallets").insert({ organisation_id: ids.organisation, owner_user_id: ids.user, label: "Synthetic wallet", status: "active" }).select("id").single();
    if (wallet.error || !wallet.data) throw wallet.error ?? new Error("Synthetic wallet creation failed");
    ids.wallet = wallet.data.id;
    const assets = await admin.from("assets").insert([
      { category_key: "bank", title: "Barclays Savings Account", provider_name: "Barclays", value_minor: 10000000, metadata_json: { account_type: "savings_account" } },
      { category_key: "bank", title: "Current Account", provider_name: "Synthetic Bank", value_minor: 3224500, metadata_json: { account_type: "current_account" } },
      { category_key: "pensions", title: "Synthetic Pension", provider_name: "Synthetic Pension", value_minor: 52034500, metadata_json: { pension_type: "workplace_pension" } },
    ].map((asset) => ({ ...asset, organisation_id: ids.organisation, wallet_id: ids.wallet, owner_user_id: ids.user, section_key: "finances", currency_code: "GBP", status: "active", visibility: "private" }))).select("id");
    if (assets.error || !assets.data || assets.data.length !== 3) throw assets.error ?? new Error("Synthetic finance records could not be created");
    ids.assets = assets.data.map((asset) => asset.id);
  });

  test.afterAll(async () => {
    if (!localOnly) return;
    if (ids.assets.length) await admin.from("assets").delete().in("id", ids.assets);
    if (ids.wallet) await admin.from("wallets").delete().eq("id", ids.wallet);
    if (ids.organisation) await admin.from("organisations").delete().eq("id", ids.organisation);
    if (ids.user) {
      await admin.from("terms_acceptances").delete().eq("user_id", ids.user);
      await admin.from("user_onboarding_state").delete().eq("user_id", ids.user);
      await admin.auth.admin.deleteUser(ids.user);
    }
  });

  test("owner sees the approved shared cards and working Add path", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const dashboard = page.locator(".lf-v3-screen-overview.is-dashboard");
    await expect(dashboard.locator(".lf-v52-section-tile")).toHaveCount(6);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.lfIconsReady === "true")).toBe(true);
    await expect(dashboard.locator(".lf-v52-section-tile").first()).toContainText("3 records");
    if (!isMobile) await expect(dashboard.locator(".lf-v3-stats-strip > div")).toHaveCount(4);
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "dashboard-390.png" : "dashboard-1440.png"), fullPage: true });
    await dashboard.locator('.lf-v52-section-link[href="/finances"]').click();
    await expect(page).toHaveURL(/\/finances$/);
    const finances = page.locator(".lf-v52-finance-page");
    await expect(finances.locator(".lf-v52-section-tile")).toHaveCount(5);
    await expect(finances.locator(".lf-v52-section-link strong", { hasText: "Investments" })).toBeVisible();
    await expect(finances.getByRole("link", { name: "Add to Finances" })).toHaveAttribute("href", "/add?area=finances");
    if (isMobile) {
      const iconWidth = await finances.locator(".lf-v52-finance-add > .lf-icon").evaluate((icon) => icon.getBoundingClientRect().width);
      expect(iconWidth).toBeGreaterThanOrEqual(16);
      const emptyAddIconWidth = await finances.locator(".lf-v52-section-add > .lf-icon").first().evaluate((icon) => icon.getBoundingClientRect().width);
      expect(emptyAddIconWidth).toBeGreaterThanOrEqual(16);
    }
    const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, columns: getComputedStyle(document.querySelector<HTMLElement>(".lf-v52-finance-page .lf-v52-section-grid")!).gridTemplateColumns.split(" ").length }));
    expect(geometry.width).toBeLessThanOrEqual(isMobile ? 390 : 1440);
    expect(geometry.columns).toBe(isMobile ? 2 : 3);
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "finances-390.png" : "finances-1440.png"), fullPage: true });
    await finances.getByRole("link", { name: "Add to Finances" }).click();
    await expect(page).toHaveURL(/\/add\?area=finances/);
    await expect(page.getByRole("heading", { name: "Finances", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bank/ }).first()).toBeVisible();
  });
});
