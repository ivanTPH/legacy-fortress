#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadCanonicalContactsForOwner, syncCanonicalContact } from "../lib/contacts/canonicalContacts.ts";
import { buildDashboardDiscoveryResults } from "../lib/records/discovery.ts";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_OWNER_EMAIL = process.env.E2E_USER_EMAIL;
const DEFAULT_OWNER_PASSWORD = process.env.E2E_USER_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const uniqueTag = Date.now();
const OWNER_EMAIL = process.env.SMOKE_OWNER_EMAIL || `ivanyardley+lf-contact-smoke-owner-${uniqueTag}@me.com`;
const OWNER_PASSWORD = process.env.SMOKE_OWNER_PASSWORD || DEFAULT_OWNER_PASSWORD || "OwnerSmoke123!";

if (!OWNER_EMAIL || !OWNER_PASSWORD || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing BASE_URL owner credentials and Supabase env for contact smoke.");
}

const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminClient = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
const contactName = `Contact Smoke ${uniqueTag}`;
const contactEmail = `contact-smoke-${uniqueTag}@example.test`;

const browser = await chromium.launch({ headless: true });

try {
  let provisionedOwnerId = "";
  if (adminClient && OWNER_EMAIL !== DEFAULT_OWNER_EMAIL) {
    const provisionedOwner = await ensureOwnerUserExists(adminClient, OWNER_EMAIL, OWNER_PASSWORD);
    provisionedOwnerId = provisionedOwner.id;
    await ensureOwnerBootstrapState(adminClient, provisionedOwner.id);
  }

  const signInResult = await ownerClient.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (signInResult.error || !signInResult.data.user) {
    throw signInResult.error || new Error("Could not sign in owner for contact smoke.");
  }
  const ownerUserId = signInResult.data.user.id;

  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  await signIn(page, OWNER_EMAIL, OWNER_PASSWORD);
  await ensureOwnerReady(page);

  const invitationId = await createOrUpdateInvitationContact(ownerClient, ownerUserId, {
    name: contactName,
    email: contactEmail,
    role: "professional_advisor",
  });
  await createOrUpdateInvitationContact(ownerClient, ownerUserId, {
    id: invitationId,
    existingContactId: null,
    name: contactName,
    email: contactEmail,
    role: "accountant",
  });

  await page.goto("/trust");
  await page.getByRole("button", { name: /add executor/i }).click();
  await page.getByLabel(/full name/i).fill(contactName);
  await page.getByLabel(/role \/ type/i).selectOption({ label: "Executor" });
  await page.getByLabel(/^relationship$/i).selectOption({ label: "Friend" });
  await page.getByLabel(/email/i).fill(contactEmail);
  await page.getByLabel(/authority level/i).selectOption({ label: "Primary" });
  await page.getByLabel(/jurisdiction/i).selectOption({ label: "United Kingdom" });
  await page.getByLabel(/^status$/i).selectOption({ label: "Active" });
  await page.getByRole("button", { name: /save executor/i }).click();
  await page.getByText(/saved successfully/i).waitFor();
  await page.waitForURL(/\/trust/, { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(500);

  const contactsRes = await ownerClient
    .from("contacts")
    .select("id,full_name,email,contact_role,source_type,linked_context,invite_status,verification_status")
    .eq("owner_user_id", ownerUserId)
    .eq("email_normalized", contactEmail);
  if (contactsRes.error) throw contactsRes.error;
  assert.equal((contactsRes.data ?? []).length, 1);

  const contact = contactsRes.data?.[0];
  assert.equal(contact?.full_name, contactName);
  assert.equal(contact?.contact_role, "executor");
  assert.equal(contact?.source_type, "executor_asset");

  const invitationRes = await ownerClient
    .from("contact_invitations")
    .select("id,contact_id,assigned_role,invitation_status")
    .eq("owner_user_id", ownerUserId)
    .eq("contact_email", contactEmail);
  if (invitationRes.error) throw invitationRes.error;
  assert.equal((invitationRes.data ?? []).length, 1);
  assert.equal(invitationRes.data?.[0]?.contact_id, contact?.id);

  const linkRes = await ownerClient
    .from("contact_links")
    .select("id,source_kind,source_id,role_label")
    .eq("owner_user_id", ownerUserId)
    .eq("contact_id", String(contact?.id ?? ""));
  if (linkRes.error) throw linkRes.error;
  assert.equal((linkRes.data ?? []).some((row) => row.source_kind === "invitation"), true);
  assert.equal((linkRes.data ?? []).some((row) => row.source_kind === "asset"), true);

  await page.goto("/personal/contacts");
  const executorsSection = page.locator("section").filter({ hasText: /^Executors\b/i }).first();
  await executorsSection.locator(".lf-contact-card").filter({ hasText: contactName }).first().waitFor();
  assert.equal((await page.getByText(contactName, { exact: false }).count()) >= 1, true);

  const hydratedContacts = await loadCanonicalContactsForOwner(ownerClient, ownerUserId);
  const dashboardDiscovery = buildDashboardDiscoveryResults({
    query: contactName,
    assets: [],
    contacts: hydratedContacts.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      contactRole: row.contact_role,
      relationship: row.relationship,
      linkedContext: row.linked_context ?? [],
    })),
    documents: [],
    assetHref: () => "/app/dashboard",
    assetIcon: () => "folder",
    contactHref: () => "/personal/contacts",
    documentHref: () => "/app/dashboard",
    extraLinks: [],
  });
  assert.equal(dashboardDiscovery.some((row) => row.kind === "contact" && row.label === contactName), true);

  console.log(JSON.stringify({
    ownerUserId,
    contactEmail,
    contactId: contact?.id ?? null,
    contactRole: contact?.contact_role ?? null,
    sourceType: contact?.source_type ?? null,
    invitationRows: invitationRes.data?.length ?? 0,
    contactLinks: linkRes.data?.length ?? 0,
    dashboardReflectedContact: true,
    contactsPageReflectedExecutorGrouping: true,
  }, null, 2));
} finally {
  await browser.close();
}

