import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:55424";
const runId = Date.now();
const email = `phase2-email-${runId}@example.test`;
const initialPassword = "Phase2Email123!";
const resetPassword = "Phase2EmailReset123!";

test.describe("Phase 2 local auth emails", () => {
  test.skip(!databaseUrl, "SUPABASE_DB_URL is required to clean up synthetic local auth users.");

  test.afterAll(async () => {
    deleteSyntheticUser(email);
  });

  test("sign-up confirmation and password reset links complete in the local application", async ({ page, context }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password *").fill(initialPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/verify your email/i)).toBeVisible();

    const confirmation = await waitForMail(email, /confirm your email/i);
    expect(confirmation.link).toContain("/auth/v1/verify");
    await page.goto(confirmation.link);
    await expect(page).toHaveURL(/\/onboarding|\/dashboard|\/profile|\/sign-in|\/$/);
    await expect(page.getByText(/sign-in failed|invalid|expired/i)).toHaveCount(0);

    await context.clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByPlaceholder("Enter your password").fill(initialPassword);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/sign-in$/);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/password reset link sent/i)).toBeVisible();

    const reset = await waitForMail(email, /reset your password|reset password/i);
    expect(reset.link).toContain("/auth/v1/verify");
    await page.goto(reset.link);
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByText(/recovery link verified/i)).toBeVisible();

    await page.getByLabel("New password").fill(resetPassword);
    await page.getByLabel("Confirm password").fill(resetPassword);
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByText(/password updated successfully/i)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel("Email").fill(email);
    await page.getByPlaceholder("Enter your password").fill(resetPassword);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/sign-in$/);
  });
});

async function waitForMail(recipient: string, subjectPattern: RegExp) {
  const deadline = Date.now() + 45_000;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const list = await fetch(`${mailpitUrl}/api/v1/messages?limit=50`);
      if (!list.ok) throw new Error(`Mailpit list failed with ${list.status}`);
      const payload = await list.json();
      const found = payload.messages?.find((message: MailpitMessageSummary) => {
        return (
          subjectPattern.test(message.Subject) &&
          message.To?.some((to) => to.Address.toLowerCase() === recipient.toLowerCase())
        );
      });
      if (found?.ID) {
        const detail = await fetch(`${mailpitUrl}/api/v1/message/${found.ID}`);
        if (!detail.ok) throw new Error(`Mailpit detail failed with ${detail.status}`);
        const message = await detail.json();
        const link = extractFirstLink(`${message.HTML ?? ""}\n${message.Text ?? ""}`);
        if (link) return { id: found.ID, link };
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for ${recipient} mail matching ${subjectPattern}. Last error: ${String(lastError)}`);
}

function extractFirstLink(content: string) {
  const htmlHref = content.match(/href="([^"]+)"/i)?.[1];
  const textHref = content.match(/https?:\/\/[^\s)"]+/i)?.[0];
  return decodeHtmlEntities(htmlHref ?? textHref ?? "");
}

function decodeHtmlEntities(value: string) {
  return value.replaceAll("&amp;", "&");
}

function deleteSyntheticUser(recipient: string) {
  if (!databaseUrl || !recipient) return;
  runPsql(`
    delete from auth.users
    where email = ${stringLiteral(recipient)};
  `);
}

function runPsql(sql: string) {
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

function stringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

type MailpitMessageSummary = {
  ID: string;
  Subject: string;
  To?: Array<{ Address: string }>;
};
