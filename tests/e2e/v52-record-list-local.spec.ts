import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const localOnly = supabaseUrl === "http://127.0.0.1:55421" && baseUrl === "http://127.0.0.1:3012";
const admin = createClient(supabaseUrl || "http://127.0.0.1:55421", serviceKey || anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(supabaseUrl || "http://127.0.0.1:55421", anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const email = `v52-record-list-${runId}@legacyfortress.test`;
const password = "V52RecordList123!";
const title = `Synthetic Property ${runId}`;
const ids: { user?: string; organisation?: string; wallet?: string; asset?: string } = {};

test.describe("V5.2 local record list", () => {
  test.beforeAll(async () => {
    test.skip(!localOnly || !anonKey || !serviceKey, "Approved local app and Supabase are required.");
    const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (user.error || !user.data.user) throw user.error ?? new Error("Synthetic user creation failed");
    ids.user = user.data.user.id;
    const onboardingClient = admin as unknown as Parameters<typeof saveOnboardingState>[0];
    await saveTermsAcceptance(onboardingClient, ids.user, { accepted: true, source: "v52_local_record_list" });
    await saveOnboardingState(onboardingClient, ids.user, { current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"], is_completed: true, terms_accepted: true });
    const org = await admin.from("organisations").insert({ owner_user_id: ids.user, name: `Synthetic V5.2 ${runId}` }).select("id").single();
    if (org.error || !org.data) throw org.error ?? new Error("Synthetic organisation creation failed");
    ids.organisation = org.data.id;
    const wallet = await admin.from("wallets").insert({ organisation_id: ids.organisation, owner_user_id: ids.user, label: "Synthetic wallet", status: "active" }).select("id").single();
    if (wallet.error || !wallet.data) throw wallet.error ?? new Error("Synthetic wallet creation failed");
    ids.wallet = wallet.data.id;
    const asset = await admin.from("assets").insert({
      organisation_id: ids.organisation, wallet_id: ids.wallet, owner_user_id: ids.user,
      section_key: "property", category_key: "property", title, provider_name: "",
      value_minor: 12500000, currency_code: "GBP", visibility: "private", status: "active",
      metadata_json: { property_type: "Residential", property_address: "Synthetic Street" },
    }).select("id").single();
    if (asset.error || !asset.data) throw asset.error ?? new Error("Synthetic asset creation failed");
    ids.asset = asset.data.id;
  });

  test.afterAll(async () => {
    if (!localOnly) return;
    if (ids.asset) await admin.from("assets").delete().eq("id", ids.asset);
    if (ids.wallet) await admin.from("wallets").delete().eq("id", ids.wallet);
    if (ids.organisation) await admin.from("organisations").delete().eq("id", ids.organisation);
    if (ids.user) {
      await admin.from("terms_acceptances").delete().eq("user_id", ids.user);
      await admin.from("user_onboarding_state").delete().eq("user_id", ids.user);
      await admin.auth.admin.deleteUser(ids.user);
    }
  });

  test("owner sees a compact, accessible record row and can open the existing details", async ({ page, isMobile }) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.addInitScript((session) => {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(session));
    }, signedIn.data.session);
    await page.goto("/vault/property", { waitUntil: "domcontentloaded" });
    const row = page.getByRole("button", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await expect(row).toContainText("£125,000");
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#record-detail-${ids.asset}`)).toBeVisible();
    for (const width of isMobile ? [320, 390, 402] : [1280]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, target: document.querySelector<HTMLElement>(".lf-v52-record-summary")?.getBoundingClientRect().height ?? 0 }));
      expect(geometry.width).toBeLessThanOrEqual(width);
      expect(geometry.target).toBeGreaterThanOrEqual(44);
    }
  });
});
