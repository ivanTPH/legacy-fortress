import { expect, type Page, test } from "@playwright/test";

const hasAuthCredentials =
  Boolean(process.env.E2E_USER_EMAIL)
  && Boolean(process.env.E2E_USER_PASSWORD);

export function requireAuthFixture() {
  test.skip(!hasAuthCredentials, "E2E_USER_EMAIL and E2E_USER_PASSWORD are required for authenticated flows.");
}

export async function signInAsSeedUser(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/(app\/dashboard|app\/onboarding|dashboard|onboarding)/);

  if (page.url().includes("/onboarding")) {
    // Guided set-up (10 Nov 2026): confirm the name, then skip straight to the Vault.
    const confirm = page.getByRole("button", { name: /yes, continue|^continue$/i });
    if (await confirm.count()) await confirm.click();
    await page.getByRole("button", { name: /skip, i.ll explore on my own/i }).click();
    await expect(page).toHaveURL(/\/(app\/dashboard|dashboard)/);
  }
}
