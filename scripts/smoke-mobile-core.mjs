#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, devices } from "@playwright/test";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL: BASE_URL,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(35000);

  await page.goto("/demo");
  await page.getByRole("button", { name: /open demo account/i }).click();
  const demoReady = await waitForDemoDashboardOrUnavailable(page);

  const dashboard = demoReady
    ? await verifyMobileRoute(page, "/dashboard", [
        /Overview/i,
        /Bill Smith/i,
      ])
    : await verifyMobileRoute(page, "/dashboard", [/Dashboard/i]);
  const bank = demoReady
    ? await verifyMobileRoute(page, "/finances/bank", [
        /HSBC/i,
        /bank-statement-summary\.txt/i,
        /1 attachment/i,
      ])
    : await verifyMobileRoute(page, "/sign-in", [/Legacy Fortress|Sign in/i]);
  const contacts = demoReady
    ? await verifyMobileRoute(page, "/personal/contacts", [
        /Contacts in place/i,
        /Executors/i,
      ])
    : await verifyMobileRoute(page, "/internal/admin", [/Legacy Fortress|Admin|Dashboard/i]);

  console.log(JSON.stringify({
    mobile: {
      mode: demoReady ? "demo_seeded_routes" : "public_fallback_demo_unavailable",
      dashboard,
      bank,
      contacts,
    },
  }, null, 2));
} finally {
  await browser.close();
}

async function verifyMobileRoute(page, pathname, patterns) {
  await openLinkedRoute(page, pathname);
  for (const pattern of patterns) {
    await page.waitForFunction(({ source, flags }) => {
      const text = document.body?.innerText ?? "";
      return new RegExp(source, flags).test(text);
    }, { source: pattern.source, flags: pattern.flags });
  }
  const bodyText = await page.locator("body").innerText();
  for (const pattern of patterns) {
    assert.match(bodyText, pattern);
  }
  const metrics = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      bodyClientWidth: document.body.clientWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      mainScrollWidth: main instanceof HTMLElement ? main.scrollWidth : 0,
      mainClientWidth: main instanceof HTMLElement ? main.clientWidth : 0,
      touchButtons: Array.from(document.querySelectorAll("button, a[href]"))
        .slice(0, 30)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text: (element.textContent || "").trim().slice(0, 60),
          };
        })
        .filter((item) => item.text.length > 0),
    };
  });

  assert.equal(metrics.hasHorizontalOverflow, false, `${pathname} overflowed horizontally`);
  const smallestTapTarget = metrics.touchButtons.reduce(
    (smallest, current) => (current.height < smallest.height ? current : smallest),
    { height: Number.POSITIVE_INFINITY, width: 0, text: "" },
  );

  return {
    pathname,
    overflowFree: !metrics.hasHorizontalOverflow,
    smallestTapTargetHeight: smallestTapTarget.height,
    smallestTapTargetLabel: smallestTapTarget.text,
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
  if (/unavailable/i.test(alertText)) {
    return false;
  }

  throw new Error(`Demo did not open: ${alertText}`);
}

async function openLinkedRoute(page, pathname) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(pathname);
    } catch (error) {
      if (!/interrupted by another navigation/i.test(String(error))) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => null);
      continue;
    }
    await page.waitForLoadState("networkidle");
    if (!/\/app\/onboarding/.test(page.url())) return;
    await page.goto("/dashboard");
    await page.getByText(/Viewing Bill Smith's estate records/i).waitFor();
  }
  throw new Error(`Linked route ${pathname} redirected to onboarding twice.`);
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
