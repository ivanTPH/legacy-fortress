import { expect, test } from "@playwright/test";
import { requireAuthFixture, signInAsSeedUser } from "./helpers/auth";

test.describe("Auth and navigation regressions", () => {
  test("public auth pages load", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();

    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();
  });

  test("signin works with known credentials and can sign out", async ({ page }) => {
    requireAuthFixture();
    await signInAsSeedUser(page);

    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test("desktop nav flyout closes after selection and escape", async ({ page }) => {
    requireAuthFixture();
    await signInAsSeedUser(page);

    await page.goto("/dashboard");
    const legalMenu = page.getByRole("menuitem", { name: /legal/i }).first();
    await legalMenu.click();

    const willsSubmenu = page.getByRole("menuitem", { name: /wills/i }).first();
    await expect(willsSubmenu).toBeVisible();
    await willsSubmenu.click();
    await expect(page).toHaveURL(/\/legal\/wills|\/legal/);
    await expect(willsSubmenu).toBeHidden();

    await legalMenu.click();
    await expect(willsSubmenu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(willsSubmenu).toBeHidden();
  });

  test("outside click and route change always close flyout", async ({ page }) => {
    requireAuthFixture();
    await signInAsSeedUser(page);
    await page.goto("/dashboard");

    const legalMenu = page.getByRole("menuitem", { name: /legal/i }).first();
    const willsSubmenu = page.getByRole("menuitem", { name: /wills/i }).first();

    await legalMenu.click();
    await expect(willsSubmenu).toBeVisible();

    await page.locator(".lf-main-content").click({ position: { x: 20, y: 20 } });
    await expect(willsSubmenu).toBeHidden();

    await legalMenu.click();
    await expect(willsSubmenu).toBeVisible();
    await page.goto("/profile");
    await expect(willsSubmenu).toBeHidden();
  });
});
