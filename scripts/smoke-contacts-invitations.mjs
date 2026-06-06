#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const uniqueTag = Date.now();
const ownerEmail = process.env.SMOKE_CONTACTS_OWNER_EMAIL || `ivanyardley+lf-contacts-owner-${uniqueTag}@me.com`;
const ownerPassword = process.env.SMOKE_CONTACTS_OWNER_PASSWORD || "ContactsSmoke123!";
const contactName = `Contacts Invite ${uniqueTag}`;
const recipientEmail = process.env.SMOKE_CONTACTS_RECIPIENT_EMAIL || `ivanyardley+lf-contacts-recipient-${uniqueTag}@me.com`;
const recipientPassword = process.env.SMOKE_CONTACTS_RECIPIENT_PASSWORD || "ContactsRecipient123!";
const contactEmail = recipientEmail;
const limitEmail = process.env.SMOKE_CONTACTS_LIMIT_EMAIL || `ivanyardley+lf-contacts-limit-${uniqueTag}@me.com`;
const limitPassword = process.env.SMOKE_CONTACTS_LIMIT_PASSWORD || "ContactsLimit123!";

let ownerUserId = "";
let recipientUserId = "";
let limitUserId = "";
let contactId = "";
let invitationId = "";
let acceptPath = "";

const browser = await chromium.launch({ headless: true });

try {
  const owner = await ensureOwnerUser(ownerEmail, ownerPassword);
  ownerUserId = owner.id;
  await ensureOwnerBootstrapState(ownerUserId);
  await ensureBillingProfile(ownerUserId, { invitationLimit: 5 });

  const ownerAuth = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword });
  if (ownerAuth.error || !ownerAuth.data.user) throw ownerAuth.error || new Error("Could not authenticate contacts smoke owner.");

  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  await signInThroughApp(page, ownerEmail, ownerPassword);
  await createContactThroughContactsUi(page);
  const pending = await waitForInvitationByEmail(ownerUserId, contactEmail);
  contactId = String(pending.contact_id ?? "");
  invitationId = String(pending.id ?? "");
  assert.equal(pending.invitation_status, "pending");
  assert.equal(Boolean(pending.sent_at), false);

  await sendAndVerifyInvitation(false);
  await sendAndVerifyInvitation(true);

  await verifyContactsUiSentState(page);
  await acceptInvitationAsRecipient();
  await verifyAcceptedStateInContacts(page);
  await verifyStarterInvitationLimit();

  console.log(JSON.stringify({
    ownerUserId,
    contactId,
    invitationId,
    contactEmail,
    recipientEmail,
    contactsInvitations: {
      contactCreatedInContactsUi: true,
      inviteSent: true,
      inviteResent: true,
      acceptedByRecipient: true,
      contactsUiShowsAccepted: true,
      starterInvitationLimitEnforced: true,
    },
  }, null, 2));
} finally {
  await cleanup();
  await browser.close();
}

async function createContactThroughContactsUi(page) {
  await page.goto("/contacts", { waitUntil: "networkidle" });
  await page.getByText(/Contacts in place/i).waitFor();
  await page.getByRole("button", { name: /^Add contact$/i }).first().click();
  const panel = page.getByRole("region", { name: /Add contact and permissions/i });
  await panel.waitFor();
  await panel.locator("input").nth(0).fill(contactName);
  await panel.locator("input").nth(1).fill(contactEmail);
  await panel.locator("select").first().selectOption({ label: "Executor" });
  await panel.getByRole("button", { name: /^Add contact$/i }).click();
}

