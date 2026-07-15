import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const runId = Date.now();
const ownerEmail = `trusts-collapsible-${runId}@example.test`;
const ownerPassword = "TrustsCollapsible123!";

let ownerUserId = "";

test.describe("Trusts collapsible add-record form", () => {
  test.beforeAll(async () => {
    test.skip(
      !supabaseUrl || !supabaseAnonKey || !databaseUrl || !supabaseUrl.includes("127.0.0.1:55421"),
      "Local Supabase URL, anon key, and database URL are required for Trusts browser proof.",
    );
    test.skip(!(await canReachLocalSupabase()), "Local Supabase is not reachable for Trusts browser proof.");

    ownerUserId = await signUpSyntheticUser(ownerEmail);
    confirmSyntheticUser(ownerUserId);
    markOnboardingComplete(ownerUserId);
  });

  test.afterAll(async () => {
    deleteSyntheticUsers([ownerUserId].filter(Boolean));
  });

  test("opens one create form on demand, protects unsaved data, validates, saves, and returns to existing records", async ({ page }) => {
    await signIn(page);

    await page.goto("/legal/trusts");
    await expect(page.getByText(/^Trusts$/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /existing records/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /add new record/i })).toHaveCount(0);

    const addRecord = page.getByRole("button", { name: /^Add record$/i }).first();
    await expect(addRecord).toBeVisible();
    await expect(addRecord).toHaveAttribute("aria-expanded", "false");

    await addRecord.click();
    const closeForm = page.getByRole("button", { name: /^Close form$/i });
    await expect(closeForm).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("heading", { name: /add new record/i })).toHaveCount(1);
    await expect(page.getByLabel(/document name/i)).toBeFocused();

    await page.getByRole("button", { name: /^Cancel$/i }).first().click();
    await expect(page.getByRole("heading", { name: /add new record/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Add record$/i }).first()).toBeFocused();

    await addRecord.click();
    await page.getByLabel(/document name/i).fill("UAT Collapsible Trust Deed");
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Discard this unsaved trust record?");
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: /^Cancel$/i }).first().click();
    await expect(page.getByRole("heading", { name: /add new record/i })).toBeVisible();
    await expect(page.getByLabel(/document name/i)).toHaveValue("UAT Collapsible Trust Deed");

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Discard this unsaved trust record?");
      await dialog.accept();
    });
    await page.getByRole("button", { name: /^Close form$/i }).click();
    await expect(page.getByRole("heading", { name: /add new record/i })).toHaveCount(0);

    await addRecord.click();
    await page.getByRole("button", { name: /save record/i }).click();
    await expect(page.getByText(/document name is required before saving/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /add new record/i })).toBeVisible();

    await page.getByLabel(/document name/i).fill("UAT Collapsible Trust Deed");
    await page.getByLabel(/document type/i).selectOption("Trust deed");
    await page.getByRole("button", { name: /add notes/i }).click();
    await page.getByLabel(/notes/i).fill("Synthetic trust record used to prove the collapsible form.");
    await page.getByRole("button", { name: /save record/i }).click();

    await expect(page.getByRole("status")).toContainText(/saved record/i);
    await expect(page.getByRole("heading", { name: /add new record/i })).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByRole("heading", { name: /existing records/i })).toBeFocused();
    await expect(page.getByText("UAT Collapsible Trust Deed")).toBeVisible();

    await page.reload();
    await expect(page.getByText("UAT Collapsible Trust Deed")).toBeVisible();
    await expect(page.getByRole("heading", { name: /add new record/i })).toHaveCount(0);
  });
});

async function signIn(page: import("@playwright/test").Page) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });
  if (error || !data.session) {
    throw error ?? new Error("Supabase did not return a browser session for the Trusts test user.");
  }

  await page.goto("/");
  await page.evaluate((session) => {
    window.localStorage.setItem("sb-127-auth-token", JSON.stringify(session));
  }, data.session);
}

async function signUpSyntheticUser(email: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signUp({
    email,
    password: ownerPassword,
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error(`Supabase did not return a user id for ${email}.`);
  return userId;
}

function confirmSyntheticUser(userId: string) {
  runPsql(
    `
      update auth.users
      set email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = ${uuidLiteral(userId)};
    `,
  );
}

function markOnboardingComplete(userId: string) {
  const now = new Date().toISOString();
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
        ${uuidLiteral(userId)},
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
        ${uuidLiteral(userId)},
        'legacy-fortress-2026-03',
        true,
        ${stringLiteral(now)}::timestamptz,
        'trusts-collapsible-browser-test',
        ${stringLiteral(now)}::timestamptz
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
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

function uuidLiteral(value: string) {
  const normalized = String(value).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`Invalid UUID literal: ${normalized}`);
  }
  return `${stringLiteral(normalized)}::uuid`;
}

function stringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function canReachLocalSupabase() {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
