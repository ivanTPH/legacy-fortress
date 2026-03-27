#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAsset } from "../lib/assets/createAsset.ts";

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
const ownerEmail = process.env.SMOKE_OWNER_EMAIL || `ivanyardley+lf-owner-uat-${uniqueTag}@me.com`;
const ownerPassword = process.env.SMOKE_OWNER_PASSWORD || "OwnerUAT123!";
const skipSignUp = process.env.SMOKE_SKIP_SIGNUP === "1";

const bankAttachmentPath = path.join(os.tmpdir(), `lf-uat-bank-${uniqueTag}.png`);
const willAttachmentPath = path.join(os.tmpdir(), `lf-uat-will-${uniqueTag}.png`);
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0wAAAABJRU5ErkJggg==",
  "base64",
);
fs.writeFileSync(bankAttachmentPath, tinyPng);
fs.writeFileSync(willAttachmentPath, tinyPng);

const browser = await chromium.launch({ headless: true });
let page = null;
let ownerUserId = "";

try {
  const context = await browser.newContext({ baseURL: BASE_URL, acceptDownloads: true });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  if (skipSignUp) {
    await signInExistingOwner(page);
  } else {
    await signUpOwner(page);
  }
  ownerUserId = await resolveOwnerUserId(ownerEmail);
  await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword });

  await completeProfile(page);
  await createBankRecord(page);
  await createPropertyRecord(page);
  await createLegalWillRecord(page);
  await createDashboardContact(page);
  await verifyDashboard(page);

  await seedAssetsToStarterLimit(ownerUserId);
  await verifyRecordLimit(page);

  await seedInvitationsForLimit(ownerUserId);
  await verifyInvitationLimit(page);

  console.log(JSON.stringify({
    ownerEmail,
    ownerUserId,
    ownerFlow: {
      signedUp: true,
      onboardingCompleted: true,
      termsAccepted: true,
      dashboardReached: true,
      profileSaved: true,
      bankSaved: true,
      propertySaved: true,
      legalRecordSaved: true,
      contactSaved: true,
      attachmentPreviewWorked: true,
      dashboardUpdated: true,
      recordLimitEnforced: true,
      invitationLimitEnforced: true,
    },
  }, null, 2));
} finally {
  await browser.close();
}

async function signUpOwner(page) {
  await page.goto("/sign-up");
  await page.getByRole("heading", { name: /create account/i }).waitFor();
  await page.getByLabel(/email/i).fill(ownerEmail);
  await page.getByLabel(/^password/i).fill(ownerPassword);
  await page.getByRole("button", { name: /^create account$/i }).click();

  try {
    await page.waitForURL(/\/app\/onboarding|\/profile|\/app\/dashboard|\/account\/terms/, { timeout: 20000 });
  } catch {
    const bodyText = await page.locator("body").innerText();
    if (/verify your email|account created|email rate limit exceeded/i.test(bodyText)) {
      const user = await ensureOwnerUserExists(ownerEmail, ownerPassword);
      await admin.auth.admin.updateUserById(user.id, { email_confirm: true, password: ownerPassword });
      await page.goto("/sign-in");
      await page.getByLabel(/email/i).fill(ownerEmail);
      await page.getByLabel(/^password/i).fill(ownerPassword);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/app\/onboarding|\/profile|\/app\/dashboard|\/account\/terms/, { timeout: 30000 });
    } else {
      throw new Error(`Owner sign-up did not progress. Body snippet: ${bodyText.slice(0, 800)}`);
    }
  }

  if (page.url().includes("/app/onboarding")) {
    await page.getByRole("heading", { name: /welcome to legacy fortress/i }).waitFor();
    await page.getByLabel(/i accept the terms and conditions/i).check();
    await page.getByRole("button", { name: /continue into your secure record/i }).click();
    await page.waitForURL(/\/profile/, { timeout: 30000 });
  }

  if (page.url().includes("/account/terms")) {
    await page.getByRole("button", { name: /accept terms and continue/i }).click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 30000 });
    await page.goto("/profile");
  }
}