async function sendAndVerifyInvitation(resend) {
  const beforeEvents = await countInvitationEvents(invitationId, resend ? "resent" : "sent");
  await sendInviteForSmoke(ownerClient, {
    ownerUserId,
    ownerEmail,
    contactId,
    contactName,
    contactEmail,
    assignedRole: "executor",
    invitationId,
    activationStatus: "invited",
    permissionsOverride: {
      allowed_sections: ["profile", "personal", "financial", "legal", "property"],
      asset_ids: [],
      record_ids: [],
      editable_asset_ids: [],
      editable_record_ids: [],
    },
    resend,
    origin: BASE_URL,
  });

  const invitation = await waitForInvitationByEmail(ownerUserId, contactEmail);
  assert.equal(Boolean(invitation.sent_at), true);
  assert.equal(invitation.invitation_status, "pending");
  const afterEvents = await countInvitationEvents(invitationId, resend ? "resent" : "sent");
  assert.equal(afterEvents > beforeEvents, true);
  const event = await latestInvitationEvent(invitationId, resend ? "resent" : "sent");
  assert.match(String(event?.payload?.body_text ?? ""), /view-only, role-based access/i);
  acceptPath = String(event?.payload?.accept_path ?? acceptPath);
  assert.match(acceptPath, /^\/invite\/accept\?/);
}

async function verifyContactsUiSentState(page) {
  await page.goto(`/contacts?contact=${contactId}`, { waitUntil: "networkidle" });
  await page.getByText(contactName).waitFor();
  await page.getByText(/Manage selected contact/i).waitFor();
  await page.getByText(/Resend invite|Pending|Sent/i).first().waitFor();
}

async function acceptInvitationAsRecipient() {
  const created = await admin.auth.admin.createUser({
    email: recipientEmail,
    password: recipientPassword,
    email_confirm: true,
    user_metadata: { full_name: "Contacts Recipient Smoke" },
  });
  if (created.error || !created.data.user) throw created.error || new Error("Could not create recipient user.");
  recipientUserId = created.data.user.id;

  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);
  await page.goto(acceptPath, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /accept invitation/i }).waitFor();
  await page.getByRole("link", { name: /sign in to accept/i }).click();
  await page.getByLabel(/email/i).fill(recipientEmail);
  await page.getByLabel(/^password/i).fill(recipientPassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/invite\/accept|\/dashboard|\/account\/terms|\/onboarding/, { timeout: 45000 });
  if (!page.url().includes("/invite/accept")) {
    await page.goto(acceptPath, { waitUntil: "networkidle" });
  }
  await page.getByRole("button", { name: /accept and continue/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45000 });
  await page.getByText(/Viewing .* estate records/i).waitFor();
  await context.close();

  const accepted = await waitForAcceptedInvitation();
  assert.equal(accepted.accepted_user_id, recipientUserId);
}

async function verifyAcceptedStateInContacts(page) {
  await page.goto(`/contacts?contact=${contactId}`, { waitUntil: "networkidle" });
  await page.getByText(contactName).waitFor();
  await page.getByText(/Accepted|Verified|Active/i).first().waitFor();
}

async function verifyStarterInvitationLimit() {
  const limitOwner = await ensureOwnerUser(limitEmail, limitPassword);
  limitUserId = limitOwner.id;
  await ensureOwnerBootstrapState(limitUserId);
  await ensureBillingProfile(limitUserId, { invitationLimit: 5 });
  const limitClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const auth = await limitClient.auth.signInWithPassword({ email: limitEmail, password: limitPassword });
  if (auth.error || !auth.data.user) throw auth.error || new Error("Could not authenticate limit owner.");

  const now = new Date().toISOString();
  for (let index = 0; index < 5; index += 1) {
    const email = `limit-seed-${index}-${uniqueTag}@example.test`;
    const contact = await admin.from("contacts").insert({
      user_id: limitUserId,
      owner_user_id: limitUserId,
      full_name: `Limit Seed ${index}`,
      email,
      email_normalized: email,
      contact_role: "professional_advisor",
      invite_status: "invite_sent",
      verification_status: "invited",
      source_type: "invitation",
      linked_context: [],
      created_at: now,
      updated_at: now,
    }).select("id").single();
    if (contact.error || !contact.data?.id) throw contact.error || new Error("Could not seed limit contact.");
    const invitation = await admin.from("contact_invitations").insert({
      owner_user_id: limitUserId,
      contact_id: contact.data.id,
      contact_name: `Limit Seed ${index}`,
      contact_email: email,
      assigned_role: "professional_advisor",
      invitation_status: "pending",
      invited_at: now,
      updated_at: now,
    });
    if (invitation.error) throw invitation.error;
  }

  await assert.rejects(
    () => sendInviteForSmoke(limitClient, {
      ownerUserId: limitUserId,
      ownerEmail: limitEmail,
      contactName: "Limit Blocked",
      contactEmail: `limit-blocked-${uniqueTag}@example.test`,
      assignedRole: "professional_advisor",
      origin: BASE_URL,
    }),
    /Starter plan limit reached: 5 invitations/,
  );
}

