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
const ids: { user?: string; otherUser?: string; org?: string; wallet?: string; otherOrg?: string; otherWallet?: string; barclays?: string; current?: string; will?: string; release92Will?: string; otherAsset?: string } = {};

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
    if (ids.release92Will) await admin.from("records").delete().eq("id", ids.release92Will);
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

  test("Release 90 shared mobile navigation and list controls fit the viewport", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.context().addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    const widths = isMobile ? [320, 390, 402] : [1440];
    for (const width of widths) {
      for (const route of ["/legal/wills", "/finances/bank", "/legal/trusts"]) {
        const view = await page.context().newPage();
        await view.setViewportSize({ width, height: isMobile ? 844 : 900 });
        await view.goto(route, { waitUntil: "domcontentloaded" });
        const heading = view.locator(".lf-v52-category-title-row h1");
        await expect(heading).toBeVisible();
        if (route === "/legal/wills") await expect(view.getByRole("button", { name: new RegExp(`My Will ${runId}`) })).toBeVisible();
        if (route === "/finances/bank") await expect(view.getByRole("button", { name: new RegExp(`Barclays Savings Account ${runId}`) })).toBeVisible();
        const add = view.locator(".lf-v52-category-add");
        await expect(add).toBeVisible();
        if (route === "/legal/wills" && isMobile) {
          await expect(view.getByRole("button", { name: "Back to Legal" })).toBeVisible();
          await expect(view.locator(".lf-v52-category-heading > .lf-v52-record-page-back")).toBeHidden();
        }
        const fit = await add.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const headingRect = document.querySelector(".lf-v52-category-title-row")!.getBoundingClientRect();
          return { left: rect.left, right: rect.right, headingRight: headingRect.right, viewport: innerWidth };
        });
        expect(fit.left, `${route} at ${width}: ${JSON.stringify(fit)}`).toBeGreaterThanOrEqual(0);
        expect(fit.right, `${route} at ${width}: ${JSON.stringify(fit)}`).toBeLessThanOrEqual(width);
        expect(fit.headingRight, `${route} at ${width}: ${JSON.stringify(fit)}`).toBeLessThanOrEqual(width);
        if (route === "/legal/wills" || (route === "/finances/bank" && width === 390)) {
          await view.screenshot({ path: testInfo.outputPath(`${route.split("/").at(-1)}-${width}.png`) });
        }
        if (route === "/legal/wills" && width === 390) {
          await add.click();
          const form = view.locator(".lf-v4-record-form");
          await expect(form).toBeVisible();
          await expect(view.locator(".lf-mobile-bottom-nav")).toBeHidden();
          await expect(form.getByLabel("Will title (required)")).toBeVisible();
          await expect(form.locator("input[type=file]")).toHaveAttribute("accept", /image/);
          const uploadBounds = await form.locator(".lf-shared-document-upload-field").boundingBox();
          expect((uploadBounds?.x ?? 0) + (uploadBounds?.width ?? 0)).toBeLessThanOrEqual(width);
          await view.screenshot({ path: testInfo.outputPath("add-will-390.png") });
          await view.setViewportSize({ width, height: 520 });
          await form.getByLabel("Will title (required)").focus();
          const footer = await form.locator(".lf-v4-form-footer").boundingBox();
          expect(footer?.x).toBeGreaterThanOrEqual(0);
          expect((footer?.x ?? 0) + (footer?.width ?? 0)).toBeLessThanOrEqual(width);
          expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual(520);
        }
        await view.close();
      }
    }
    if (isMobile) {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Toggle navigation menu" })).toBeVisible();
      await page.getByRole("button", { name: "Toggle navigation menu" }).click();
      const drawer = page.getByRole("complementary", { name: "Mobile Navigation" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Finances" })).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Legal" })).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Finances" })).toBeInViewport();
      await expect(drawer.getByRole("link", { name: "People & Access" })).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Settings" })).toBeVisible();
      await expect(page.locator(".lf-mobile-bottom-nav")).toBeVisible();
      const menuGeometry = await drawer.evaluate((element) => {
        const tree = element.querySelector(".lf-mobile-tree")!;
        const lastArea = tree.lastElementChild!;
        const footer = element.querySelector(".lf-mobile-drawer-footer")!;
        return { treeBottom: tree.getBoundingClientRect().bottom, lastAreaBottom: lastArea.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top };
      });
      expect(menuGeometry.treeBottom, JSON.stringify(menuGeometry)).toBeGreaterThanOrEqual(menuGeometry.lastAreaBottom);
      expect(menuGeometry.footerTop, JSON.stringify(menuGeometry)).toBeGreaterThanOrEqual(menuGeometry.lastAreaBottom);
      await page.screenshot({ path: testInfo.outputPath("menu-320.png") });
      await drawer.getByRole("button", { name: "Sign out" }).scrollIntoViewIfNeeded();
      await expect(drawer.getByRole("button", { name: "Sign out" })).toBeInViewport();
      await drawer.locator(".lf-workspace-current").click();
      const vaultSwitcher = page.getByRole("navigation", { name: "Available workspaces" });
      await expect(vaultSwitcher).toContainText("My Vault");
      await expect(vaultSwitcher).toContainText("Owner");
      await expect(vaultSwitcher.getByRole("link", { name: /My Vault.*Owner/ })).toBeInViewport();
      await expect(page.locator(".lf-mobile-bottom-nav")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("switcher-320.png") });
      await vaultSwitcher.getByRole("button", { name: "Menu" }).click();
      await drawer.getByRole("button", { name: "Close navigation and return to page" }).click();
      await expect(drawer).toBeHidden();
      await page.getByRole("button", { name: "Search your vault" }).click();
      const search = page.locator(".lf-global-search");
      await expect(search.getByRole("button", { name: "Submit Vault search" })).toBeVisible();
      await expect(search.getByRole("button", { name: "Close search" })).toBeVisible();
      await search.getByRole("searchbox", { name: "Search your vault" }).focus();
      await page.setViewportSize({ width: 320, height: 400 });
      await expect(search.getByRole("button", { name: "Submit Vault search" })).toBeInViewport();
      const searchBox = await search.boundingBox();
      expect((searchBox?.x ?? 0) + (searchBox?.width ?? 0)).toBeLessThanOrEqual(320);
      await page.setViewportSize({ width: 320, height: 568 });
      await search.getByRole("searchbox", { name: "Search your vault" }).fill("Barclays");
      await search.getByRole("button", { name: "Submit Vault search" }).click();
      await expect(page.getByRole("region", { name: "Records" })).toContainText(`Barclays Savings Account ${runId}`);
      await page.screenshot({ path: testInfo.outputPath("search-320.png") });
    }
  });

  test("Release 92 search framing, Legal grid and Will executor boundary", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.context().addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    if (!isMobile) {
      const desktopSearch = page.locator(".lf-global-search");
      await expect(desktopSearch).toBeVisible();
      await desktopSearch.getByRole("searchbox", { name: "Search your vault" }).fill("Barclays");
      await desktopSearch.getByRole("searchbox", { name: "Search your vault" }).press("Enter");
      await expect(page.getByRole("region", { name: "Records" })).toContainText(`Barclays Savings Account ${runId}`);
      await expect(desktopSearch).toBeVisible();
      await expect(page.locator(".lf-v52-search-mobile-field")).toBeHidden();
      await page.goto("/legal", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".lf-v52-legal-summary")).toContainText("sections");
      await expect(page.locator(".lf-v52-legal-page .lf-v3-stats-strip")).toHaveCount(0);
      const desktopGrid = page.locator(".lf-v52-legal-page .lf-v52-section-grid");
      await expect(desktopGrid).toBeVisible();
      expect(await desktopGrid.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(3);
      await page.screenshot({ path: testInfo.outputPath("release91-desktop-search.png") });
      return;
    }
    await page.getByRole("button", { name: "Search your vault" }).click();
    await expect(page).toHaveURL(/\/dashboard\?search=/);
    await expect(page.getByRole("button", { name: "Back to Home" })).toBeVisible();
    await expect(page.locator(".lf-global-search")).toBeHidden();
    const pageSearch = page.locator(".lf-v52-search-mobile-field");
    await expect(pageSearch).toBeVisible();
    const geometry = async () => page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element || getComputedStyle(element).display === "none") return null;
        const rect = element.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
      };
      return { banner: box(".lf-uat-environment-banner"), header: box(".lf-topbar"), headerSearch: box(".lf-global-search"), pageSearch: box(".lf-v52-search-mobile-field"), viewport: innerWidth };
    });
    const assertMobileSearchFit = async (expectedY?: number) => {
      const layout = await geometry();
      expect(layout.headerSearch).toBeNull();
      expect(layout.pageSearch).not.toBeNull();
      expect(layout.pageSearch!.y).toBeGreaterThanOrEqual(layout.header!.bottom);
      expect(layout.header!.y).toBeGreaterThanOrEqual(layout.banner!.bottom);
      expect(layout.pageSearch!.right).toBeLessThanOrEqual(layout.viewport);
      if (expectedY !== undefined) expect(layout.pageSearch!.y).toBe(expectedY);
      for (const button of await pageSearch.locator("button:visible").all()) {
        const rect = await button.boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(layout.viewport);
        expect(rect!.height).toBeGreaterThanOrEqual(44);
      }
      return layout.pageSearch!.y;
    };
    const searchY = await assertMobileSearchFit();
    const input = pageSearch.getByRole("searchbox", { name: "Search your vault" });
    const clear = pageSearch.locator(".lf-v52-search-input-clear");
    const submit = pageSearch.getByRole("button", { name: "Submit Vault search" });
    const emptyFrame = await pageSearch.boundingBox();
    await expect(clear).toBeDisabled();
    const frameStyle = await pageSearch.evaluate((form) => ({ border: getComputedStyle(form).borderWidth, ring: getComputedStyle(form).boxShadow }));
    expect(frameStyle.border).toBe("1px");
    await page.screenshot({ path: testInfo.outputPath("release91-search-empty.png") });
    await input.focus();
    await assertMobileSearchFit(searchY);
    const focusedStyle = await pageSearch.evaluate((form) => ({ ring: getComputedStyle(form).boxShadow, inputOutline: getComputedStyle(form.querySelector("input")!).outlineStyle }));
    expect(focusedStyle.ring).toContain("inset");
    expect(focusedStyle.inputOutline).toBe("none");
    await page.setViewportSize({ width: 390, height: 520 });
    await assertMobileSearchFit(searchY);
    await page.setViewportSize({ width: 390, height: 844 });
    await input.fill("Barclays");
    await submit.click();
    await expect(page.getByRole("region", { name: "Records" })).toContainText(`Barclays Savings Account ${runId}`);
    await assertMobileSearchFit(searchY);
    const submittedFrame = await pageSearch.boundingBox();
    expect(submittedFrame?.x).toBe(emptyFrame?.x);
    expect(submittedFrame?.width).toBe(emptyFrame?.width);
    expect(submittedFrame?.height).toBe(emptyFrame?.height);
    expect((await submit.boundingBox())!.width).toBeLessThanOrEqual(60);
    await page.screenshot({ path: testInfo.outputPath("release91-search-results.png") });
    await clear.click();
    await expect(page.getByRole("heading", { name: "Try searching for" })).toBeVisible();
    await assertMobileSearchFit(searchY);
    await page.getByRole("button", { name: "Back to Home" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: "Search your vault" }).click();
    await expect(pageSearch).toBeVisible();
    await assertMobileSearchFit(searchY);
    const willPage = await page.context().newPage();
    await willPage.setViewportSize({ width: 390, height: 844 });
    await willPage.goto("/legal", { waitUntil: "domcontentloaded" });
    await expect(willPage.getByRole("heading", { name: "Legal", exact: true })).toBeVisible();
    await expect(willPage.locator(".lf-v52-legal-summary")).toContainText("sections");
    await expect(willPage.locator(".lf-v52-legal-page .lf-v3-stats-strip")).toHaveCount(0);
    const legalGrid = willPage.locator(".lf-v52-legal-page .lf-v52-section-grid");
    await expect(legalGrid).toBeVisible();
    expect(await legalGrid.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(2);
    await willPage.screenshot({ path: testInfo.outputPath("release92-legal-mobile.png") });
    await legalGrid.getByRole("link", { name: /Wills/ }).first().click();
    await expect(willPage).toHaveURL(/\/legal\/wills/);
    await willPage.getByRole("button", { name: "Add a Will" }).click();
    await expect(willPage.getByLabel("Executor name")).toHaveCount(1);
    await expect(willPage.getByRole("button", { name: "Add another executor" })).toHaveCount(0);
    await willPage.screenshot({ path: testInfo.outputPath("release92-add-will.png") });
    const willTitle = `Release 92 Will ${runId}`;
    await willPage.getByLabel("Will title (required)").fill(willTitle);
    await willPage.getByLabel("Executor name").fill(`Alex Executor ${runId}`);
    await willPage.getByRole("button", { name: "Add notes" }).click();
    await willPage.locator(".lf-v4-record-form textarea").fill("Synthetic Will location recorded for TEST.");
    await willPage.getByRole("button", { name: "Save record" }).click();
    await expect(willPage.getByText("Record added securely.")).toBeVisible();
    const savedWill = await admin.from("records").select("id").eq("owner_user_id", ids.user!).eq("title", willTitle).single();
    if (savedWill.error || !savedWill.data) throw savedWill.error ?? new Error("Saved Will missing");
    ids.release92Will = savedWill.data.id;
    await willPage.goto(`/legal/wills?record=${ids.release92Will}`, { waitUntil: "domcontentloaded" });
    await expect(willPage.getByRole("heading", { name: "Executors" })).toBeVisible();
    await expect(willPage.locator(".lf-v52-record-person-list")).toContainText(`Alex Executor ${runId}`);
    await willPage.close();
  });
});