async function signInExistingOwner(page) {
  await page.goto("/sign-in");
  await page.getByRole("heading", { name: /^sign in$/i }).waitFor();
  await page.getByLabel(/email/i).fill(ownerEmail);
  await page.getByLabel(/^password/i).fill(ownerPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app\/onboarding|\/profile|\/app\/dashboard|\/account\/terms/, { timeout: 30000 });

  if (page.url().includes("/app/onboarding")) {
    await page.getByRole("heading", { name: /welcome to legacy fortress/i }).waitFor();
    const terms = page.getByLabel(/i accept the terms and conditions/i);
    if (await terms.count()) {
      await terms.check();
    }
    await page.getByRole("button", { name: /continue into your secure record|go to dashboard/i }).click();
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
    await page.goto("/profile");
  }
}

async function completeProfile(page) {
  if (!page.url().includes("/profile")) {
    await page.goto("/profile");
  }
  await page.getByRole("heading", { name: /^profile$/i }).waitFor();
  await page.getByRole("button", { name: /edit profile/i }).click();
  await page.getByLabel(/first name/i).fill("Launch");
  await page.getByLabel(/last name/i).fill("Owner");
  await page.getByLabel(/telephone number/i).fill("01904 555301");
  await page.getByLabel(/mobile number/i).fill("07700 900301");
  await page.getByLabel(/notification email/i).fill(ownerEmail);
  await page.getByLabel(/house name or number/i).fill("22");
  await page.getByLabel(/street name/i).fill("Market Street");
  await page.getByLabel(/^town$/i).fill("York");
  await page.getByLabel(/^city$/i).fill("York");
  await page.getByLabel(/^country$/i).selectOption({ label: "United Kingdom" });
  await page.getByLabel(/post code/i).fill("YO1 4ZZ");
  await page.getByRole("button", { name: /save profile/i }).click();
  await page.getByText(/profile saved/i).waitFor();
  await page.getByRole("main").getByText(/launch owner/i).waitFor();
}

async function createBankRecord(page) {
  await page.goto("/finances/bank");
  await page.getByRole("button", { name: /add bank record/i }).click();
  await page.getByLabel(/record title/i).fill("Launch UAT Current Account");
  await page.getByLabel(/bank \/ provider name/i).fill("HSBC");
  await page.getByLabel(/account type/i).selectOption({ label: "Current Account" });
  await page.getByLabel(/account holder/i).fill("Launch Owner");
  await page.getByLabel(/account number/i).fill("12345678");
  await page.getByLabel(/sort code/i).fill("10-20-30");
  await page.getByLabel(/^country$/i).selectOption({ label: "United Kingdom" });
  await page.getByLabel(/^currency$/i).selectOption({ label: "GBP" });
  await page.getByLabel(/current balance/i).fill("4200");
  await page.getByLabel(/balance last updated/i).fill("2026-03-24");
  await page.getByLabel(/statement or supporting document/i).setInputFiles(bankAttachmentPath);
  await page.getByLabel(/i confirm these bank details and staged files are correct before save/i).check();
  await page.getByRole("button", { name: /save bank record/i }).click();
  try {
    await page.getByText(/saved successfully/i).waitFor();
  } catch (error) {
    const bodyText = await page.locator("body").innerText();
    throw new Error(`Bank save did not complete. url=${page.url()} body=${bodyText.slice(0, 2000)}`, { cause: error });
  }
  await page.getByText(/^HSBC$/i).first().waitFor();
  await page.getByText(/£4,200\.00|4200/i).first().waitFor();
  await page.getByText(/lf-uat-bank-/i).waitFor();
  await page.getByRole("button", { name: /open document/i }).first().click();
  await page.getByRole("button", { name: /open preview/i }).click();
  await page.getByRole("dialog").getByText(/lf-uat-bank-/i).waitFor();
  await page.getByRole("button", { name: /close/i }).click();
}

