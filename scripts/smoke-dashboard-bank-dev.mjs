import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.LOCAL_SMOKE_BASE_URL || "http://127.0.0.1:3000";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/app/dashboard?lf_dev_smoke=1&lf_dev_variant=fixture`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    assert.ok(page.url().includes("/app/dashboard"), "dashboard route did not load");
    const dashboardText = await page.content();
    assert.ok(!/Could not load dashboard: Wallet resolution failed/i.test(dashboardText), "legacy dashboard wallet failure still rendered");
    assert.ok(/Dashboard|Finances|Profile summary/i.test(dashboardText), "dashboard shell did not render");

    await page.goto(`${baseUrl}/finances/bank?lf_dev_smoke=1&lf_dev_variant=empty`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const addButton = page.getByRole("button", { name: /Add bank account|Add bank record/i }).first();
    const addButtonCount = await addButton.count();
    if (addButtonCount === 0) {
      const bankDebugText = (await page.textContent("body")) ?? "";
      throw new Error(`bank add button missing. url=${page.url()} body=${bankDebugText.slice(0, 500)}`);
    }
    await addButton.click();
    await page.waitForTimeout(350);
    const emptyBankText = await page.content();
    assert.ok(/No bank accounts yet/i.test(emptyBankText), "bank empty state did not render");
    assert.ok(/Guided bank record capture|Save bank record/i.test(emptyBankText), "guided capture did not open from empty state");
    assert.ok(/Stage files for this record|Browse document/i.test(emptyBankText), "upload staging area not visible in guided capture");

    await page.goto(`${baseUrl}/finances/bank?lf_dev_smoke=1&lf_dev_variant=fixture`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const fixtureBankText = await page.content();
    assert.ok(/Smoke HSBC Current Account/i.test(fixtureBankText), "fixture bank record card not rendered");
    assert.ok(/HSBC/i.test(fixtureBankText), "fixture provider text/logo context missing");

    console.log("PASS: dashboard renders in dev smoke mode without wallet failure banner");
    console.log("PASS: bank empty state renders and guided capture opens");
    console.log("PASS: bank fixture record renders for summary/card verification");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
