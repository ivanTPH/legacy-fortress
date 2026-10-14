#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "@playwright/test";

const app = process.env.PLAYWRIGHT_BASE_URL;
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.LOCAL_UAT_REVIEW_PASSWORD;
if (app !== "http://127.0.0.1:3012" || supabase !== "http://127.0.0.1:55421" || !password) {
  throw new Error("The shell proof requires the approved local app, local Supabase and a temporary review password.");
}

const output = "docs/design-implementation/screenshots";
const failures = [];
await mkdir(output, { recursive: true });

for (const [engine, name] of [[chromium, "chrome"], [webkit, "webkit"]].filter(([, name]) => !process.env.SHELL_BROWSER || process.env.SHELL_BROWSER === name)) {
  const browser = await engine.launch(name === "chrome" ? { channel: "chrome", headless: true } : { headless: true });
  try {
    for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ baseURL: app, viewport, deviceScaleFactor: 1 });
      const blocked = [];
      context.on("request", (request) => { const url = new URL(request.url()); if (["http:", "https:"].includes(url.protocol) && !(url.hostname === "127.0.0.1" && ["3012", "55421"].includes(url.port))) blocked.push(url.hostname); });
      await context.route("https://**/*", (route) => route.abort());
      const page = await context.newPage();
      let pageErrors = 0;
      let stage = "sign-in";
      const errorKinds = {};
      page.on("pageerror", (error) => { pageErrors++; const kind = error.message.includes("access control checks") ? "access-control" : error.message.includes("Lock was stolen") ? "auth-lock" : error.message.includes("Load failed") ? "load-failed" : "other"; const key = `${stage}:${kind}`; errorKinds[key] = (errorKinds[key] ?? 0) + 1; });
      await page.goto("/sign-in", { waitUntil: "networkidle" });
      const signInButton = page.getByRole("button", { name: /^sign in$/i });
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.locator('input[type="email"]').fill("uat.standard@local.test");
        await page.locator('input[type="password"]').fill(password);
        if (await signInButton.isEnabled()) break;
        await page.waitForTimeout(1000);
      }
      assert.equal(await signInButton.isEnabled(), true, `${name} ${device} sign-in did not hydrate`);
      await signInButton.click();
      await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 30000 });
      stage = "dashboard";
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.locator(".lf-shell").waitFor({ timeout: 30000 });
      if (device === "desktop") await page.locator(".lf-sidebar .lf-brand-glyph").waitFor();
      else await page.getByRole("button", { name: "Toggle navigation menu" }).waitFor();
      await page.waitForTimeout(300);
      assert.equal(new URL(page.url()).pathname, "/dashboard", `${name} ${device} did not reach dashboard`);
      let dashboardLoaded = true;
      try { await page.getByText("Loading dashboard summary...").waitFor({ state: "hidden", timeout: 8000 }); }
      catch { dashboardLoaded = false; }
      assert.equal(await page.locator(".lf-brand-title").first().textContent(), "Legacy Fortress");
      const headerHeight = await page.locator(".lf-topbar").evaluate((node) => Math.round(node.getBoundingClientRect().height));
      if (device === "desktop") assert.equal(headerHeight, 60);
      else assert.ok(headerHeight >= 100, `${name} mobile title hierarchy missing`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name} ${device} horizontal overflow`);

      if (device === "desktop") {
        assert.equal(await page.locator(".lf-sidebar").evaluate((node) => Math.round(node.getBoundingClientRect().width)), 264);
        assert.equal(await page.locator(".lf-sidebar .lf-v3-context-switcher summary").isVisible(), true);
        for (const title of ["Finances", "Legal", "Property", "Business", "Digital", "Possessions", "People I Trust", "Support", "Settings"]) {
          assert.equal(await page.getByRole("link", { name: title, exact: true }).first().isVisible(), true, `${title} missing`);
        }
        await capture(page, `${output}/v3-phase3-owner-desktop-1440x900-${name}.png`);
        stage = "add";
        await page.getByRole("link", { name: "Add to my Fortress" }).focus();
        await page.keyboard.press("Enter");
        await page.waitForURL("**/add");
        assert.equal(await page.getByRole("heading", { name: "Add to my Fortress" }).isVisible(), true);
        stage = "actions";
        await page.getByRole("link", { name: "Action Centre" }).click();
        await page.waitForURL("**/actions");
        await capture(page, `${output}/v3-phase3-actions-desktop-1440x900-${name}.png`);
        await checkAccessibilityOverflow(page, name, device);
        for (const domain of ["admin", "enterprise"]) {
          stage = domain;
          const response = await page.goto(`/${domain}`, { waitUntil: "domcontentloaded" });
          const denied = page.getByRole("heading", { name: domain === "admin" ? /Admin access is restricted/i : /Access denied|Enterprise workspace unavailable/i });
          try { await denied.waitFor({ timeout: 7000 }); console.log(`${name} ${domain} domain: ${await denied.textContent()}`); }
          catch { console.log(`${name} ${domain} domain: unverified (HTTP ${response?.status() ?? "unknown"}; path ${new URL(page.url()).pathname})`); }
        }
        await page.goto("/actions", { waitUntil: "domcontentloaded" });
        await page.locator(".lf-shell").waitFor();
        page.on("response", (response) => { if (response.url().includes("/auth/v1/logout")) console.log(`${name} logout response: ${response.status()}`); });
        stage = "sign-out";
        await page.locator(".lf-topbar-account summary").click();
        await page.locator(".lf-topbar-account-menu .lf-signout").click();
        await page.waitForTimeout(3000);
        console.log(`${name} ${device} sign-out path: ${new URL(page.url()).pathname}`);
        console.log(`${name} ${device} sign-out state: ${await page.locator(".lf-auth").count() ? "auth fallback" : "shell"}`);
        try { await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 5000 }); }
        catch { failures.push(`${name} ${device} sign-out did not reach /sign-in`); }
      } else {
        assert.equal(await page.locator(".lf-mobile-tabs a").count(), 4);
        assert.equal(await page.locator(".lf-mobile-tabs").isVisible(), true);
        assert.equal(await page.locator(".lf-mobile-tabs a").first().evaluate((node) => node.getBoundingClientRect().height >= 44), true);
        await capture(page, `${output}/v3-phase3-owner-mobile-390x844-${name}.png`);
        stage = "mobile-menu";
        const menuButton = page.getByRole("button", { name: "Toggle navigation menu" });
        await menuButton.click();
        const drawer = page.getByRole("dialog", { name: "Mobile Navigation" });
        assert.equal(await drawer.isVisible(), true);
        await drawer.locator(".lf-v3-context-switcher summary").click();
        const sheet = page.getByRole("dialog", { name: "Switch Fortress" });
        assert.equal(await sheet.isVisible(), true);
        await page.keyboard.press("Escape");
        assert.equal(await sheet.count(), 0);
        await page.keyboard.press("Escape");
        assert.equal(await drawer.count(), 0);
        assert.equal(await menuButton.evaluate((node) => node === document.activeElement), true);
        stage = "actions";
        await page.getByRole("navigation", { name: "Customer tabs" }).getByRole("link", { name: "Actions" }).click();
        await page.waitForURL("**/actions");
        await capture(page, `${output}/v3-phase3-actions-mobile-390x844-${name}.png`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await checkAccessibilityOverflow(page, name, device);
      }
      assert.deepEqual(blocked, [], `${name} ${device} attempted a non-local request`);
      console.log(`${name} ${device}: authenticated shell, navigation, focus and local-only requests passed (dashboard loaded: ${dashboardLoaded}; ${pageErrors} page errors ${JSON.stringify(errorKinds)})`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
if (failures.length) throw new Error(failures.join("; "));

async function capture(page, path) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path, fullPage: false });
}

async function checkAccessibilityOverflow(page, name, device) {
  await page.locator(".lf-shell").evaluate((node) => { node.dataset.lfTextSize = "xlarge"; node.dataset.lfContrast = "high"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name} ${device} accessibility overflow`);
}
