import { expect, test, type Page } from "@playwright/test";

const ownerEmail = process.env.PREVIEW_UAT_OWNER_EMAIL ?? "owner-uat-20260629@legacyfortress.test";
const ownerPassword = process.env.PREVIEW_UAT_OWNER_PASSWORD ?? "LegacyFortressUat123!";
const runId = Date.now();

test.describe("Preview-readiness release gate", () => {
  test.beforeEach(async ({ page }) => {
    await signInOwner(page);
  });

  test("dashboard global search and seeded route retrieval are visible after data load", async ({ page }) => {
    await page.goto("/dashboard?search=UAT%20Maple");
    await expect(page.getByRole("heading", { name: /search results/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /UAT Maple Bank Current Account/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /synthetic-bank-statement\.pdf/i }).first()).toBeVisible();

    await expectSeededRecord(page, "/legal/wills", "UAT Last Will and Testament");
    await expectSeededRecord(page, "/vault/property", "UAT Harbour View Flat");
    await expectSeededRecord(page, "/cars-transport", "UAT Blue Hatchback");
    await expectSeededRecord(page, "/employment", "UAT Example Consulting Role");
    await expectSeededRecord(page, "/vault/personal", "UAT Grandmother Clock");
    await expectSeededRecord(page, "/identity-documents", "UAT Identity Document Pack");
  });

  test("identity documents use one canonical path for create, search, edit, refresh, and delete", async ({ page }) => {
    const title = `Preview Gate Passport ${runId}`;
    const editedTitle = `${title} Edited`;

    await page.goto("/identity-documents");
    await expect(page.getByRole("heading", { name: /existing records/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^add record$/i })).toBeVisible();
    await page.getByRole("button", { name: /^add record$/i }).click();
    await page.getByLabel("Document title").fill(title);
    await page.getByLabel("Document type").selectOption({ index: 1 });
    await page.getByLabel("Document number").fill(`PG-${runId}`);
    await page.getByLabel("Issuing country").selectOption({ index: 1 });
    await page.getByLabel("Issue date").fill("2026-01-15");
    await page.getByLabel("Renewal / expiry date").fill("2031-01-15");
    await page.getByLabel("Notes").fill("Synthetic Preview gate identity document.");
    await page.getByRole("button", { name: /^save record$/i }).click();
    await expect(page.getByText(/record added securely|changes saved securely/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 15_000 });
    await searchWorkspace(page, title);
    await expect(page.getByText(title, { exact: false })).toBeVisible();

    const card = page.locator("article").filter({ hasText: title }).first();
    await card.getByRole("button", { name: /edit record/i }).click();
    await page.getByLabel("Document title").fill(editedTitle);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/changes saved securely/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(editedTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await searchWorkspace(page, editedTitle);
    await expect(page.getByText(editedTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("article").filter({ hasText: editedTitle }).first().getByRole("button", { name: /delete record|delete/i }).click();
    await expect(page.getByText(/record deleted/i)).toBeVisible({ timeout: 15_000 });
    await searchWorkspace(page, editedTitle);
    await expect(page.getByText(editedTitle, { exact: false })).toHaveCount(0);
  });

  test("contacts search finds seeded executor after refresh", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page.getByRole("textbox", { name: /^search contacts$/i })).toBeVisible();
    await page.reload();
    await page.getByRole("textbox", { name: /^search contacts$/i }).fill("Maya Patel");
    await expect(page.getByText("Maya Patel", { exact: false })).toBeVisible();
    await expect(page.getByText(/executor/i).first()).toBeVisible();
  });

  test("owner sign-out then demo opens read-only reviewer context", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.goto("/demo");
    const demoSession = page.waitForResponse((response) => response.url().includes("/api/demo/session"));
    await page.getByRole("button", { name: /open demo account/i }).click();
    await expect((await demoSession).ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    await expect(page.getByText("Estate owner context")).toBeVisible();
    await expect(page.getByText("Viewing Bill Smith's estate records")).toBeVisible();
    await expect(page.getByText(/Signed-in reviewer: Legacy Fortress Demo Reviewer/i)).toBeVisible();
    await expect(page.getByText(/View-only/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /add bank record|add contact|upload document|delete record/i })).toHaveCount(0);
  });
});

async function signInOwner(page: Page) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  if (!/sign-in/.test(page.url())) return;
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').first().click();
  await page.keyboard.type(ownerEmail);
  await page.locator('input[type="password"]').first().click();
  await page.keyboard.type(ownerPassword);
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByText(/Checking session/i)).toHaveCount(0);
}

async function expectSeededRecord(page: Page, path: string, title: string) {
  await page.goto(path);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 15_000 });
}

async function searchWorkspace(page: Page, value: string) {
  const search = page.getByLabel(/^search$/i).first();
  if (await search.count()) {
    await search.fill(value);
    return;
  }
  await page.getByPlaceholder(/search/i).first().fill(value);
}
