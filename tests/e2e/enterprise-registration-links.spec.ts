import { expect, test } from "@playwright/test";

const RUN = process.env.RUN_ENTERPRISE_BROWSER === "1";
const organisationId = "11111111-1111-4111-8111-111111111111";
const licenceId = "22222222-2222-4222-8222-222222222222";

test.describe("Enterprise registration links", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!RUN, "Set RUN_ENTERPRISE_BROWSER=1 to run the browser interaction fixture.");
    await page.addInitScript(() => {
      window.localStorage.setItem("sb-127-auth-token", JSON.stringify({
        access_token: "local-browser-test-token",
        refresh_token: "local-browser-test-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: { id: "33333333-3333-4333-8333-333333333333", email: "enterprise-admin@local.test", user_metadata: { full_name: "Enterprise Admin" } },
      }));
    });
    await page.route("**/api/internal/admin/session", (route) => route.fulfill({ json: {
      ok: true,
      admin: { role: "enterprise_admin", displayName: "Enterprise Admin", email: "enterprise-admin@local.test", capabilities: ["enterprise.workspace.access", "organisation:view", "enterprise.enrolment_link.manage"] },
    } }));
    await page.route("**/api/internal/admin/enterprise**", async (route) => {
      if (route.request().method() === "POST") return route.fulfill({ json: { ok: true, portfolio: portfolio() } });
      return route.fulfill({ json: { ok: true, portfolio: portfolio() } });
    });
  });

  test("shows the registration workflow and submits a canonical link action", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => { if (request.method() === "POST") requests.push(request.postData() ?? ""); });
    await page.goto("/enterprise?tab=registration-links");
    await expect(page.getByRole("heading", { name: "Registration links" })).toBeVisible();
    await page.getByLabel("Organisation").first().selectOption(organisationId);
    await page.getByLabel("Licence").first().selectOption(licenceId);
    await page.getByLabel("Link name").fill("Hosted synthetic registration");
    await page.getByRole("button", { name: "Create registration link" }).click();
    expect(requests.some((body) => body.includes("create_enrolment_link"))).toBe(true);
    await expect(page.getByText("Registration status is operational metadata.")).toBeVisible();
  });
});

function portfolio() {
  return {
    summary: { organisations: 1, activeLicences: 1, renewalsDue: 0, pendingInvitations: 0, atRiskOrganisations: 0, consentRestricted: 0, seats: { purchased: 10, allocated: 0, active: 0, invited: 0, suspended: 0, available: 10 } },
    organisations: [{ id: organisationId, name: "Synthetic Organisation", legalName: "Synthetic Organisation Ltd", tradingName: null, type: "employer", typeOther: null, registrationNumber: null, country: "GB", registeredAddress: {}, operatingAddress: {}, sameOperatingAddress: true, status: "active", risk: "normal", primaryContactName: null, primaryContactEmail: null, primaryContactTelephone: null, website: null, accountOwner: "Platform", contractReference: null, customerReference: null, onboardingStatus: "complete", onboardingNotes: null, nominatedAdminName: "Enterprise Admin", nominatedAdminEmail: "enterprise-admin@local.test", nominatedAdminRequireMfa: false, nominatedAdminExpiryDays: 14, archivedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
    licences: [{ id: licenceId, organisationId, plan: "starter", customPlanName: null, contractReference: null, billingReference: null, startDate: "2026-01-01", renewalDate: "2027-01-01", endDate: null, renewalNoticeDays: 90, autoRenew: false, renewalNotes: null, purchasedSeats: 10, allocatedSeats: 0, committedSeats: 0, activeSeats: 0, invitedSeats: 0, suspendedSeats: 0, availableSeats: 10, unclaimedSeats: 10, billingStatus: "active", status: "active", accountOwner: "Platform", renewalRisk: "normal", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
    invitations: [], memberships: [], enrolmentLinks: [], consent: {}, adoptionBands: [], savedViews: [], reports: [], reportRows: { portfolio: 1, invitationStatus: {}, membershipStatus: {}, enrolmentLinkStatus: {}, consentReadiness: [] }, risk: [], privacyBoundary: { vaultContentExcluded: true, documentContentExcluded: true, financialValuesExcluded: true, reportingMinimumCohort: 5 },
  };
}