async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app\/dashboard|\/app\/onboarding|\/account\/terms/, { timeout: 30000 });
  if (page.url().includes("/app/onboarding")) {
    const terms = page.getByLabel(/i accept the terms and conditions/i);
    if (await terms.count()) {
      await terms.check();
      await page.getByRole("button", { name: /continue into your secure record|go to dashboard/i }).click();
    }
    await page.waitForURL(/\/profile|\/app\/dashboard|\/account\/terms/, { timeout: 30000 });
  }
  if (page.url().includes("/account/terms")) {
    const acceptButton = page.getByRole("button", { name: /accept terms and continue/i });
    if (await acceptButton.count()) {
      await acceptButton.click();
    } else {
      await page.getByRole("link", { name: /return to the dashboard/i }).click();
    }
    await page.waitForURL(/\/app\/dashboard/, { timeout: 30000 });
  }
}

async function ensureOwnerReady(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/app/dashboard").catch(() => null);
    await page.waitForURL(/\/app\/dashboard|\/app\/onboarding|\/account\/terms|\/profile/, { timeout: 30000 });
    if (page.url().includes("/app/onboarding")) {
      try {
        await page.waitForURL(/\/app\/dashboard|\/profile|\/account\/terms/, { timeout: 4000 });
      } catch {
        // Fall through to manual completion when the client-side redirect does not happen automatically.
      }
      if (page.url().includes("/app/dashboard") || page.url().includes("/profile")) return;
      if (page.url().includes("/account/terms")) {
        const acceptButton = page.getByRole("button", { name: /accept terms and continue/i });
        if (await acceptButton.count()) {
          await acceptButton.click();
          await page.waitForURL(/\/app\/dashboard|\/profile/, { timeout: 30000 });
          if (page.url().includes("/app/dashboard") || page.url().includes("/profile")) return;
        }
      }
      const checkbox = page.getByLabel(/i accept the terms and conditions/i);
      if (await checkbox.count()) {
        await checkbox.check();
      }
      const continueButton = page.getByRole("button", { name: /continue into your secure record|go to dashboard/i });
      if (await continueButton.count()) {
        await continueButton.click();
      }
      await page.waitForURL(/\/app\/dashboard|\/profile|\/account\/terms/, { timeout: 30000 }).catch(() => null);
      continue;
    }
    if (page.url().includes("/account/terms")) {
      const acceptButton = page.getByRole("button", { name: /accept terms and continue/i });
      if (await acceptButton.count()) {
        await acceptButton.click();
      } else {
        await page.getByRole("link", { name: /return to the dashboard/i }).click();
      }
      await page.waitForURL(/\/app\/dashboard|\/profile/, { timeout: 30000 }).catch(() => null);
      continue;
    }
    if (page.url().includes("/app/dashboard") || page.url().includes("/profile")) return;
  }
  throw new Error(`Owner bootstrap did not settle on dashboard. url=${page.url()}`);
}