async function createPropertyRecord(page) {
  await page.goto("/vault/property");
  await page.getByRole("button", { name: /add property asset/i }).click();
  await page.getByLabel(/property name/i).fill("Launch UAT Family Home");
  await selectValueAndAssert(page.getByLabel(/property type/i), "residential");
  await selectValueAndAssert(page.getByLabel(/ownership type/i), "sole");
  await page.getByLabel(/^address$/i).fill("22 Market Street, York, YO1 4ZZ");
  await selectValueAndAssert(page.getByLabel(/^country$/i), "UK");
  await selectValueAndAssert(page.getByLabel(/occupancy status/i), "main_residence");
  await page.getByLabel(/estimated value/i).fill("525000");
  await selectValueAndAssert(page.getByLabel(/^currency$/i), "GBP");
  await selectValueAndAssert(page.getByLabel(/mortgage status/i), "none");
  const propertyConfirmation = page.getByLabel(/i confirm these property details and staged files are correct before save/i);
  if (await propertyConfirmation.count()) {
    await propertyConfirmation.check();
  }
  await page.getByRole("button", { name: /save property asset/i }).click();
  try {
    await page.getByText(/saved successfully/i).waitFor();
  } catch (error) {
    const bodyText = await page.locator("body").innerText();
    throw new Error(`Property save did not complete. url=${page.url()} body=${bodyText.slice(0, 2000)}`, { cause: error });
  }
  await page.getByText(/Launch UAT Family Home/i).waitFor();
}

async function createLegalWillRecord(page) {
  await page.goto("/legal/wills");
  await page.getByRole("button", { name: /add executor/i }).click();
  await page.getByLabel(/full name/i).fill("Last Will and Testament");
  await page.getByLabel(/role \/ type/i).selectOption({ label: "Executor" });
  await page.getByLabel(/^relationship$/i).selectOption({ label: "Friend" });
  await page.getByLabel(/authority level/i).selectOption({ label: "Primary" });
  await page.getByLabel(/jurisdiction/i).selectOption({ label: "United Kingdom" });
  await page.getByLabel(/^status$/i).selectOption({ label: "Active" });
  await page.getByLabel(/statement or supporting document/i).setInputFiles(willAttachmentPath);
  await page.getByLabel(/i confirm these executor details and staged files are correct before save/i).check();
  await page.getByRole("button", { name: /save executor/i }).click();
  await page.getByText(/saved successfully/i).waitFor();
  await page.getByText(/Last Will and Testament/i).waitFor();
  await page.getByText(/lf-uat-will-/i).waitFor();
}

async function createDashboardContact(page) {
  await page.goto("/personal/contacts");
  const accessToggle = page.getByRole("button", { name: /review invitations & access/i });
  if (await accessToggle.count()) {
    await accessToggle.click();
  }
  await page.getByLabel(/^name$/i).fill("Executor Contact UAT");
  await page.getByLabel(/email/i).last().fill(`executor-contact-${uniqueTag}@example.test`);
  await page.getByLabel(/^role$/i).selectOption({ label: "Executor" });
  await page.getByRole("button", { name: /add contact/i }).click();
  await page.getByText(/contact saved/i).waitFor();
  await page.getByText(/Executor Contact UAT/i).waitFor();
}

async function verifyDashboard(page) {
  await page.goto("/app/dashboard");
  await page.getByText(/Plan and access/i).waitFor();
  const bodyText = await page.locator("body").innerText();
  assert.equal(/No records yet/i.test(bodyText), false);
  assert.equal(/Launch UAT Current Account/i.test(bodyText) || /Last Will and Testament/i.test(bodyText), true);
  assert.equal(/Launch Owner/i.test(bodyText), true);
}

async function seedAssetsToStarterLimit(userId) {
  for (let index = 0; index < 21; index += 1) {
    await createAsset(ownerClient, {
      userId,
      categorySlug: "bank-accounts",
      title: `Starter limit seed ${index + 1}`,
      metadata: {
        provider_name: "Starter Limit Bank",
        account_type: "current_account",
        account_holder: "Launch Owner",
        account_number: `90000${String(index).padStart(3, "0")}`,
        country: "UK",
        currency: "GBP",
        current_balance: 100 + index,
      },
    });
  }
}

