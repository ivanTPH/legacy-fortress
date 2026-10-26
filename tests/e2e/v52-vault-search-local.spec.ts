import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";

const localOnly = process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:55421" && process.env.PLAYWRIGHT_BASE_URL === "http://127.0.0.1:3012";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin = createClient("http://127.0.0.1:55421", serviceKey || anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient("http://127.0.0.1:55421", anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const runId = randomUUID().slice(0, 8);
const email = `v52-search-${runId}@legacyfortress.test`;
const otherEmail = `v52-search-other-${runId}@legacyfortress.test`;
const password = "V52Search123!";
const ids: { user?: string; otherUser?: string; org?: string; wallet?: string; otherOrg?: string; otherWallet?: string; barclays?: string; current?: string; will?: string; otherAsset?: string } = {};

test.describe("V5.2 authorised local Vault search", () => {
  test.beforeAll(async () => {
    test.skip(!localOnly || !anonKey || !serviceKey, "Approved local app and Supabase are required.");
    for (const [address, key] of [[email, "user"], [otherEmail, "otherUser"]] as const) {
      const result = await admin.auth.admin.createUser({ email: address, password, email_confirm: true });
      if (result.error || !result.data.user) throw result.error ?? new Error("Synthetic user creation failed");
      ids[key] = result.data.user.id;
      const onboardingClient = admin as unknown as Parameters<typeof saveOnboardingState>[0];
      await saveTermsAcceptance(onboardingClient, result.data.user.id, { accepted: true, source: "v52_search_local" });
      await saveOnboardingState(onboardingClient, result.data.user.id, { current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"], is_completed: true, terms_accepted: true });
    }
    for (const [ownerId, orgKey, walletKey] of [[ids.user!, "org", "wallet"], [ids.otherUser!, "otherOrg", "otherWallet"]] as const) {
      const org = await admin.from("organisations").insert({ owner_user_id: ownerId, name: `Synthetic Search ${runId}` }).select("id").single();
      if (org.error || !org.data) throw org.error ?? new Error("Synthetic organisation creation failed");
      ids[orgKey] = org.data.id;
      const wallet = await admin.from("wallets").insert({ organisation_id: org.data.id, owner_user_id: ownerId, label: "Synthetic wallet", status: "active" }).select("id").single();
      if (wallet.error || !wallet.data) throw wallet.error ?? new Error("Synthetic wallet creation failed");
      ids[walletKey] = wallet.data.id;
    }
    for (const [key, owner, org, wallet, title, provider] of [
      ["barclays", ids.user!, ids.org!, ids.wallet!, `Barclays Savings Account ${runId}`, "Barclays"],
      ["current", ids.user!, ids.org!, ids.wallet!, `Current Account ${runId}`, "HSBC"],
      ["otherAsset", ids.otherUser!, ids.otherOrg!, ids.otherWallet!, `Other Person Savings ${runId}`, "Barclays"],
    ] as const) {
      const asset = await admin.from("assets").insert({ organisation_id: org, wallet_id: wallet, owner_user_id: owner, section_key: "finances", category_key: "bank", title, provider_name: provider, value_minor: 5603200, currency_code: "GBP", visibility: "private", status: "active", metadata_json: { provider_name: provider, account_type: title.includes("Savings") ? "savings" : "current_account", account_number: "12345678", sort_code: "111222" } }).select("id").single();
      if (asset.error || !asset.data) throw asset.error ?? new Error("Synthetic bank record creation failed");
      ids[key] = asset.data.id;
    }
    const will = await admin.from("records").insert({ owner_user_id: ids.user, section_key: "legal", category_key: "wills", title: `My Will ${runId}`, status: "active", metadata: { private_note: "not for search" } }).select("id").single();
    if (will.error || !will.data) throw will.error ?? new Error("Synthetic Will creation failed");
    ids.will = will.data.id;
  });

  test.afterAll(async () => {
    if (!localOnly) return;
    if (ids.will) await admin.from("records").delete().eq("id", ids.will);
    for (const key of ["barclays", "current", "otherAsset"] as const) if (ids[key]) await admin.from("assets").delete().eq("id", ids[key]);
    for (const key of ["wallet", "otherWallet"] as const) if (ids[key]) await admin.from("wallets").delete().eq("id", ids[key]);
    for (const key of ["org", "otherOrg"] as const) if (ids[key]) await admin.from("organisations").delete().eq("id", ids[key]);
    for (const key of ["user", "otherUser"] as const) if (ids[key]) {
      await admin.from("terms_acceptances").delete().eq("user_id", ids[key]);
      await admin.from("user_onboarding_state").delete().eq("user_id", ids[key]);
      await admin.auth.admin.deleteUser(ids[key]);
    }
  });

  test("Bank list keeps direct record access and excludes another owner without a local toolbar", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.goto("/finances/bank", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".lf-v52-record-toolbar")).toBeHidden();
    await expect(page.getByRole("button", { name: new RegExp(`Barclays Savings Account ${runId}`) })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "banks-list-mobile.png" : "banks-list-desktop.png") });
    await expect(page.getByText(`Other Person Savings ${runId}`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: new RegExp(`Current Account ${runId}`) })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`Barclays Savings Account ${runId}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/finances/bank\\?asset=${ids.barclays}`));
    await expect(page.getByRole("heading", { name: `Barclays Savings Account ${runId}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.getByText("12345678", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "bank-detail-mobile.png" : "bank-detail-desktop.png") });
    await page.getByRole("link", { name: /Finances · Bank accounts/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(`Barclays Savings Account ${runId}`) })).toBeVisible();
    const currentRow = page.getByRole("button", { name: new RegExp(`Current Account ${runId}`) });
    await expect(currentRow).toBeVisible();
    await currentRow.click();
    await expect(page).toHaveURL(new RegExp(`/finances/bank\\?asset=${ids.current}`));
    await expect(page.getByRole("heading", { name: `Current Account ${runId}` })).toBeVisible();
    await page.goto(`/finances/bank?asset=${ids.otherAsset}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("This record is unavailable or you do not have access.")).toBeVisible();
    await expect(page.getByText(`Other Person Savings ${runId}`)).toHaveCount(0);
  });

  test("Barclays detail uses structured rows and a truthful responsive context rail", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto(`/finances/bank?asset=${ids.barclays}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: `Barclays Savings Account ${runId}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "People linked to this record" })).toBeVisible();
    await expect(page.getByText("No linked people available in this view.")).toBeVisible();
    await expect(page.getByText("Event history is not available for this record.")).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(1);
    await expect(page.getByText("12345678", { exact: true })).toHaveCount(0);
    const geometry = await page.locator(".lf-v52-record-detail-grid").evaluate((grid) => {
      const main = grid.querySelector<HTMLElement>(".lf-v52-record-main")!;
      const rail = grid.querySelector<HTMLElement>(".lf-v52-record-rail")!;
      return { sideBySide: rail.getBoundingClientRect().left > main.getBoundingClientRect().right, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry.sideBySide).toBe(!isMobile);
    expect(geometry.overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "barclays-detail-release85-mobile.png" : "barclays-detail-release85-desktop.png"), fullPage: true });
  });

  test("global search finds the saved Will, provider and updated account", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.goto("/legal", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Legal", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Loading legal records…")).toHaveCount(0);
    const emptyLegalTile = page.locator(".lf-v52-legal-page .lf-v52-section-tile").filter({ hasText: "No records yet" }).first();
    await expect(emptyLegalTile).toBeVisible();
    await expect(emptyLegalTile.getByRole("link").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "legal-overview-mobile.png" : "legal-overview-desktop.png") });
    await page.goto("/dashboard?search=", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Try searching for" })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "search-before-mobile.png" : "search-before-desktop.png") });
    if (isMobile) {
      const searchForm = page.locator(".lf-v52-search-mobile-field");
      const searchInput = searchForm.getByRole("searchbox", { name: "Search your vault" });
      await searchInput.focus();
      const focus = await searchInput.evaluate((input) => ({
        innerOutline: getComputedStyle(input).outlineStyle,
        outerRing: getComputedStyle(input.closest("form")!).boxShadow,
      }));
      expect(focus.innerOutline).toBe("none");
      expect(focus.outerRing).not.toBe("none");
      await searchInput.fill("Barclays");
      await searchForm.getByRole("button", { name: "Submit Vault search" }).click();
    } else {
      const globalSearch = page.locator(".lf-global-search");
      await globalSearch.getByRole("searchbox", { name: "Search your vault" }).fill("Barclays");
      await globalSearch.getByRole("searchbox", { name: "Search your vault" }).press("Enter");
    }
    await expect(page.getByRole("region", { name: "Records" })).toContainText(`Barclays Savings Account ${runId}`);
    if (isMobile) {
      await page.locator(".lf-mobile-search-toggle").click();
      const headerSearch = page.locator(".lf-global-search");
      await headerSearch.getByRole("searchbox", { name: "Search your vault" }).fill("Current");
      await headerSearch.getByRole("button", { name: "Submit Vault search" }).click();
      await expect(page.getByRole("region", { name: "Records" })).toContainText(`Current Account ${runId}`);
      const searchForm = page.locator(".lf-v52-search-mobile-field");
      await searchForm.getByRole("searchbox", { name: "Search your vault" }).fill("Savings");
      await searchForm.getByRole("searchbox", { name: "Search your vault" }).press("Enter");
      await expect(page.getByRole("region", { name: "Records" })).toContainText(`Barclays Savings Account ${runId}`);
    }
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "search-results-mobile.png" : "search-results-desktop.png") });
    await page.goto(`/dashboard?search=${encodeURIComponent(`My Will ${runId}`)}`, { waitUntil: "domcontentloaded" });
    const willResult = page.getByRole("link", { name: new RegExp(`My Will ${runId}`) });
    await expect(willResult).toBeVisible();
    await willResult.click();
    await expect(page).toHaveURL(new RegExp(`/legal/wills\\?record=${ids.will}`));
    await expect(page.getByRole("heading", { name: `My Will ${runId}` })).toBeVisible();
    await page.goto(`/dashboard?search=HSBC`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: new RegExp(`Current Account ${runId}`) })).toBeVisible();
    await expect(page.getByText(`Other Person Savings ${runId}`)).toHaveCount(0);
    await page.goto(`/dashboard?search=${encodeURIComponent(`missing-${runId}`)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: new RegExp(`Nothing matches.*missing-${runId}`) })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(isMobile ? "search-empty-mobile.png" : "search-empty-desktop.png") });
    await expect(page.locator(".lf-v52-search-clear")).toBeVisible();
    const revisedTitle = `Barclays Updated ${runId}`;
    const update = await admin.from("assets").update({ title: revisedTitle }).eq("id", ids.barclays!);
    if (update.error) throw update.error;
    await page.goto(`/dashboard?search=${encodeURIComponent(revisedTitle)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: new RegExp(revisedTitle) })).toBeVisible();
  });

  test("V5.2 settings, add-person and document states keep their authorised routes", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.context().addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    for (const [route, heading, file] of [
      ["/profile", "Profile", "profile"],
      ["/account/security", "Security", "security"],
      ["/account/reminder-preferences", "Notifications", "notifications"],
      ["/people-access?view=people&group=trusted_contacts&add=1", "Add person", "add-person"],
      ["/property/documents", "Documents", "documents"],
      ["/finances/bank?add=1", "Add bank account", "add-bank-account"],
    ] as const) {
      const view = await page.context().newPage();
      await view.goto(route, { waitUntil: "domcontentloaded" });
      await expect(view.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await view.screenshot({ path: testInfo.outputPath(`${file}-${isMobile ? "mobile" : "desktop"}.png`), fullPage: true });
      await view.close();
    }
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (isMobile) await page.getByRole("button", { name: "Toggle navigation menu" }).click();
    await page.screenshot({ path: testInfo.outputPath(`menu-${isMobile ? "mobile" : "desktop"}.png`) });
  });
});
