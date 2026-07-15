import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const runId = Date.now();
const password = "Phase4LocalOnly123!";

type Persona = {
  email: string;
  id: string;
};

type SeededPhase4Data = {
  ownerId: string;
  linkedId: string;
  contactName: string;
  allowedTitle: string;
  unrelatedTitle: string;
  allowedDocumentName: string;
  unrelatedDocumentName: string;
  allowedAssetId: string;
  unrelatedAssetId: string;
  caseId: string;
};

const personas: Record<"owner" | "linked" | "reviewer" | "admin", Persona> = {
  owner: { email: `phase4-owner-${runId}@legacyfortress.test`, id: "" },
  linked: { email: `phase4-linked-executor-${runId}@legacyfortress.test`, id: "" },
  reviewer: { email: `phase4-probate-reviewer-${runId}@legacyfortress.test`, id: "" },
  admin: { email: `phase4-admin-${runId}@legacyfortress.test`, id: "" },
};

let seeded: SeededPhase4Data;

test.describe("Phase 4 linked-access and revocation release gate", () => {
  test.beforeAll(async () => {
    test.skip(
      !supabaseUrl || !supabaseAnonKey || !databaseUrl || supabaseUrl !== "http://127.0.0.1:55421",
      "Phase 4 linked-access proof requires the isolated local Legacy Fortress Supabase instance.",
    );

    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const persona of Object.values(personas)) {
      const { data, error } = await anon.auth.signUp({ email: persona.email, password });
      if (error) throw error;
      persona.id = data.user?.id ?? "";
      if (!persona.id) throw new Error(`No user id returned for ${persona.email}.`);
    }

    confirmAndPrepareUsers();
    seeded = seedLinkedAccessData();
  });

  test("linked executor sees only approved scope and loses browser/API access after revocation", async ({ browser }) => {
    const linkedContext = await browser.newContext();
    const linkedPage = await linkedContext.newPage();
    const reviewerContext = await browser.newContext();
    const reviewerPage = await reviewerContext.newPage();

    await signIn(linkedPage, personas.linked.email);
    await linkedPage.goto("/dashboard?search=Phase4");
    await expect(linkedPage.getByText(seeded.allowedTitle, { exact: false })).toHaveCount(0);
    await expect(await directOwnerAssets(linkedPage, seeded.ownerId)).toHaveLength(0);
    await expect(await directOwnerDocuments(linkedPage, seeded.ownerId)).toHaveLength(0);

    await signIn(reviewerPage, personas.reviewer.email);
    await reviewerPage.goto("/internal/admin", { waitUntil: "domcontentloaded" });
    const caseCard = reviewerPage.locator("article").filter({ hasText: seeded.contactName }).filter({ hasText: "probate access" }).first();
    await reviewerPage.locator("textarea").first().fill("Phase 4 browser approval proof.");
    await caseCard.getByRole("button", { name: /approve limited access/i }).click();
    await expect(caseCard.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });

    await linkedPage.goto("/vault/property", { waitUntil: "domcontentloaded" });
    await expect(linkedPage.getByText(seeded.allowedTitle, { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(linkedPage.getByText(seeded.unrelatedTitle, { exact: false })).toHaveCount(0);
    await linkedPage.reload();
    await expect(linkedPage.getByText(seeded.allowedTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

    await linkedPage.goto("/finances/bank", { waitUntil: "domcontentloaded" });
    await expect(linkedPage).toHaveURL(/\/dashboard/);
    await expect(linkedPage.getByText(seeded.unrelatedTitle, { exact: false })).toHaveCount(0);

    const directAfterGrant = await directOwnerAssets(linkedPage, seeded.ownerId);
    expect(directAfterGrant.map((row) => row.title)).not.toContain(seeded.unrelatedTitle);
    expect(directAfterGrant.map((row) => row.title)).toContain(seeded.allowedTitle);
    const documentsAfterGrant = await directOwnerDocuments(linkedPage, seeded.ownerId);
    expect(documentsAfterGrant.map((row) => row.file_name)).toContain(seeded.allowedDocumentName);
    expect(documentsAfterGrant.map((row) => row.file_name)).not.toContain(seeded.unrelatedDocumentName);

    await reviewerPage.goto("/internal/admin", { waitUntil: "domcontentloaded" });
    await reviewerPage.locator("textarea").first().fill("Phase 4 browser revocation proof.");
    await reviewerPage.locator("article").filter({ hasText: seeded.contactName }).filter({ hasText: "probate access" }).first().getByRole("button", { name: /revoke access/i }).click();
    await expect(reviewerPage.getByText(/revoked/i).first()).toBeVisible({ timeout: 15_000 });

    await linkedPage.goto("/vault/property", { waitUntil: "domcontentloaded" });
    await expect(linkedPage.getByText(seeded.allowedTitle, { exact: false })).toHaveCount(0);
    await linkedPage.reload();
    await expect(linkedPage.getByText(seeded.allowedTitle, { exact: false })).toHaveCount(0);
    await expect(await directOwnerAssets(linkedPage, seeded.ownerId)).toHaveLength(0);
    await expect(await directOwnerDocuments(linkedPage, seeded.ownerId)).toHaveLength(0);

    const freshContext = await browser.newContext();
    const freshLinkedPage = await freshContext.newPage();
    await signIn(freshLinkedPage, personas.linked.email);
    await freshLinkedPage.goto("/vault/property", { waitUntil: "domcontentloaded" });
    await expect(freshLinkedPage.getByText(seeded.allowedTitle, { exact: false })).toHaveCount(0);

    const auditActions = queryJson<{ action: string }>(
      `select json_build_object('action', action) from public.audit_events where resource_id = ${literal(seeded.caseId)} order by created_at asc`,
    );
    expect(auditActions.map((row) => row.action)).toEqual(expect.arrayContaining(["Probate case approve", "Probate case revoke"]));
  });
});

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const signInButton = page.getByRole("button", { name: /^sign in$/i });
  await expect(signInButton).toBeEnabled({ timeout: 15_000 });
  await signInButton.click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 20_000 });
}