async function verifyRecordLimit(page) {
  await page.goto("/finances/bank");
  await page.getByRole("button", { name: /add bank record/i }).click();
  await page.getByLabel(/record title/i).fill("Starter limit allowed");
  await page.getByLabel(/bank \/ provider name/i).fill("Limit Test Bank");
  await page.getByLabel(/account type/i).selectOption({ label: "Current Account" });
  await page.getByLabel(/account holder/i).fill("Launch Owner");
  await page.getByLabel(/account number/i).fill("70000001");
  await page.getByLabel(/^country$/i).selectOption({ label: "United Kingdom" });
  await page.getByLabel(/^currency$/i).selectOption({ label: "GBP" });
  await page.getByRole("button", { name: /save bank record/i }).click();
  await page.getByText(/saved successfully/i).waitFor();
  await page.getByText(/Starter limit allowed/i).waitFor();

  await page.getByRole("button", { name: /add bank record/i }).click();
  await page.getByLabel(/record title/i).fill("Starter limit blocked");
  await page.getByLabel(/bank \/ provider name/i).fill("Limit Test Bank");
  await page.getByLabel(/account type/i).selectOption({ label: "Current Account" });
  await page.getByLabel(/account holder/i).fill("Launch Owner");
  await page.getByLabel(/account number/i).fill("70000002");
  await page.getByLabel(/^country$/i).selectOption({ label: "United Kingdom" });
  await page.getByLabel(/^currency$/i).selectOption({ label: "GBP" });
  await page.getByRole("button", { name: /save bank record/i }).click();
  await page.getByText(/Starter plan limit reached: 25 saved records/i).waitFor();
}

async function seedInvitationsForLimit(userId) {
  const now = new Date().toISOString();
  for (let index = 0; index < 3; index += 1) {
    await ownerClient.from("contact_invitations").insert({
      owner_user_id: userId,
      contact_name: `Limit Seed Contact ${index + 1}`,
      contact_email: `limit-seed-${index + 1}-${uniqueTag}@example.test`,
      assigned_role: "professional_advisor",
      invitation_status: "pending",
      invited_at: now,
      updated_at: now,
    });
  }
}

async function verifyInvitationLimit(page) {
  await page.goto("/app/dashboard");
  await page.getByLabel(/^name$/i).fill("Fifth Invite Contact");
  await page.getByLabel(/email/i).last().fill(`fifth-invite-${uniqueTag}@example.test`);
  await page.getByLabel(/^role$/i).selectOption({ label: "Professional Advisor" });
  await page.getByRole("button", { name: /add contact/i }).click();
  await page.getByText(/contact saved/i).waitFor();
  const fifthRow = page.locator(".lf-contact-invitations-row").filter({ hasText: `fifth-invite-${uniqueTag}@example.test` }).first();
  await fifthRow.waitFor();
  await fifthRow.getByRole("button", { name: /^Send$/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Invitation email") || document.body.innerText.includes("email rate limit exceeded"), null, { timeout: 30000 });

  await page.getByLabel(/^name$/i).fill("Sixth Invite Contact");
  await page.getByLabel(/email/i).last().fill(`sixth-invite-${uniqueTag}@example.test`);
  await page.getByLabel(/^role$/i).selectOption({ label: "Professional Advisor" });
  await page.getByRole("button", { name: /add contact/i }).click();
  await page.getByText(/contact saved/i).waitFor();
  const sixthRow = page.locator(".lf-contact-invitations-row").filter({ hasText: `sixth-invite-${uniqueTag}@example.test` }).first();
  await sixthRow.waitFor();
  await sixthRow.getByRole("button", { name: /^Send$/ }).click();
  await page.getByText(/Starter plan limit reached: 5 invitations/i).waitFor();
}

async function resolveOwnerUserId(email) {
  const user = await waitForUserByEmail(email);
  return user.id;
}

async function ensureOwnerUserExists(email, password) {
  try {
    return await waitForUserByEmail(email);
  } catch {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error || new Error(`Could not provision owner user ${email}`);
    }
    return created.data.user;
  }
}

async function waitForUserByEmail(email) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (list.error) throw list.error;
    const match = list.data.users.find((user) => String(user.email ?? "").toLowerCase() === email.toLowerCase());
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for auth user ${email}`);
}

async function selectValueAndAssert(locator, value) {
  await locator.selectOption(value);
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if ((await locator.inputValue()) === value) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Expected select value ${value} but received ${await locator.inputValue()}`);
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
