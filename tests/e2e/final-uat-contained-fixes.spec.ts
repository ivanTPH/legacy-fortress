import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const runId = Date.now();
const email = `final-uat-executor-${runId}@example.test`;
const password = "FinalUatExecutor123!";
let userId = "";

test.describe("Final UAT contained fixes", () => {
  test.beforeAll(async () => {
    test.skip(!supabaseUrl || !supabaseAnonKey || !databaseUrl, "Local Supabase URL, anon key, and DB URL are required.");
    userId = await signUpSyntheticUser(email);
    confirmSyntheticUser(userId);
    markOnboardingComplete(userId);
  });

  test.afterAll(async () => {
    deleteSyntheticUsers([userId].filter(Boolean));
  });

  test("forgot password explains the disabled empty-email state", async ({ page }) => {
    await page.goto("/forgot-password");
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("aria-describedby", "forgot-password-email-help");
    await expect(page.getByText(/enter your email address to enable the reset link button/i)).toBeVisible();

    const button = page.getByRole("button", { name: /send reset link/i });
    await expect(button).toBeDisabled();
    await emailInput.fill("final-uat-reset@example.test");
    await expect(page.getByText(/we will send the reset link to this email address/i)).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test("executors route redirects to executor contacts without runtime performance errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/sign-in?next=%2Fexecutors");
    await page.getByLabel("Email").fill(email);
    await page.getByPlaceholder("Enter your password").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/executors|\/contacts\?group=executors/);
    await expect(page.locator("body")).not.toContainText(/Checking session/i);
    expect(pageErrors.filter((message) => /ExecutorsRedirectPage|negative time stamp|performance/i.test(message))).toEqual([]);
  });
});

async function signUpSyntheticUser(recipient: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signUp({
    email: recipient,
    password,
  });
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error(`Supabase did not return a user id for ${recipient}.`);
  return id;
}

function confirmSyntheticUser(id: string) {
  runPsql(`
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = ${uuidLiteral(id)};
  `);
}

function markOnboardingComplete(id: string) {
  const now = new Date().toISOString();
  runPsql(`
    insert into public.user_onboarding_state (
      user_id,
      current_step,
      completed_steps,
      is_completed,
      terms_accepted,
      marketing_opt_in,
      updated_at
    )
    values (
      ${uuidLiteral(id)},
      'complete',
      array['identity', 'verification', 'consent', 'personal_details', 'vault_categories', 'complete']::text[],
      true,
      true,
      false,
      ${stringLiteral(now)}::timestamptz
    )
    on conflict (user_id) do update
    set current_step = excluded.current_step,
        completed_steps = excluded.completed_steps,
        is_completed = excluded.is_completed,
        terms_accepted = excluded.terms_accepted,
        marketing_opt_in = excluded.marketing_opt_in,
        updated_at = excluded.updated_at;

    insert into public.terms_acceptances (
      user_id,
      terms_version,
      accepted,
      accepted_at,
      source,
      updated_at
    )
    values (
      ${uuidLiteral(id)},
      'legacy-fortress-2026-03',
      true,
      ${stringLiteral(now)}::timestamptz,
      'final-uat-contained-fixes',
      ${stringLiteral(now)}::timestamptz
    )
    on conflict (user_id) do update
    set terms_version = excluded.terms_version,
        accepted = excluded.accepted,
        accepted_at = excluded.accepted_at,
        source = excluded.source,
        updated_at = excluded.updated_at;
  `);
}

function deleteSyntheticUsers(ids: string[]) {
  if (!ids.length || !databaseUrl) return;
  runPsql(`
    delete from auth.users
    where id in (${ids.map(uuidLiteral).join(",")});
  `);
}

function runPsql(sql: string) {
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

function uuidLiteral(value: string) {
  const normalized = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`Invalid UUID literal: ${value}`);
  }
  return `${stringLiteral(normalized)}::uuid`;
}

function stringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
