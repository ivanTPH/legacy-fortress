import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.LOCAL_SMOKE_BASE_URL || "http://127.0.0.1:3000";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/dashboard?lf_dev_smoke=1&lf_dev_variant=fixture`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    assert.ok(page.url().includes("/dashboard"), "dashboard route did not load");
    const dashboardText = await page.content();
    assert.ok(!/Could not load dashboard: Wallet resolution failed/i.test(dashboardText), "legacy dashboard wallet failure still rendered");
    assert.ok(/Dashboard|Finances|Profile summary/i.test(dashboardText), "dashboard shell did not render");

    await page.goto(`${baseUrl}/finances/bank?lf_dev_smoke=1&lf_dev_variant=fixture`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForURL(/\/sign-in/, { timeout: 30000 });
    await page.getByRole("heading", { name: /Sign in/i }).waitFor({ timeout: 30000 });

    console.log("PASS: dashboard renders in dev smoke mode without wallet failure banner");
    console.log("PASS: bank fixture route requires a signed-in session before records are exposed");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
