#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, devices } from "@playwright/test";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ARTIFACT_DIR = process.env.MOBILE_POLISH_ARTIFACT_DIR || path.join(process.cwd(), "test-results", "mobile-polish");

const routes = [
  { name: "sign-in", pathname: "/sign-in", patterns: [/Legacy Fortress/i, /Secure access/i, /Email \*/i] },
  { name: "sign-up", pathname: "/sign-up", patterns: [/Legacy Fortress/i, /Create account/i] },
  { name: "auth-callback-invalid", pathname: "/auth/callback?token_hash=invalid&type=signup", patterns: [/Authentication/i, /Go to sign in/i] },
  { name: "dashboard", pathname: "/app/dashboard", patterns: [/Overview/i, /Bill Smith/i] },
  { name: "bank", pathname: "/finances/bank", patterns: [/HSBC/i, /attachment/i] },
  { name: "contacts", pathname: "/personal/contacts", patterns: [/Contacts in place/i, /Executors/i] },
  { name: "admin", pathname: "/internal/admin/prototype/enterprise?role=enterprise_admin&admin=true&prototype=true", patterns: [/Access denied/i, /Admin access is restricted/i] },
];

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL: BASE_URL,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  const results = [];
  const publicRouteNames = new Set(["sign-in", "sign-up", "auth-callback-invalid"]);
  for (const route of routes.filter((item) => publicRouteNames.has(item.name))) {
    try {
      results.push(await verifyRoute(page, route));
    } catch (error) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      throw new Error(`Mobile polish failed for ${route.name} at ${page.url()}: ${bodyText.slice(0, 1200)}`, { cause: error });
    }
  }

  await page.goto("/demo");
  await page.getByRole("button", { name: /open demo account/i }).click();
  const demoReady = await waitForDemoDashboardOrUnavailable(page);

  for (const route of routes.filter((item) => !publicRouteNames.has(item.name))) {
    if (!demoReady) continue;
    try {
      results.push(await verifyRoute(page, route));
    } catch (error) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      throw new Error(`Mobile polish failed for ${route.name} at ${page.url()}: ${bodyText.slice(0, 1200)}`, { cause: error });
    }
  }

  console.log(JSON.stringify({
    mobilePolish: {
      baseUrl: BASE_URL,
      artifactDir: ARTIFACT_DIR,
      mode: demoReady ? "demo_seeded_routes" : "public_only_demo_unavailable",
      routes: results,
    },
  }, null, 2));
} finally {
  await browser.close();
}

async function verifyRoute(page, route) {
  await page.goto(route.pathname, { waitUntil: "networkidle" });
  if (/\/app\/onboarding/.test(page.url())) {
    await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  }

  for (const pattern of route.patterns) {
    await page.waitForFunction(({ source, flags }) => {
      return new RegExp(source, flags).test(document.body?.innerText ?? "");
    }, { source: pattern.source, flags: pattern.flags });
  }

  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0.01,
        };
      })
      .filter((item) => item.visible && item.width > 0 && item.height > 0 && (item.right > viewportWidth + 2 || item.left < -2))
      .slice(0, 12);

    const tapTargets = Array.from(document.querySelectorAll("button, a[href], input, select, textarea"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.getAttribute("aria-label") || element.textContent || element.getAttribute("placeholder") || element.getAttribute("name") || "";
        return {
          label: label.trim().replace(/\s+/g, " ").slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((item) => item.visible && item.label);

    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      offenders,
      smallTapTargets: tapTargets.filter((item) => item.height < 40 || item.width < 40).slice(0, 10),
    };
  });

  const screenshotPath = path.join(ARTIFACT_DIR, `${route.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  assert.equal(metrics.hasHorizontalOverflow, false, `${route.pathname} overflowed horizontally: ${JSON.stringify(metrics.offenders, null, 2)}`);
  assert.equal(metrics.offenders.length, 0, `${route.pathname} has off-canvas elements: ${JSON.stringify(metrics.offenders, null, 2)}`);

  return {
    name: route.name,
    pathname: route.pathname,
    screenshotPath,
    overflowFree: true,
    smallTapTargets: metrics.smallTapTargets,
  };
}

async function waitForDemoDashboardOrUnavailable(page) {
  const outcome = await Promise.race([
    page.waitForURL(/\/(?:app\/)?dashboard/, { timeout: 45000 }).then(() => "dashboard"),
    page.waitForFunction(() => {
      const alert = document.querySelector("[role='alert']");
      const text = alert?.textContent?.trim() ?? "";
      return Boolean(text) && !/^Opening the /i.test(text);
    }, null, { timeout: 45000 }).then(() => "alert"),
  ]);

  if (outcome === "dashboard") {
    await page.getByText(/Demo account · Review environment/i).waitFor({ timeout: 45000 });
    return true;
  }

  const alertText = await page.evaluate(() => Array.from(document.querySelectorAll("[role='alert']"))
    .map((item) => item.textContent?.trim() ?? "")
    .find(Boolean) ?? "");
  if (/unavailable/i.test(alertText)) return false;
  throw new Error(`Demo did not open: ${alertText}`);
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
