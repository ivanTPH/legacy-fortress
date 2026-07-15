import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const runId = Date.now();
const completedEmail = `phase1-complete-${runId}@example.test`;
const onboardingEmail = `phase1-onboarding-${runId}@example.test`;
const password = "Phase1Auth123!";

let completedUserId = "";
let onboardingUserId = "";

test.describe("Phase 1 authenticated session persistence", () => {
  test.beforeAll(async () => {
    test.skip(
      !supabaseUrl || !supabaseAnonKey || !databaseUrl,
      "Local Supabase URL, anon key, and database URL are required for the Phase 1 auth persistence verification.",
    );

    completedUserId = await signUpSyntheticUser(completedEmail);
    onboardingUserId = await signUpSyntheticUser(onboardingEmail);
    confirmSyntheticUser(completedUserId);
    confirmSyntheticUser(onboardingUserId);
    await markOnboardingComplete(completedUserId);
  });

  test.afterAll(async () => {
    deleteSyntheticUsers([completedUserId, onboardingUserId].filter(Boolean));
  });

  test("sign in, preserve deep link, refresh dashboard, navigate repeatedly, and sign out", async ({ page }) => {
    await page.goto("/finances/bank");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Ffinances%2Fbank/);

    await page.getByLabel("Email").fill(completedEmail);
    await page.getByPlaceholder("Enter your password").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/finances\/bank/);
    await expect(page.getByRole("heading", { name: /Checking session/i })).toHaveCount(0);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Checking session/i })).toHaveCount(0);

    for (const route of ["/profile", "/finances/bank", "/dashboard"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/sign-in/);
      await page.reload();
      await expect(page).not.toHaveURL(/\/sign-in/);
      await expect(page.getByRole("heading", { name: /Checking session/i })).toHaveCount(0);
    }

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("onboarding-required users are redirected to onboarding without being granted protected access", async ({ page }) => {
    await page.goto("/sign-in?next=%2Ffinances%2Fbank");
    await page.getByLabel("Email").fill(onboardingEmail);
    await page.getByPlaceholder("Enter your password").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/onboarding\?required=1/);
    await expect(page.getByRole("heading", { name: /welcome to legacy fortress/i })).toBeVisible();
    await expect(page).not.toHaveURL(/\/finances\/bank/);
  });
});

async function signUpSyntheticUser(email: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error(`Supabase did not return a user id for ${email}.`);
  return userId;
}

function confirmSyntheticUser(userId: string) {
  const userIdLiteral = uuidLiteral(userId);
  runPsql(
    `
      update auth.users
      set email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = ${userIdLiteral};
    `,
  );
}

async function markOnboardingComplete(userId: string) {
  const now = new Date().toISOString();
  const userIdLiteral = uuidLiteral(userId);
  const nowLiteral = stringLiteral(now);
  runPsql(
    `
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
        ${userIdLiteral},
        'complete',
        array['identity', 'verification', 'consent', 'personal_details', 'vault_categories', 'complete']::text[],
        true,
        true,
        false,
        ${nowLiteral}::timestamptz
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
        ${userIdLiteral},
        'legacy-fortress-2026-03',
        true,
        ${nowLiteral}::timestamptz,
        'phase1-auth-session-test',
        ${nowLiteral}::timestamptz
      )
      on conflict (user_id) do update
      set terms_version = excluded.terms_version,
          accepted = excluded.accepted,
          accepted_at = excluded.accepted_at,
          source = excluded.source,
          updated_at = excluded.updated_at;
    `,
  );
}

function deleteSyntheticUsers(userIds: string[]) {
  if (!userIds.length || !databaseUrl) return;
  const ids = userIds.map(uuidLiteral).join(",");
  runPsql(
    `
      delete from auth.users
      where id in (${ids});
    `,
  );
}

function runPsql(sql: string) {
  const args = [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql];
  execFileSync("psql", args, { stdio: "pipe" });
}

function uuidLiteral(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid UUID literal: ${value}`);
  }
  return `${stringLiteral(value)}::uuid`;
}

function stringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
