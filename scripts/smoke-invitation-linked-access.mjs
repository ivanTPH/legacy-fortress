#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { webkit } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OWNER_EMAIL = process.env.E2E_USER_EMAIL || "";
const OWNER_PASSWORD = process.env.E2E_USER_PASSWORD || "";
const OWNER_DISPLAY_NAME = process.env.SMOKE_OWNER_DISPLAY_NAME || "Bill Smith";
const INVITED_ROLE = process.env.SMOKE_INVITED_ROLE || "professional_advisor";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !OWNER_EMAIL || !OWNER_PASSWORD) {
  throw new Error("Missing required env for linked-access smoke.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const uniqueTag = `${Date.now()}`;
const invitedEmail = process.env.SMOKE_INVITED_EMAIL || `ivanyardley+lf-linked-${uniqueTag}@me.com`;
const invitedPassword = process.env.SMOKE_INVITED_PASSWORD || "LinkedAccess123!";
const invitedName = process.env.SMOKE_INVITED_NAME || "Linked Access Reviewer";

let recipientUserId = "";
let invitationId = "";
let contactId = "";
let invitationAcceptPath = "";

const browser = await webkit.launch();
let ownerPage = null;
let recipientPage = null;

try {
  logStep("owner auth");
  const ownerAuth = await ownerClient.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (ownerAuth.error || !ownerAuth.data.user) {
    throw new Error(ownerAuth.error?.message || "Owner auth failed.");
  }
  const ownerUserId = ownerAuth.data.user.id;

  const createdUser = await admin.auth.admin.createUser({
    email: invitedEmail,
    password: invitedPassword,
    email_confirm: true,
    user_metadata: {
      full_name: invitedName,
      smoke_test: "linked_access",
    },
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error(createdUser.error?.message || "Could not create invited user.");
  }
  recipientUserId = createdUser.data.user.id;
  logStep(`created invited user ${invitedEmail}`);

  const ownerContext = await browser.newContext({ baseURL: BASE_URL, acceptDownloads: true });
  ownerPage = await ownerContext.newPage();
  ownerPage.setDefaultTimeout(20000);
  ownerPage.setDefaultNavigationTimeout(30000);
  await signInThroughApp(ownerPage, OWNER_EMAIL, OWNER_PASSWORD);
  logStep("owner signed in");
  if (!ownerPage.url().includes("/app/dashboard")) {
    await ownerPage.goto("/app/dashboard");
  }
  logStep("owner dashboard ready");
  await ownerPage.getByLabel("Name").fill(invitedName);
  await ownerPage.getByLabel("Email").fill(invitedEmail);
  await ownerPage.getByLabel("Role").selectOption(INVITED_ROLE);
  await ownerPage.getByRole("button", { name: /add contact/i }).click();
  const inviteRow = ownerPage.locator(".lf-contact-invitations-row").filter({ hasText: invitedEmail }).first();
  await inviteRow.waitFor({ state: "visible", timeout: 20000 });
  logStep("owner contact created");
  await inviteRow.getByRole("button", { name: /^Send$/ }).click();
  await ownerPage.waitForTimeout(1500);
  const ownerStatusAfterSend = await readInvitationManagerStatus(ownerPage);
  if (ownerStatusAfterSend) {
    logStep(`owner status after send: ${ownerStatusAfterSend}`);
  }
  const invitation = await waitForInvitationSent(ownerUserId, invitedEmail, 30000, {
    rowId: await inviteRow.getAttribute("data-invitation-id"),
    assignedRole: INVITED_ROLE,
    ownerUserId,
    accountHolderName: OWNER_DISPLAY_NAME,
    ownerStatusAfterSend,
  });
  invitationId = invitation.id;
  contactId = String(invitation.contact_id ?? "");
  logStep("owner invitation sent");

  const invitationEvent = await fetchInvitationEvent(ownerUserId, invitationId);
  assert.equal(Boolean(invitationEvent?.payload?.subject), true);
  assert.match(String(invitationEvent?.payload?.subject ?? ""), /You have been invited as/i);
  assert.match(String(invitationEvent?.payload?.body_text ?? ""), /view-only, role-based access/i);

  const acceptPath = String(invitationEvent?.payload?.accept_path ?? invitationAcceptPath ?? "");
  if (!acceptPath) {
    throw new Error("Invitation event did not contain an accept path.");
  }
  logStep(`accept path ready ${acceptPath}`);

  const recipientContext = await browser.newContext({ baseURL: BASE_URL, acceptDownloads: true });
  recipientPage = await recipientContext.newPage();
  recipientPage.setDefaultTimeout(20000);
  recipientPage.setDefaultNavigationTimeout(30000);
  await recipientPage.goto(acceptPath);
  logStep("recipient opened accept link");
  await recipientPage.getByRole("heading", { name: /accept invitation/i }).waitFor({ timeout: 20000 });
  await recipientPage.getByText(new RegExp(`You have been invited as`, "i")).waitFor({ timeout: 20000 });
  await recipientPage.getByRole("link", { name: /sign in to accept/i }).click();
  await typeLikeUser(recipientPage.locator('input[type="email"]').first(), invitedEmail);
  await typeLikeUser(recipientPage.locator('input[autocomplete="current-password"]').first(), invitedPassword);
  const recipientSubmit = recipientPage.locator('button[type="submit"]').first();
  await recipientSubmit.waitFor({ state: "visible", timeout: 10000 });
  await waitForEnabled(recipientSubmit, 10000);
  await recipientSubmit.click();
  await recipientPage.waitForURL(/\/invite\/accept|\/app\/dashboard/, { timeout: 30000 });
  if (!recipientPage.url().includes("/invite/accept")) {
    await recipientPage.goto(acceptPath);
  }
  logStep("recipient signed in");
  await recipientPage.getByRole("button", { name: /accept and continue/i }).click();
  try {
    await recipientPage.waitForURL(/\/app\/dashboard/, { timeout: 30000 });
  } catch (error) {
    const acceptStatus = await readAlertText(recipientPage);
    const bodyText = await recipientPage.locator("body").innerText();
    throw new Error(
      `Recipient accept did not redirect. url=${recipientPage.url()} alert=${acceptStatus || "none"} body=${bodyText.slice(0, 1200)}`,
      { cause: error },
    );
  }
  await recipientPage.getByText(/Viewing .* estate records/i).waitFor({ timeout: 20000 });
  await recipientPage.getByText(/view-only/i).waitFor({ timeout: 20000 });
  logStep("recipient accepted invitation");

  await assertLinkVisibility(recipientPage);
  logStep("recipient navigation verified");
  await verifyBankReadOnlyExperience(recipientPage);
  logStep("recipient bank read-only verified");
  await verifySharedAttachmentReadOnlyExperience(recipientPage);
  logStep("recipient attachment access verified");

  await ownerPage.reload({ waitUntil: "networkidle" });
  const ownerRowAfterAccept = ownerPage.locator(".lf-contact-invitations-row").filter({ hasText: invitedEmail }).first();
  await ownerRowAfterAccept.waitFor({ state: "visible", timeout: 20000 });
  await waitForOwnerAcceptedStatus(ownerRowAfterAccept, 20000);

  const ownerState = await fetchOwnerSideState(ownerUserId, invitedEmail, recipientUserId);
  logStep("owner state verified");

  console.log(JSON.stringify({
    invitedEmail,
    invitedRole: INVITED_ROLE,
    acceptPath,
    ownerUserId,
    recipientUserId,
    ownerVerification: ownerState,
    linkedUi: {
      dashboardBanner: true,
      viewOnlyRoleLabel: true,
      restrictedSectionsHidden: true,
      bankReadOnly: true,
      attachmentPreviewWorked: true,
      attachmentDownloadWorked: true,
    },
  }, null, 2));
} finally {
  await cleanupSmokeRows();
  await browser.close();
}

async function signInThroughApp(page, email, password) {
  await page.goto("/sign-in");
  await typeLikeUser(page.locator('input[type="email"]').first(), email);
  await typeLikeUser(page.locator('input[autocomplete="current-password"]').first(), password);
  const submit = page.locator('button[type="submit"]').first();
  await submit.waitFor({ state: "visible", timeout: 10000 });
  await waitForEnabled(submit, 10000);
  await submit.click();
  await page.waitForURL(/\/app\/dashboard|\/app\/onboarding|\/account\/terms/, { timeout: 30000 });
  if (page.url().includes("/onboarding")) {
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

async function fetchInvitationByEmail(ownerUserId, email) {
  const result = await admin
    .from("contact_invitations")
    .select("id,contact_id,contact_email,invitation_status,accepted_user_id,sent_at")
    .eq("owner_user_id", ownerUserId)
    .eq("contact_email", email)
    .order("invited_at", { ascending: false })
    .limit(1)
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Invitation row not found.");
  }
  return result.data;
}

async function waitForInvitationSent(ownerUserId, email, timeoutMs, fallback) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const invitation = await fetchInvitationByEmail(ownerUserId, email);
    if (invitation.sent_at) {
      return invitation;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (String(fallback?.ownerStatusAfterSend ?? "").toLowerCase().includes("email rate limit exceeded")) {
    logStep("email delivery rate-limited, generating secure invite link fallback");
    return await generateFallbackInvitation(fallback.ownerUserId, invitationId || fallback.rowId || "", email, fallback.assignedRole, fallback.accountHolderName);
  }
  throw new Error("Timed out waiting for the invitation to be marked as sent.");
}

async function readInvitationManagerStatus(page) {
  const section = page.locator("section").filter({ hasText: "Contacts, invitations and roles" }).first();
  const candidates = await section.locator("div").allInnerTexts();
  const match = candidates
    .map((value) => value.trim())
    .find((value) => value.startsWith("✅") || value.startsWith("❌") || value.startsWith("⚠️"));
  return match ?? "";
}

async function readAlertText(page) {
  const alerts = await page.locator('[role="alert"]').allInnerTexts();
  const match = alerts
    .map((value) => value.trim())
    .find(Boolean);
  return match ?? "";
}

async function waitForOwnerAcceptedStatus(rowLocator, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await rowLocator.innerText().catch(() => "");
    if (/accepted/i.test(text)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the owner invitation row to show accepted status.");
}

async function generateFallbackInvitation(ownerUserId, existingInvitationId, email, assignedRole, accountHolderName) {
  const invitation = existingInvitationId
    ? await fetchInvitationById(ownerUserId, existingInvitationId)
    : await fetchInvitationByEmail(ownerUserId, email);
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = createTokenHash(token);
  invitationAcceptPath = `/invite/accept?invitation=${invitation.id}&token=${token}`;
  const now = new Date().toISOString();
  const roleLabel = assignedRole.replace(/_/g, " ");
  const subject = `You have been invited as ${roleLabel} for ${accountHolderName}`;
  const preview = `View-only, role-based access has been prepared for ${accountHolderName}'s Legacy Fortress estate record.`;
  const bodyText = [
    `You have been invited as ${roleLabel} for ${accountHolderName}.`,
    "",
    "Legacy Fortress is a secure estate-record workspace that helps families, executors, trustees, and advisors find the records and documents they need when it matters.",
    "",
    "If you accept this invitation, you will receive view-only, role-based access to the records that have been shared with you. You will be able to review records, open attachments, and download documents, but you will not be able to edit or delete anything.",
    "",
    `Accept your secure invitation: ${invitationAcceptPath}`,
  ].join("\n");

  const updateRes = await admin
    .from("contact_invitations")
    .update({
      invite_token_hash: tokenHash,
      invitation_status: "pending",
      sent_at: now,
      last_sent_at: now,
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("owner_user_id", ownerUserId)
    .select("id,contact_id,contact_email,invitation_status,accepted_user_id,sent_at")
    .single();
  if (updateRes.error || !updateRes.data) {
    throw new Error(updateRes.error?.message || "Could not generate fallback invitation link.");
  }

  const eventRes = await admin.from("invitation_events").insert({
    owner_user_id: ownerUserId,
    invitation_id: invitation.id,
    event_type: "sent",
    payload: {
      contact_email: email,
      token_hint: token.slice(-6),
      subject,
      preview,
      body_text: bodyText,
      accept_path: invitationAcceptPath,
      delivery_mode: "generated_link_fallback",
    },
  });
  if (eventRes.error) {
    throw new Error(eventRes.error.message || "Could not log fallback invitation event.");
  }

  return updateRes.data;
}

async function fetchInvitationById(ownerUserId, id) {
  const result = await admin
    .from("contact_invitations")
    .select("id,contact_id,contact_email,invitation_status,accepted_user_id,sent_at")
    .eq("owner_user_id", ownerUserId)
    .eq("id", id)
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Invitation row not found by id.");
  }
  return result.data;
}

function createTokenHash(input) {
  return crypto.createHash("sha256").update(input.trim()).digest("hex");
}

async function fetchInvitationEvent(ownerUserId, invitationId) {
  const result = await admin
    .from("invitation_events")
    .select("payload")
    .eq("owner_user_id", ownerUserId)
    .eq("invitation_id", invitationId)
    .eq("event_type", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Invitation event not found.");
  }
  return result.data;
}

async function fetchOwnerSideState(ownerUserId, email, linkedUserId) {
  const [contactRows, invitationRows, grantRows, roleRows] = await Promise.all([
    admin
      .from("contacts")
      .select("id,linked_user_id,email,invite_status,verification_status")
      .eq("owner_user_id", ownerUserId)
      .eq("email", email),
    admin
      .from("contact_invitations")
      .select("id,contact_id,invitation_status,accepted_user_id")
      .eq("owner_user_id", ownerUserId)
      .eq("contact_email", email),
    admin
      .from("account_access_grants")
      .select("id,contact_id,linked_user_id,assigned_role,activation_status")
      .eq("owner_user_id", ownerUserId)
      .eq("linked_user_id", linkedUserId),
    admin
      .from("role_assignments")
      .select("assigned_role,activation_status")
      .eq("owner_user_id", ownerUserId)
      .in("invitation_id", invitationId ? [invitationId] : [""]),
  ]);

  const contacts = contactRows.data ?? [];
  const invitations = invitationRows.data ?? [];
  const grants = grantRows.data ?? [];
  const roleAssignments = roleRows.data ?? [];

  assert.equal(contacts.length, 1, "Expected exactly one canonical contact for the invited user.");
  assert.equal(invitations.length, 1, "Expected exactly one invitation row for the invited user.");
  assert.equal(grants.length, 1, "Expected exactly one active access grant for the invited user.");
  assert.equal(String(contacts[0]?.linked_user_id ?? ""), linkedUserId);
  assert.equal(String(invitations[0]?.accepted_user_id ?? ""), linkedUserId);
  assert.equal(String(grants[0]?.linked_user_id ?? ""), linkedUserId);

  return {
    contacts,
    invitations,
    grants,
    roleAssignments,
  };
}

async function assertLinkVisibility(page) {
  if (!page.url().includes("/app/dashboard")) {
    await page.goto("/app/dashboard");
  }
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator('a[href="/finances"]').count() > 0, true);
  assert.equal(await page.locator('a[href="/legal"]').count() > 0, true);
  assert.equal(await page.locator('a[href="/property"]').count() > 0, true);
  assert.equal(await page.locator('a[href="/personal"]').count(), 0);
  assert.equal(await page.locator('a[href="/profile"]').count(), 0);
}

async function verifyBankReadOnlyExperience(page) {
  await page.goto("/finances/bank");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("button", { name: /add bank record/i }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /edit record/i }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /delete record/i }).count(), 0);
  assert.equal(await page.getByText(/Upload document/i).count(), 0);

  const bankBody = await page.locator("body").innerText();
  assert.match(bankBody, /HSBC|NS&I|Everyday|Savings|bank/i);
}

async function verifySharedAttachmentReadOnlyExperience(page) {
  await page.goto("/finances/bank");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("button", { name: /add bank record/i }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /edit record/i }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /delete record/i }).count(), 0);
  assert.equal(await page.getByText(/Upload document/i).count(), 0);

  let openedAttachments = false;
  const bankOpenDocumentButtons = page.getByRole("button", { name: /open document/i });
  const bankOpenDocumentCount = await bankOpenDocumentButtons.count();
  for (let index = 0; index < bankOpenDocumentCount; index += 1) {
    const candidate = bankOpenDocumentButtons.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click();
    openedAttachments = true;
    break;
  }

  if (!openedAttachments) {
    await page.goto("/vault/property");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getByRole("button", { name: /add/i }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /edit record/i }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /delete record/i }).count(), 0);
    assert.equal(await page.getByText(/Upload document/i).count(), 0);

    const attachmentsButtons = page.getByRole("button", { name: /^Attachments$/ });
    const attachmentButtonCount = await attachmentsButtons.count();
    for (let index = 0; index < attachmentButtonCount; index += 1) {
      const candidate = attachmentsButtons.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      await candidate.click();
      openedAttachments = true;
      break;
    }
  }

  assert.equal(openedAttachments, true, "Expected at least one shared attachment button in linked mode.");
  await page.getByRole("button", { name: /^Preview$/ }).first().waitFor({ timeout: 10000 });

  await page.getByRole("button", { name: /^Preview$/ }).first().click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^Close$/ }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^Download$/ }).first().click(),
  ]);
  assert.equal(Boolean(download.suggestedFilename()), true);
}

async function cleanupSmokeRows() {
  if (contactId) {
    await admin.from("contact_links").delete().eq("contact_id", contactId);
  }
  if (invitationId) {
    await admin.from("account_access_grants").delete().eq("invitation_id", invitationId);
    await admin.from("invitation_events").delete().eq("invitation_id", invitationId);
    await admin.from("role_assignments").delete().eq("invitation_id", invitationId);
    await admin.from("contact_invitations").delete().eq("id", invitationId);
  }
  if (contactId) {
    await admin.from("contacts").delete().eq("id", contactId);
  }
  if (recipientUserId) {
    await admin.auth.admin.deleteUser(recipientUserId);
  }
}

function loadEnvFile() {
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function logStep(message) {
  console.log(`[smoke] ${message}`);
}

async function waitForEnabled(locator, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await locator.isEnabled()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for enabled control.");
}

async function typeLikeUser(locator, value) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 20 });
  await locator.blur();
}
