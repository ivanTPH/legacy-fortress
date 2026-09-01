import { expect, test } from "@playwright/test";

const email = process.env.LF_E2E_CONTACTS_EMAIL;
const password = process.env.LF_E2E_CONTACTS_PASSWORD;

// This is opt-in because local auth fixtures are intentionally not committed.
test("executor invitation wizard is a single browser workflow", async ({ page }) => {
  test.skip(!email || !password, "Set LF_E2E_CONTACTS_EMAIL and LF_E2E_CONTACTS_PASSWORD for the local synthetic fixture.");

  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/contacts?group=executors");

  await page.getByRole("button", { name: /add person/i }).click();
  await expect(page.getByRole("heading", { name: /invite an executor/i })).toBeVisible();
  await expect(page.getByText(/contacts in place/i)).toHaveCount(0);
  await expect(page.getByText(/my wallet - all/i)).toHaveCount(0);
  await expect(page.getByLabel(/name/i)).toHaveCount(1);
  await expect(page.getByLabel(/email/i)).toHaveCount(1);

  await page.getByLabel(/name/i).fill("LF Synthetic Executor");
  await page.getByLabel(/email/i).fill(`executor-${Date.now()}@local.test`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Choose a role")).toHaveValue("executor");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const categories = page.locator('input[type="checkbox"]');
  await page.getByLabel("Select all categories (view only)").check();
  await expect(page.getByLabel("Select all categories (view only)")).toBeChecked();
  await categories.nth(1).uncheck();
  await expect(page.getByLabel("Select all categories (view only)")).not.toBeChecked();
  await page.getByRole("button", { name: "Review invitation" }).click();
  await expect(page.getByRole("heading", { name: "Review invitation" })).toBeVisible();
});