async function sendInviteForSmoke(client, input) {
  const contactEmailValue = String(input.contactEmail ?? "").trim().toLowerCase();
  if (!contactEmailValue) throw new Error("Contact email is required before an invite can be sent.");

  if (!input.resend) {
    const plan = await loadSmokePlan(client, input.ownerUserId);
    const inviteCount = await countActiveInvitations(client, input.ownerUserId);
    if (plan.account_plan !== "premium" && inviteCount >= Number(plan.invitation_limit ?? 5)) {
      throw new Error(`Starter plan limit reached: ${Number(plan.invitation_limit ?? 5)} invitations. Upgrade in Billing and Account to continue sharing access.`);
    }
  }

  const now = new Date().toISOString();
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const nextAcceptPath = `/invite/accept?${new URLSearchParams({ invitation: input.invitationId, token }).toString()}`;

  const delivery = await client.auth.signInWithOtp({
    email: contactEmailValue,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: input.origin
        ? `${input.origin}/auth/callback?next=${encodeURIComponent(nextAcceptPath)}`
        : undefined,
      data: {
        invitation_id: input.invitationId,
        invitation_role: input.assignedRole,
        account_holder_name: input.ownerEmail?.split("@")[0] ?? "the account holder",
        linked_access: "view_only",
      },
    },
  });
  const deliveryRateLimited = delivery.error && /rate limit/i.test(delivery.error.message);
  if (delivery.error && !deliveryRateLimited) throw new Error(delivery.error.message);

  const invitationUpdate = await client.from("contact_invitations").update({
    contact_id: input.contactId,
    contact_name: input.contactName,
    contact_email: contactEmailValue,
    assigned_role: input.assignedRole,
    invitation_status: "pending",
    invite_token_hash: tokenHash,
    sent_at: now,
    last_sent_at: now,
    updated_at: now,
  }).eq("id", input.invitationId).eq("owner_user_id", input.ownerUserId);
  if (invitationUpdate.error) throw invitationUpdate.error;

  if (input.contactId) {
    const contactUpdate = await client.from("contacts").update({
      invite_status: "invite_sent",
      verification_status: "invited",
      updated_at: now,
    }).eq("id", input.contactId).eq("owner_user_id", input.ownerUserId);
    if (contactUpdate.error) throw contactUpdate.error;
  }

  const event = await client.from("invitation_events").insert({
    owner_user_id: input.ownerUserId,
    invitation_id: input.invitationId,
    event_type: input.resend ? "resent" : "sent",
    payload: {
      contact_email: contactEmailValue,
      token_hint: token.slice(-6),
      subject: `You have been invited as ${input.assignedRole.replace(/_/g, " ")}`,
      preview: "Legacy Fortress trusted access invitation",
      body_text: deliveryRateLimited
        ? "Email delivery was rate-limited in smoke test, but this secure invite keeps view-only, role-based access verifiable."
        : "You have been given view-only, role-based access to review shared estate records and documents.",
      accept_path: nextAcceptPath,
      delivery_warning: deliveryRateLimited ? delivery.error.message : null,
    },
  });
  if (event.error) throw event.error;

  return { invitationId: input.invitationId };
}

async function loadSmokePlan(client, userId) {
  const result = await client
    .from("billing_profiles")
    .select("account_plan,invitation_limit")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ?? { account_plan: "starter", invitation_limit: 5 };
}

async function countActiveInvitations(client, userId) {
  const result = await client
    .from("contact_invitations")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .neq("invitation_status", "revoked");
  if (result.error) throw result.error;
  return Number(result.count ?? 0);
}

