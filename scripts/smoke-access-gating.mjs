#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

loadEnvFile();

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ownerEmail = `ivanyardley+lf-gating-${Date.now()}@me.com`;
const ownerPassword = "omnistest123?";

const owner = await admin.auth.admin.createUser({
  email: ownerEmail,
  password: ownerPassword,
  email_confirm: true,
  user_metadata: {
    full_name: "Access Gate Test User",
  },
});

if (owner.error || !owner.data.user) {
  throw owner.error || new Error("Could not create owner-style test user.");
}

const ownerUserId = owner.data.user.id;

await ensureOwnerRequiresTerms(ownerUserId);

const browser = await chromium.launch({ headless: true });
let page = null;

try {
  const context = await browser.newContext({ baseURL: BASE_URL, acceptDownloads: true });
  page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(35000);

  await page.goto("/sign-in");
  await page.getByRole("heading", { name: /^sign in$/i }).waitFor();
  const emailInput = page.getByLabel(/email/i).first();
  const passwordInput = page.getByLabel(/^password/i).first();
  await emailInput.click();
  await emailInput.pressSequentially(ownerEmail, { delay: 20 });
  await passwordInput.click();
  await passwordInput.pressSequentially(ownerPassword, { delay: 20 });
  await page.waitForFunction(() => {
    const email = document.querySelector('input[type="email"]');
    const password = document.querySelector('input[autocomplete="current-password"]');
    const button = document.querySelector('form button[type="submit"]');
    return (
      email instanceof HTMLInputElement &&
      password instanceof HTMLInputElement &&
      email.value.length > 0 &&
      password.value.length > 0 &&
      button instanceof HTMLButtonElement &&
      !button.disabled
    );
  });
  await page.locator('form button[type="submit"]').first().click();

  await page.waitForURL(/\/account\/terms\?required=1/, { timeout: 30000 });
  await page.getByText(/needs terms acceptance before you can continue/i).waitFor();

  await page.getByRole("button", { name: /accept terms and continue/i }).click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 30000 });

  await page.goto("/profile");
  await page.getByRole("heading", { name: /^profile$/i }).waitFor();
  await page.getByRole("button", { name: /edit profile/i }).click();
  const uploadFixture = path.join(os.tmpdir(), `lf-profile-photo-${Date.now()}.png`);
  fs.writeFileSync(
    uploadFixture,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0wAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  await page.evaluate(() => {
    const input = document.querySelector('input[type="file"][aria-label="Choose profile photo"]');
    if (input instanceof HTMLInputElement) {
      input.addEventListener("click", () => {
        window.__lfProfileAvatarInputClicked = true;
      }, { once: true });
    }
  });
  await page.locator("label", { hasText: /add photo|change photo/i }).first().click();
  await page.waitForFunction(() => window.__lfProfileAvatarInputClicked === true);
  await page.locator('input[type="file"][aria-label="Choose profile photo"]').setInputFiles(uploadFixture);
  await page.getByText(/staged preview ready/i).waitFor();

  await page.goto("/finances/bank");
  await page.getByRole("button", { name: /add bank record/i }).click();
  await page.waitForURL(/\/finances\/bank/, { timeout: 15000 });
  await page.getByLabel(/record title/i).waitFor();

  console.log(JSON.stringify({
    ownerFlow: {
      redirectedToTermsImmediately: true,
      acceptedTermsAndReachedDashboard: true,
      profilePhotoActionReachedNativeInput: true,
      profilePhotoActionStagedSelection: true,
      addBankRecordStayedInFlow: true,
    },
    ownerEmail,
  }, null, 2));
} catch (error) {
  const termsState = await admin
    .from("terms_acceptances")
    .select("terms_version,accepted,accepted_at,updated_at")
    .eq("user_id", ownerUserId)
    .maybeSingle();
  console.error(JSON.stringify({
    ownerEmail,
    ownerUserId,
    termsState: termsState.error ? { error: termsState.error.message } : termsState.data,
    currentUrl: page?.url?.() ?? null,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}

async function ensureOwnerRequiresTerms(userId) {
  const now = new Date().toISOString();

  const onboarding = await admin
    .from("user_onboarding_state")
    .upsert({
      user_id: userId,
      current_step: "complete",
      completed_steps: ["identity", "verification", "consent", "personal_details", "complete"],
      is_completed: true,
      terms_accepted: true,
      marketing_opt_in: false,
      tour_opt_in: false,
      updated_at: now,
    }, { onConflict: "user_id" });
  if (onboarding.error) {
    throw onboarding.error;
  }

  const deleteTerms = await admin
    .from("terms_acceptances")
    .delete()
    .eq("user_id", userId);
  if (deleteTerms.error) {
    throw deleteTerms.error;
  }
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
