#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { webkit } from "@playwright/test";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

const browser = await webkit.launch();

try {
  const context = await browser.newContext({ baseURL: BASE_URL, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(35000);

  await page.goto("/demo");
  await page.getByRole("heading", { name: /review the product safely/i }).waitFor();
  await page.getByRole("button", { name: /open demo account/i }).click();

  await page.waitForURL(/\/app\/dashboard/, { timeout: 45000 });
  await page.getByText("Demo account · Review environment").waitFor();
  await page.getByText(/Viewing Bill Smith's estate records/i).waitFor();
  await page.getByText(/Bill Smith/i).waitFor();
  await page.getByText(/4250/i).waitFor({ timeout: 15000 }).catch(() => page.getByText(/£/i).first().waitFor());

  const navText = await page.locator("body").innerText();
  assert.equal(/Admin operations/i.test(navText), false);
  assert.equal(/\bContacts\b/i.test(navText), true);

  await openLinkedRoute(page, "/finances/bank");
  await page.getByText(/HSBC/i).waitFor();
  await page.getByText(/bank-statement-summary\.txt/i).waitFor();

  await openLinkedRoute(page, "/legal");
  await page.getByRole("link", { name: /Wills/i }).waitFor();
  await openLinkedRoute(page, "/legal/wills");
  await page.getByText(/Last Will and Testament/i).waitFor();
  await page.getByText(/will-overview\.txt/i).first().waitFor();

  await openLinkedRoute(page, "/personal/contacts");
  await page.getByRole("heading", { name: /Contacts/i }).waitFor();
  await page.getByText(/Sarah Smith/i).waitFor();
  await page.getByText(/Emma Carter/i).waitFor();
  await page.getByText(/James Patel/i).waitFor();

  await openLinkedRoute(page, "/profile");
  await page.getByRole("heading", { name: /^profile$/i }).waitFor();
  const profileText = await page.locator("body").innerText();
  assert.equal(/Bill Smith/i.test(profileText), true);
  assert.equal(/07700\s*900210|01904\s*555204/i.test(profileText), true);
  assert.equal(/YO1\s*2AB/i.test(profileText), true);
  assert.equal(/bill\.smith\.demo\.owner@legacyfortress\.test/i.test(profileText), true);

  await openLinkedRoute(page, "/internal/admin");
  await page.getByText(/Access denied/i).waitFor();

  console.log(JSON.stringify({
    demoEntryWorked: true,
    landedInLinkedView: true,
    dashboardPopulated: true,
    profilePopulated: true,
    legalPopulated: true,
    contactsPopulated: true,
    attachmentsVisible: true,
    adminBlocked: true,
    routesChecked: [
      "/demo",
      "/app/dashboard",
      "/finances/bank",
      "/legal",
      "/legal/wills",
      "/personal/contacts",
      "/profile",
      "/internal/admin",
    ],
  }, null, 2));
} finally {
  await browser.close();
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

async function openLinkedRoute(page, pathname) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(pathname);
    await page.waitForLoadState("networkidle");
    if (!/\/app\/onboarding/.test(page.url())) return;
    await page.goto("/app/dashboard");
    await page.getByText(/Viewing Bill Smith's estate records/i).waitFor();
  }
  throw new Error(`Linked route ${pathname} redirected to onboarding twice.`);
}