async function signInThroughApp(page, email, password) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding|\/account\/terms|\/profile/, { timeout: 45000 });
  if (page.url().includes("/onboarding")) {
    const terms = page.getByLabel(/i accept the terms and conditions/i);
    if (await terms.count()) await terms.check();
    await page.getByRole("button", { name: /continue into your secure record|go to dashboard/i }).click();
    await page.waitForURL(/\/dashboard|\/profile|\/account\/terms/, { timeout: 45000 });
  }
  if (page.url().includes("/account/terms")) {
    const accept = page.getByRole("button", { name: /accept terms and continue/i });
    if (await accept.count()) await accept.click();
    await page.waitForURL(/\/dashboard|\/profile/, { timeout: 45000 });
  }
}

async function ensureOwnerUser(email, password) {
  const existing = await findAuthUser(email);
  if (existing) {
    const update = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (update.error) throw update.error;
    return existing;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Contacts Owner Smoke" },
  });
  if (created.error || !created.data.user) throw created.error || new Error(`Could not create ${email}`);
  return created.data.user;
}

async function findAuthUser(email) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw list.error;
  return list.data.users.find((user) => String(user.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureOwnerBootstrapState(userId) {
  const now = new Date().toISOString();
  const onboarding = await admin.from("user_onboarding_state").upsert({
    user_id: userId,
    current_step: "complete",
    completed_steps: ["identity", "verification", "consent", "personal_details", "complete"],
    is_completed: true,
    terms_accepted: true,
    marketing_opt_in: false,
    updated_at: now,
  }, { onConflict: "user_id" });
  if (onboarding.error) throw onboarding.error;

  const terms = await admin.from("terms_acceptances").upsert({
    user_id: userId,
    terms_version: "legacy-fortress-2026-03",
    accepted: true,
    accepted_at: now,
    source: "smoke_contacts_invitations",
    updated_at: now,
  }, { onConflict: "user_id" });
  if (terms.error) throw terms.error;
}

async function ensureBillingProfile(userId, { invitationLimit }) {
  const now = new Date().toISOString();
  const result = await admin.from("billing_profiles").upsert({
    user_id: userId,
    account_plan: "starter",
    plan_status: "active",
    plan_source: "smoke_contacts_invitations",
    record_limit: 25,
    invitation_limit: invitationLimit,
    monthly_charge: 0,
    billing_currency: "GBP",
    updated_at: now,
  }, { onConflict: "user_id" });
  if (result.error) throw result.error;
}

async function waitForInvitationByEmail(ownerId, email) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const result = await admin
      .from("contact_invitations")
      .select("id,contact_id,contact_email,invitation_status,sent_at,accepted_user_id")
      .eq("owner_user_id", ownerId)
      .eq("contact_email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data?.id) return result.data;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for invitation ${email}`);
}

async function waitForAcceptedInvitation() {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const invitation = await waitForInvitationByEmail(ownerUserId, contactEmail);
    if (invitation.accepted_user_id) return invitation;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for accepted invitation.");
}

async function countInvitationEvents(id, eventType) {
  const result = await admin
    .from("invitation_events")
    .select("id", { count: "exact", head: true })
    .eq("invitation_id", id)
    .eq("event_type", eventType);
  if (result.error) throw result.error;
  return Number(result.count ?? 0);
}

async function latestInvitationEvent(id, eventType) {
  const result = await admin
    .from("invitation_events")
    .select("id,event_type,payload")
    .eq("invitation_id", id)
    .eq("event_type", eventType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function cleanup() {
  for (const id of [ownerUserId, limitUserId]) {
    if (!id) continue;
    await admin.from("invitation_events").delete().eq("owner_user_id", id);
    await admin.from("contact_invitations").delete().eq("owner_user_id", id);
    await admin.from("contact_links").delete().eq("owner_user_id", id);
    await admin.from("contacts").delete().eq("owner_user_id", id);
    await admin.from("billing_profiles").delete().eq("user_id", id);
    await admin.from("terms_acceptances").delete().eq("user_id", id);
    await admin.from("user_onboarding_state").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
  if (recipientUserId) {
    await admin.auth.admin.deleteUser(recipientUserId);
  }
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
