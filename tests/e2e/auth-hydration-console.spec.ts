import { expect, test } from "@playwright/test";

const authRoutes = ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password?token_hash=invalid&type=recovery"];

test.describe("Auth page hydration console", () => {
  for (const route of authRoutes) {
    test(`does not emit hydration mismatch warnings on ${route}`, async ({ page }) => {
      const hydrationMessages: string[] = [];
      page.on("console", (message) => {
        const text = message.text();
        if (/hydration|hydrating|server rendered html|did not match|Multiple GoTrueClient instances/i.test(text)) {
          hydrationMessages.push(text);
        }
      });
      page.on("pageerror", (error) => {
        const text = error.message;
        if (/hydration|hydrating|server rendered html|did not match|Multiple GoTrueClient instances/i.test(text)) {
          hydrationMessages.push(text);
        }
      });

      await page.goto(route);
      await page.waitForLoadState("networkidle");

      expect(hydrationMessages).toEqual([]);
    });
  }
});
