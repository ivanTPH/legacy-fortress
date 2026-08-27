import { expect, test } from "@playwright/test";

const RUN = process.env.RUN_PLATFORM_ADMIN_BROWSER === "1";
const organisationId = "11111111-1111-4111-8111-111111111111";
const licenceId = "22222222-2222-4222-8222-222222222222";

test.describe("Platform organisation control centre interactions", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!RUN, "Set RUN_PLATFORM_ADMIN_BROWSER=1 to run the browser interaction fixture.");
    await page.addInitScript(() => {
      window.localStorage.setItem("sb-127-auth-token", JSON.stringify({
        access_token: "local-browser-test-token",
        refresh_token: "local-browser-test-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: { id: "33333333-3333-4333-8333-333333333333", email: "platform-admin@local.test", user_metadata: { full_name: "Platform Admin" } },
      }));
    });
    await page.route("**/api/internal/admin/session", (route) => route.fulfill({ json: {
      ok: true,
      admin: {
        role: "super_admin",
        displayName: "Platform Admin",
        email: "platform-admin@local.test",
        capabilities: ["organisation:view", "organisation:manage", "licence:create", "enterprise.invitation.manage", "admin.dashboard.read", "audit:read"],
      },
    } }));
    await page.route("**/api/internal/admin/enterprise**", async (route) => {
      if (route.request().method() === "POST") return route.fulfill({ json: { ok: true, organisation: { id: organisationId }, licence: { id: licenceId } } });
      return route.fulfill({ json: {
        ok: true,
        detail: {
          organisation: { id: organisationId, name: "Synthetic Organisation", legalName: "Synthetic Organisation Ltd", tradingName: null, type: "employer", registrationNumber: null, country: "GB", primaryContactName: "Operator", primaryContactEmail: "operator@local.test", accountOwner: "Platform", nominatedAdminName: null, nominatedAdminEmail: null, onboardingStatus: "not_started", status: "active", risk: "normal", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
          licences: [], invitations: [], memberships: [], enrolmentLinks: [], auditEvents: [],
          privacyBoundary: { vaultContentExcluded: true, documentContentExcluded: true, financialValuesExcluded: true },
        },
      } });
    });
  });

  test("opens and closes each commercial action surface without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/admin/organisations/${organisationId}`);
    await expect(page.getByRole("heading", { name: "Synthetic Organisation" })).toBeVisible();

    await page.getByRole("button", { name: "Edit organisation" }).click();
    await expect(page.getByRole("dialog", { name: "Edit organisation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Allocate licence" }).click();
    await expect(page.getByRole("dialog", { name: "Allocate licence" })).toBeVisible();
    await page.getByLabel("Purchased licences").fill("10");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Invite administrator" }).click();
    await expect(page.getByRole("dialog", { name: "Invite organisation administrator" })).toBeVisible();
    await page.getByLabel("Email").fill("synthetic-admin@local.test");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByRole("dialog", { name: "Suspend organisation" })).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("uses canonical navigation targets and submits an action through the API", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/internal/admin/enterprise")) requests.push(request.postData() ?? ""); });
    await page.goto(`/admin/organisations/${organisationId}`);
    await expect(page.getByRole("link", { name: "View registration detail" })).toHaveAttribute("href", `/admin/organisations/${organisationId}/invitations`);
    await expect(page.getByRole("link", { name: "Open Enterprise Operations" })).toHaveAttribute("href", "/enterprise");
    await expect(page.getByRole("link", { name: "Open invitation history" })).toHaveAttribute("href", `/admin/organisations/${organisationId}/invitations`);
    await expect(page.getByRole("link", { name: "Open Platform Audit" })).toHaveAttribute("href", `/admin/audit?resource=organisation:${organisationId}`);

    await page.getByRole("button", { name: "Edit organisation" }).click();
    await page.getByLabel("Trading name").fill("Synthetic Updated");
    await page.getByRole("button", { name: "Save organisation" }).click();
    await expect(page.getByRole("status")).toContainText("completed");
    expect(requests.some((body) => body.includes("update_organisation"))).toBe(true);
  });
});
