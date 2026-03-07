import { expect, type Page, test } from "@playwright/test";

const hasAuthCredentials =
  Boolean(process.env.E2E_USER_EMAIL)
  && Boolean(process.env.E2E_USER_PASSWORD);

export function requireAuthFixture() {
  test.skip(!hasAuthCredentials, "E2E_USER_EMAIL and E2E_USER_PASSWORD are required for authenticated flows.");
}

export async function signInAsSeedUser(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);

  if (page.url().includes("/onboarding")) {
    const terms = page.getByLabel(/i accept the terms and conditions/i);
    if (await terms.count()) {
      await terms.check();
      await page.getByRole("button", { name: /go to dashboard/i }).click();
    }
    await expect(page).toHaveURL(/\/dashboard/);
  }
}
