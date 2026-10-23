import { expect, test } from "@playwright/test";

test("normal browser keeps the existing sign-in entry", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sign-in destinations" })).toHaveCount(0);
});

test("fresh standalone launch offers explicit authorised destinations", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => query === "(display-mode: standalone)"
      ? { ...original(query), matches: true }
      : original(query);
  });

  await page.goto("/pwa-entry", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Choose an interface" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Sign-in destinations" });
  const expected = [
    ["Personal Vault", "/sign-in?next=%2Fdashboard"],
    ["Platform Admin", "/sign-in?next=%2Fadmin"],
    ["Partner Portal", "/sign-in?next=%2Fenterprise"],
  ] as const;
  for (const [label, href] of expected) {
    const link = navigation.getByRole("link", { name: label });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", href);
    expect(href).not.toMatch(/token|session|user_id|role/i);
  }
  const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  await navigation.getByRole("link", { name: "Personal Vault" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
});
