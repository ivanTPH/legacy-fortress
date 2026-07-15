import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:55424";
const runId = Date.now();
const ownerEmail = `trust-auto-owner-${runId}@example.test`;
const ownerPassword = "TrustAutoInvite123!";
const trusteeEmail = `trust-auto-trustee-${runId}@example.test`;
const trusteeName = "Paul Smith";
const trustTitle = `UAT Auto Invite Trust ${runId}`;

let ownerUserId = "";

test.describe("Trust contact automatic invitation", () => {
  test.beforeAll(async () => {
    if (!supabaseUrl || !supabaseAnonKey || !databaseUrl || !supabaseUrl.includes("127.0.0.1:55421")) {
      throw new Error("Local Supabase URL, anon key, and database URL are required for Trust contact invitation proof.");
    }
    if (!(await canReachLocalSupabase())) {
      throw new Error("Local Supabase is not reachable for Trust contact invitation proof.");
    }

    ownerUserId = await signUpSyntheticUser(ownerEmail);
    confirmSyntheticUser(ownerUserId);
    markOnboardingComplete(ownerUserId);
  });

  test.afterAll(async () => {
    deleteSyntheticUsers([ownerUserId].filter(Boolean));
  });

  test("saving a Trust contact creates one invitation, sends email, and keeps acceptance separate from access", async ({ page }) => {
    await signIn(page);
    await page.goto("/legal/trusts?add=1");

    await expect(page.getByText(/^Trusts$/i).first()).toBeVisible();
    if (await page.getByRole("heading", { name: /add new record/i }).count() === 0) {
      await page.getByRole("button", { name: /^Add record$/i }).first().click();
    }

    await page.getByLabel(/trust title|document name/i).fill(trustTitle);
    const documentType = page.getByLabel(/document type/i);
    if (await documentType.count()) {
      await documentType.selectOption("Trust deed");
    }
    const notesToggle = page.getByRole("button", { name: /add notes/i });
    if (await notesToggle.count()) {
      await notesToggle.first().click();
      await page.getByLabel(/notes/i).fill("Synthetic trust notes for automatic invitation proof.");
    }

    await page.getByLabel(/^Full name$/i).fill(trusteeName);
    await page.getByLabel(/^Email$/i).fill(trusteeEmail);
    await page.getByLabel(/^Telephone number$/i).fill("07123 456789");

    await page.getByRole("button", { name: /save record/i }).click();

    await expect(page.getByRole("status")).toContainText(/saved|message sent/i, { timeout: 20_000 });
    await expect(page.getByText(trustTitle)).toBeVisible();
    await expect(page.getByText(trusteeName).first()).toBeVisible();
    await expect(page.getByText(/Message sent|invite sent|sent/i).first()).toBeVisible();

    const invitation = readTrustInvitation();
    expect(invitation.contact_email).toBe(trusteeEmail);
    expect(invitation.assigned_role).toBe("trustee");
    expect(invitation.invitation_status).toBe("pending");
    expect(invitation.permissions_override?.requires_unlock_approval).toBe(true);
    expect(invitation.permissions_override?.source).toBe("trust_record_contact");
    expect(invitation.permissions_override?.source_id).toBeTruthy();
    expect(invitation.grant_count).toBe(0);

    const mail = await waitForMail(trusteeEmail);
    expect(mail.link).toContain("/auth/v1/verify");

    await page.getByRole("button", { name: /^Edit record$/i }).first().click();
    await page.getByLabel(/^Telephone number$/i).fill("07123 456780");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByRole("status")).toContainText(/saved/i, { timeout: 20_000 });
    expect(countTrustInvitations()).toBe(1);
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
    throw error ?? new Error("Supabase did not return a browser session for the Trust invitation test user.");
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
  runPsql(`
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = ${uuidLiteral(userId)};
  `);
}

function markOnboardingComplete(userId: string) {
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
      'trust-auto-invite-browser-test',
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

function readTrustInvitation() {
  const output = runPsql(`
    select coalesce(json_agg(row_to_json(invitation_rows)), '[]'::json)
    from (
      select
        ci.contact_email,
        ci.assigned_role,
        ci.invitation_status,
        ra.permissions_override,
        (
          select count(*)
          from public.account_access_grants aag
          where aag.invitation_id = ci.id
        ) as grant_count
      from public.contact_invitations ci
      left join public.role_assignments ra on ra.invitation_id = ci.id
      where ci.owner_user_id = ${uuidLiteral(ownerUserId)}
        and ci.contact_email = ${stringLiteral(trusteeEmail)}
      order by ci.created_at desc
      limit 1
    ) invitation_rows;
  `);
  const rows = JSON.parse(output) as Array<{
    contact_email: string;
    assigned_role: string;
    invitation_status: string;
    permissions_override: Record<string, unknown> | null;
    grant_count: number;
  }>;
  if (rows.length !== 1) throw new Error(`Expected one Trust invitation row, found ${rows.length}.`);
  return rows[0];
}

function countTrustInvitations() {
  const output = runPsql(`
    select count(*)
    from public.contact_invitations
    where owner_user_id = ${uuidLiteral(ownerUserId)}
      and contact_email = ${stringLiteral(trusteeEmail)};
  `);
  return Number(output);
}

async function waitForMail(recipient: string) {
  const deadline = Date.now() + 45_000;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const list = await fetch(`${mailpitUrl}/api/v1/messages?limit=50`);
      if (!list.ok) throw new Error(`Mailpit list failed with ${list.status}`);
      const payload = await list.json();
      const found = payload.messages?.find((message: MailpitMessageSummary) => {
        return message.To?.some((to) => to.Address.toLowerCase() === recipient.toLowerCase());
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
  throw new Error(`Timed out waiting for ${recipient} mail. Last error: ${String(lastError)}`);
}

function extractFirstLink(content: string) {
  const htmlHref = content.match(/href="([^"]+)"/i)?.[1];
  const textHref = content.match(/https?:\/\/[^\s)"]+/i)?.[0];
  return decodeHtmlEntities(htmlHref ?? textHref ?? "");
}

function decodeHtmlEntities(value: string) {
  return value.replaceAll("&amp;", "&");
}

function deleteSyntheticUsers(userIds: string[]) {
  if (!userIds.length || !databaseUrl) return;
  const ids = userIds.map(uuidLiteral).join(",");
  runPsql(`
    delete from auth.users
    where id in (${ids});
  `);
}

function runPsql(sql: string) {
  return execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { stdio: "pipe" })
    .toString("utf8")
    .trim();
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
  return new Promise<boolean>((resolve) => {
    const request = http.get(`${supabaseUrl}/auth/v1/health`, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 500));
    });
    request.setTimeout(3_000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

type MailpitMessageSummary = {
  ID: string;
  To?: Array<{ Address: string }>;
};