async function directOwnerAssets(page: Page, ownerId: string) {
  return await page.evaluate(async ({ ownerId, supabaseUrl, supabaseAnonKey }) => {
    const session = Object.values(localStorage)
      .map((value) => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })
      .find((value) => value?.access_token || value?.currentSession?.access_token);
    const token = session?.access_token || session?.currentSession?.access_token || "";
    const response = await fetch(`${supabaseUrl}/rest/v1/assets?owner_user_id=eq.${ownerId}&select=id,title`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return [];
    return await response.json();
  }, { ownerId, supabaseUrl, supabaseAnonKey }) as Array<{ id: string; title: string | null }>;
}

async function directOwnerDocuments(page: Page, ownerId: string) {
  return await page.evaluate(async ({ ownerId, supabaseUrl, supabaseAnonKey }) => {
    const session = Object.values(localStorage)
      .map((value) => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })
      .find((value) => value?.access_token || value?.currentSession?.access_token);
    const token = session?.access_token || session?.currentSession?.access_token || "";
    const response = await fetch(`${supabaseUrl}/rest/v1/documents?owner_user_id=eq.${ownerId}&select=id,file_name`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return [];
    return await response.json();
  }, { ownerId, supabaseUrl, supabaseAnonKey }) as Array<{ id: string; file_name: string | null }>;
}

function confirmAndPrepareUsers() {
  const now = new Date().toISOString();
  const userIds = Object.values(personas).map((persona) => uuid(persona.id)).join(",");
  const profileRows = Object.values(personas)
    .map((persona) => `(${uuid(persona.id)}, ${literal(displayName(persona.email))}, ${literal(now)}::timestamptz)`)
    .join(",");
  const adminRows = [
    [personas.reviewer.email, personas.reviewer.id, "probate_reviewer"],
    [personas.admin.email, personas.admin.id, "super_admin"],
  ]
    .map(([email, id, role]) => `(${literal(String(email).toLowerCase())}, ${uuid(id)}, ${literal(displayName(String(email)))}, 'active', false, null, ${literal(String(role))}, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz)`)
    .join(",");

  runPsql(`
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id in (${userIds});
    insert into public.user_profiles (user_id, display_name, updated_at)
    values ${profileRows}
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = excluded.updated_at;
    insert into public.user_onboarding_state (user_id, current_step, completed_steps, is_completed, terms_accepted, marketing_opt_in, updated_at)
    select id, 'complete', array['identity','verification','consent','personal_details','vault_categories','complete']::text[], true, true, false, ${literal(now)}::timestamptz
    from auth.users where id in (${userIds})
    on conflict (user_id) do update set current_step = excluded.current_step, completed_steps = excluded.completed_steps, is_completed = excluded.is_completed, terms_accepted = excluded.terms_accepted, updated_at = excluded.updated_at;
    insert into public.terms_acceptances (user_id, terms_version, accepted, accepted_at, source, updated_at)
    select id, 'legacy-fortress-2026-03', true, ${literal(now)}::timestamptz, 'phase4-linked-access-test', ${literal(now)}::timestamptz
    from auth.users where id in (${userIds})
    on conflict (user_id) do update set accepted = excluded.accepted, accepted_at = excluded.accepted_at, source = excluded.source, updated_at = excluded.updated_at;
    insert into public.admin_users (email_normalized, user_id, display_name, status, is_master, granted_by_user_id, role, created_at, updated_at)
    values ${adminRows}
    on conflict (email_normalized) do update set user_id = excluded.user_id, display_name = excluded.display_name, status = excluded.status, role = excluded.role, updated_at = excluded.updated_at;
  `);
}

