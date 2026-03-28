const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3008";
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const screenshotDir = process.env.SCREENSHOT_DIR || "";
const screenshotPrefix = process.env.SCREENSHOT_PREFIX || "ux";

if (!email || !password) {
  console.error("Missing E2E_USER_EMAIL or E2E_USER_PASSWORD");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  try {
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: "networkidle" });
    await page.getByLabel("Email *").fill(email);
    await page.getByLabel("Password *").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 60000 });
    } catch (error) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      throw new Error(`Sign-in did not reach dashboard. url=${page.url()} body=${bodyText.slice(0, 600)}`, { cause: error });
    }

    const dashboard = await verifyDashboard(page);
    await capture(page, "dashboard");

    await page.goto(`${baseUrl}/contacts`, { waitUntil: "networkidle" });
    const contacts = await verifyContacts(page);
    await capture(page, "contacts");

    await page.goto(`${baseUrl}/account/my-vault`, { waitUntil: "networkidle" });
    const myVault = await verifyMyVault(page);
    await capture(page, "my-vault");

    await page.goto(`${baseUrl}/cars-transport`, { waitUntil: "networkidle" });
    const cars = await verifyCars(page);
    await capture(page, "cars-transport");

    console.log(JSON.stringify({ baseUrl, dashboard, contacts, myVault, cars }, null, 2));
  } finally {
    await browser.close();
  }
}

async function verifyDashboard(page) {
  const bodyText = await page.locator("body").innerText();
  const topbarTitle = await readOptionalText(page.locator(".lf-topbar-title"));
  const openButtons = await page.locator('.lf-icon-btn[title^="Open "]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("title") || ""),
  );
  const cardTexts = await page.locator('[role="link"][aria-label$="summary"]').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent || ""),
  );
  const addContactVisible = await page.getByText("Add contact", { exact: true }).count();
  const hasOpenLegalTooltip = await page.locator('.lf-icon-btn[title="Open legal records"]').count();
  const hasOpenFinanceTooltip = await page.locator('.lf-icon-btn[title="Open finance records"]').count();
  const hasReviewLegalText = bodyText.includes("Review legal records");
  const hasDuplicateDashboardHeading = (bodyText.match(/Dashboard - Review your estate records/g) || []).length > 1 || /\nDashboard\n/.test(bodyText);

  return {
    topbarTitle: topbarTitle?.trim() || "",
    compactInlineStatsPresent: cardTexts.some((text) => /(£|No records yet|finance record|legal record|property record|business record|digital record|task)/i.test(text)),
    oldTextCtasRemoved: !hasReviewLegalText,
    topRightCardActionsPresent: hasOpenLegalTooltip > 0 && hasOpenFinanceTooltip > 0,
    dashboardQueueOnly: addContactVisible === 0,
    duplicateDashboardHeading: hasDuplicateDashboardHeading,
    cardTexts,
    openButtonTitles: openButtons,
  };
}

async function verifyContacts(page) {
  const reviewToggle = page.getByRole("button", { name: /review invitations & access/i });
  if (await reviewToggle.count()) {
    await reviewToggle.click();
    await page.waitForTimeout(300);
  }
  const bodyText = await page.locator("body").innerText();
  const addContactVisible = await page.getByRole("button", { name: /add contact/i }).count();
  const reviewToggleVisible = await page.getByRole("button", { name: /review invitations & access/i }).count();
  const topbarTitle = await readOptionalText(page.locator(".lf-topbar-title"));
  const editButtons = await page.locator('.lf-icon-btn[title^="Edit "]').count();

  return {
    topbarTitle: topbarTitle?.trim() || "",
    addContactVisible: addContactVisible > 0,
    reviewInvitationsToggleVisible: reviewToggleVisible > 0,
    editActionVisible: editButtons > 0 || /Edit contact|Edit /.test(bodyText),
  };
}

async function verifyMyVault(page) {
  const topbarTitle = await readOptionalText(page.locator(".lf-topbar-title"));
  const checkboxCount = await page.locator('input[type="checkbox"]').count();
  const saveButtonCount = await page.getByRole("button", { name: /save my vault/i }).count();
  return {
    topbarTitle: topbarTitle?.trim() || "",
    checkboxCount,
    saveButtonVisible: saveButtonCount > 0,
  };
}

async function verifyCars(page) {
  const topbarTitle = await readOptionalText(page.locator(".lf-topbar-title"));
  const bodyText = await page.locator("body").innerText();
  return {
    topbarTitle: topbarTitle?.trim() || "",
    bodyHeadingRepeated: /Cars & Transport\nCars & Transport/.test(bodyText),
    attachmentsTextVisible: /transport documentation|owner/i.test(bodyText),
  };
}

async function capture(page, slug) {
  if (!screenshotDir) return;
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, `${screenshotPrefix}-${slug}.png`),
    fullPage: true,
  });
}

async function readOptionalText(locator) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: 3000 });
    return (await locator.first().textContent())?.trim() || "";
  } catch {
    return "";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
