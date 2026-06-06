#!/usr/bin/env node

import assert from "node:assert/strict";
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
const uniqueTag = Date.now();
const authEmail = process.env.SMOKE_AUTH_EMAIL || `ivanyardley+lf-auth-smoke-${uniqueTag}@me.com`;
const originalPassword = process.env.SMOKE_AUTH_PASSWORD || "AuthSmoke123!";
const resetPassword = process.env.SMOKE_AUTH_RESET_PASSWORD || "AuthSmoke456!";

let createdUserId = "";
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  await verifyPublicAuthPages(page);
  await verifyInvalidCallbackRecovery(page);
  createdUserId = await verifySignupEmailLink(page);
  await verifyPasswordSignIn(page, originalPassword);
  await verifyRecoveryEmailLink(page);
  await verifyPasswordSignIn(page, resetPassword);

  console.log(JSON.stringify({
    authEmail,
    userId: createdUserId,
    authReliability: {
      publicAuthPagesLoad: true,
      invalidCallbackRecovery: true,
      signupVerificationLinkCompletes: true,
      passwordSignInWorks: true,
      recoveryLinkCompletes: true,
      resetPasswordWorks: true,
    },
  }, null, 2));
} finally {
  await browser.close();
  if (createdUserId && process.env.SMOKE_KEEP_AUTH_USER !== "1") {
    await admin.auth.admin.deleteUser(createdUserId);
  }
}

async function verifyPublicAuthPages(page) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /^sign in$/i }).waitFor();
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /create account/i }).waitFor();
  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /reset password|forgot password/i }).waitFor();
}

async function verifyInvalidCallbackRecovery(page) {
  await page.goto("/auth/callback?token_hash=not-a-real-token&type=signup&next=%2Fonboarding", { waitUntil: "networkidle" });
  await page.getByText(/Sign-in failed/i).waitFor();
  await page.getByRole("link", { name: /go to sign in/i }).waitFor();
  await page.getByRole("link", { name: /create account/i }).waitFor();
}

async function verifySignupEmailLink(page) {
  const link = await generateActionLink({
    type: "signup",
    email: authEmail,
    password: originalPassword,
    redirectTo: `${BASE_URL}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
  });

  await page.goto(link, { waitUntil: "networkidle" });
  await page.waitForURL(/\/onboarding|\/profile|\/dashboard|\/account\/terms/, { timeout: 45000 });

  const user = await waitForUserByEmail(authEmail);
  assert.equal(Boolean(user.email_confirmed_at || user.confirmed_at), true);
  return user.id;
}

async function verifyPasswordSignIn(page, password) {
  await clearBrowserAuthState(page);
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(authEmail);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/onboarding|\/profile|\/dashboard|\/account\/terms/, { timeout: 45000 });
}

async function clearBrowserAuthState(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function verifyRecoveryEmailLink(page) {
  const link = await generateActionLink({
    type: "recovery",
    email: authEmail,
    redirectTo: `${BASE_URL}/reset-password`,
  });

  await page.goto(link, { waitUntil: "networkidle" });
  await page.waitForURL(/\/reset-password/, { timeout: 45000 });
  await page.getByText(/Recovery link verified|Enter your new password/i).waitFor();
  await page.getByLabel(/^new password$/i).fill(resetPassword);
  await page.getByLabel(/confirm password/i).fill(resetPassword);
  await page.getByRole("button", { name: /update password|save password|reset password/i }).click();
  await page.getByText(/Password updated successfully/i).waitFor();
  await page.waitForURL(/\/sign-in/, { timeout: 45000 });
}

async function generateActionLink({ type, email, password, redirectTo }) {
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email,
    password,
    options: { redirectTo },
  });
  if (error) throw error;
  const actionLink = data?.properties?.action_link;
  if (!actionLink) throw new Error(`Supabase did not return an action link for ${type}.`);
  return actionLink;
}

async function waitForUserByEmail(email) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (list.error) throw list.error;
    const user = list.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for auth user ${email}`);
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