function seedLinkedAccessData(): SeededPhase4Data {
  const now = new Date().toISOString();
  const contactName = `Phase4 Linked Executor ${runId}`;
  const allowedTitle = `Phase4 Approved Property ${runId}`;
  const unrelatedTitle = `Phase4 Private Bank ${runId}`;
  const allowedDocumentName = `phase4-approved-property-${runId}.pdf`;
  const unrelatedDocumentName = `phase4-private-bank-${runId}.pdf`;
  const rows = queryJson<SeededPhase4Data>(`
    with org as (
      insert into public.organisations (owner_user_id, name, created_at, updated_at)
      values (${uuid(personas.owner.id)}, ${literal(`Phase4 Org ${runId}`)}, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz)
      on conflict (owner_user_id) do update set updated_at = excluded.updated_at
      returning id
    ), wallet as (
      insert into public.wallets (organisation_id, owner_user_id, label, status, created_at, updated_at)
      select org.id, ${uuid(personas.owner.id)}, 'Phase4 wallet', 'active', ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from org
      on conflict (owner_user_id) where status = 'active' do update set updated_at = excluded.updated_at
      returning id, organisation_id
    ), allowed_asset as (
      insert into public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title, provider_name, summary, value_minor, currency_code, visibility, status, metadata_json, created_at, updated_at)
      select wallet.organisation_id, wallet.id, ${uuid(personas.owner.id)}, 'property', 'property', ${literal(allowedTitle)}, 'Phase4 local estate', 'Phase4 approved probate-linked property', 0, 'GBP', 'private', 'active', jsonb_build_object('phase4_marker', ${literal(String(runId))}), ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from wallet
      returning id, organisation_id, wallet_id
    ), unrelated_asset as (
      insert into public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title, provider_name, summary, value_minor, currency_code, visibility, status, metadata_json, created_at, updated_at)
      select allowed_asset.organisation_id, allowed_asset.wallet_id, ${uuid(personas.owner.id)}, 'finances', 'bank', ${literal(unrelatedTitle)}, 'Phase4 private bank', 'Must remain inaccessible to linked executor', 123456, 'GBP', 'private', 'active', jsonb_build_object('phase4_marker', ${literal(String(runId))}), ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from allowed_asset
      returning id, organisation_id, wallet_id
    ), allowed_document as (
      insert into public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes, document_kind, created_at, updated_at)
      select allowed_asset.organisation_id, allowed_asset.wallet_id, allowed_asset.id, ${uuid(personas.owner.id)}, 'vault-docs', 'users/' || ${literal(personas.owner.id)} || '/phase4/' || ${literal(allowedDocumentName)}, ${literal(allowedDocumentName)}, 'application/pdf', 128, 'document', ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from allowed_asset
      returning id
    ), unrelated_document as (
      insert into public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes, document_kind, created_at, updated_at)
      select unrelated_asset.organisation_id, unrelated_asset.wallet_id, unrelated_asset.id, ${uuid(personas.owner.id)}, 'vault-docs', 'users/' || ${literal(personas.owner.id)} || '/phase4/' || ${literal(unrelatedDocumentName)}, ${literal(unrelatedDocumentName)}, 'application/pdf', 128, 'document', ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from unrelated_asset
      returning id
    ), contact as (
      insert into public.contacts (owner_user_id, full_name, email, email_normalized, contact_role, relationship, invite_status, verification_status, source_type, user_id, linked_user_id, linked_context, validation_overrides, created_at, updated_at)
      values (${uuid(personas.owner.id)}, ${literal(contactName)}, ${literal(personas.linked.email)}, ${literal(personas.linked.email.toLowerCase())}, 'executor', 'executor', 'accepted', 'verification_submitted', 'invitation', ${uuid(personas.linked.id)}, ${uuid(personas.linked.id)}, '{}'::jsonb, '{}'::jsonb, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz)
      returning id
    ), link as (
      insert into public.contact_links (owner_user_id, contact_id, source_kind, source_id, section_key, category_key, context_label, role_label, created_at, updated_at)
      select ${uuid(personas.owner.id)}, contact.id, 'asset', allowed_asset.id, 'property', 'property', ${literal(allowedTitle)}, 'executor', ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from contact, allowed_asset
      returning id
    ), invitation as (
      insert into public.contact_invitations (owner_user_id, contact_id, contact_name, contact_email, assigned_role, invitation_status, invite_token_hash, invited_at, sent_at, accepted_at, accepted_user_id, created_at, updated_at)
      select ${uuid(personas.owner.id)}, contact.id, ${literal(contactName)}, ${literal(personas.linked.email)}, 'executor', 'accepted', ${literal(`phase4-${runId}`)}, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz, ${uuid(personas.linked.id)}, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from contact
      returning id, contact_id
    ), role_assignment as (
      insert into public.role_assignments (owner_user_id, invitation_id, assigned_role, activation_status, permissions_override, created_at, updated_at)
      select ${uuid(personas.owner.id)}, invitation.id, 'executor', 'verification_submitted', jsonb_build_object('asset_ids', jsonb_build_array((select id from allowed_asset)), 'allowed_sections', jsonb_build_array('property')), ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from invitation
      returning id, invitation_id
    ), verification as (
      insert into public.verification_requests (owner_user_id, role_assignment_id, request_type, request_status, evidence_document_path, submitted_at, created_at, updated_at)
      select ${uuid(personas.owner.id)}, role_assignment.id, 'death_certificate', 'submitted', 'users/' || ${literal(personas.owner.id)} || '/phase4/' || ${literal(`${runId}-death-certificate.pdf`)}, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from role_assignment
      returning id, role_assignment_id
    ), probate_case as (
      insert into public.probate_cases (owner_user_id, applicant_user_id, contact_id, contact_invitation_id, role_assignment_id, verification_request_id, case_type, status, assigned_reviewer_user_id, submitted_at, applicant_status_message, created_at, updated_at)
      select ${uuid(personas.owner.id)}, ${uuid(personas.linked.id)}, invitation.contact_id, invitation.id, role_assignment.id, verification.id, 'probate_access', 'submitted', ${uuid(personas.reviewer.id)}, ${literal(now)}::timestamptz, 'Submitted for review.', ${literal(now)}::timestamptz, ${literal(now)}::timestamptz from invitation, role_assignment, verification
      returning id
    )
    select json_build_object(
      'ownerId', ${literal(personas.owner.id)},
      'linkedId', ${literal(personas.linked.id)},
      'contactName', ${literal(contactName)},
      'allowedTitle', ${literal(allowedTitle)},
      'unrelatedTitle', ${literal(unrelatedTitle)},
      'allowedDocumentName', ${literal(allowedDocumentName)},
      'unrelatedDocumentName', ${literal(unrelatedDocumentName)},
      'allowedAssetId', (select id from allowed_asset),
      'unrelatedAssetId', (select id from unrelated_asset),
      'caseId', (select id from probate_case)
    );
  `);
  return rows[0];
}

function queryJson<T>(sql: string): T[] {
  const out = execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!out) return [];
  return out.split(/\n+/).map((line) => JSON.parse(line) as T);
}

function runPsql(sql: string) {
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

function displayName(email: string) {
  if (email.includes("owner")) return "Phase4 Owner";
  if (email.includes("linked")) return "Phase4 Linked Executor";
  if (email.includes("probate")) return "Phase4 Probate Reviewer";
  return "Phase4 Admin";
}

function uuid(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(`Invalid uuid: ${value}`);
  return `${literal(value)}::uuid`;
}

function literal(value: string) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