async function ensureOwnerUserExists(admin, email, password) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((user) => String(user.email ?? "").toLowerCase() === email.toLowerCase());
  if (existing) {
    const update = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (update.error) throw update.error;
    return existing;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error || new Error(`Could not create owner ${email}`);
  }
  return created.data.user;
}

async function ensureOwnerBootstrapState(admin, userId) {
  const now = new Date().toISOString();

  const onboardingRes = await admin
    .from("user_onboarding_state")
    .upsert({
      user_id: userId,
      current_step: "complete",
      completed_steps: ["identity", "verification", "consent", "personal_details", "complete"],
      is_completed: true,
      terms_accepted: true,
      marketing_opt_in: false,
      updated_at: now,
    }, { onConflict: "user_id" });
  if (onboardingRes.error) throw onboardingRes.error;

  const termsRes = await admin
    .from("terms_acceptances")
    .upsert({
      user_id: userId,
      terms_version: "legacy-fortress-2026-03",
      accepted: true,
      accepted_at: now,
      source: "smoke_contact_consistency",
      updated_at: now,
    }, { onConflict: "user_id" });
  if (termsRes.error) throw termsRes.error;
}

async function createOrUpdateInvitationContact(client, ownerUserId, { id = null, existingContactId = null, name, email, role }) {
  const now = new Date().toISOString();
  const canonicalContact = await syncCanonicalContact(client, {
    ownerUserId,
    existingContactId,
    fullName: name,
    email,
    contactRole: role,
    sourceType: "invitation",
    inviteStatus: id ? "invite_sent" : "not_invited",
    verificationStatus: id ? "invited" : "not_verified",
  });

  if (id) {
    const updateRes = await client
      .from("contact_invitations")
      .update({
        contact_id: canonicalContact.id,
        contact_name: name,
        contact_email: email,
        assigned_role: role,
        updated_at: now,
      })
      .eq("id", id)
      .eq("owner_user_id", ownerUserId);
    if (updateRes.error) throw updateRes.error;

    const assignRes = await client
      .from("role_assignments")
      .upsert({
        owner_user_id: ownerUserId,
        invitation_id: id,
        assigned_role: role,
        updated_at: now,
      }, { onConflict: "invitation_id" });
    if (assignRes.error) throw assignRes.error;

    await syncCanonicalContact(client, {
      ownerUserId,
      existingContactId: canonicalContact.id,
      fullName: name,
      email,
      contactRole: role,
      sourceType: "invitation",
      inviteStatus: "invite_sent",
      verificationStatus: "invited",
      link: {
        sourceKind: "invitation",
        sourceId: id,
        sectionKey: "dashboard",
        categoryKey: "contacts",
        label: "Contact invitation",
        role,
      },
    });
    return id;
  }

  const insertRes = await client
    .from("contact_invitations")
    .insert({
      owner_user_id: ownerUserId,
      contact_id: canonicalContact.id,
      contact_name: name,
      contact_email: email,
      assigned_role: role,
      invitation_status: "pending",
      invited_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insertRes.error || !insertRes.data) throw insertRes.error || new Error("Could not insert contact invitation");

  const assignRes = await client
    .from("role_assignments")
    .insert({
      owner_user_id: ownerUserId,
      invitation_id: insertRes.data.id,
      assigned_role: role,
      activation_status: "invited",
      updated_at: now,
    });
  if (assignRes.error) throw assignRes.error;

  await syncCanonicalContact(client, {
    ownerUserId,
    existingContactId: canonicalContact.id,
    fullName: name,
    email,
    contactRole: role,
    sourceType: "invitation",
    inviteStatus: "invite_sent",
    verificationStatus: "invited",
    link: {
      sourceKind: "invitation",
      sourceId: insertRes.data.id,
      sectionKey: "dashboard",
      categoryKey: "contacts",
      label: "Contact invitation",
      role,
    },
  });

  return insertRes.data.id;
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
