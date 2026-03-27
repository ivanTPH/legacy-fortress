import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const OWNER_EMAIL = process.env.E2E_USER_EMAIL;
const OWNER_PASSWORD = process.env.E2E_USER_PASSWORD;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || readEnvFileValue(".env.local", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!OWNER_EMAIL || !OWNER_PASSWORD || !SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing BASE_URL/E2E_USER_EMAIL/E2E_USER_PASSWORD/NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY for admin smoke.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const publicAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const nonAdminEmail = `ivanyardley+lf-admin-nonadmin-${Date.now()}@me.com`;
const nonAdminPassword = "omnistest123?";

async function ensureNonAdminUser() {
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (existing.error) throw existing.error;
  const match = existing.data.users.find((user) => user.email === nonAdminEmail);
  if (match) {
    await admin.auth.admin.updateUserById(match.id, { password: nonAdminPassword, email_confirm: true });
    return match;
  }
  const created = await admin.auth.admin.createUser({
    email: nonAdminEmail,
    password: nonAdminPassword,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw created.error || new Error("Could not create non-admin user.");
  return created.data.user;
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

const browser = await chromium.launch({ headless: true });
const ownerPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await ensureNonAdminUser();

await signIn(ownerPage, OWNER_EMAIL, OWNER_PASSWORD);
const dashboardText = await ownerPage.locator("body").innerText();
const adminLinkVisibleInApp = /admin operations|internal admin|open admin/i.test(dashboardText);

await ownerPage.goto(`${BASE_URL}/internal/admin`, { waitUntil: "networkidle" });
const ownerAdminText = await ownerPage.locator("body").innerText();

const nonAdminSignIn = await publicAuth.auth.signInWithPassword({
  email: nonAdminEmail,
  password: nonAdminPassword,
});
if (nonAdminSignIn.error || !nonAdminSignIn.data.session?.access_token) {
  throw nonAdminSignIn.error || new Error("Could not sign in as non-admin verification user.");
}

const nonAdminApiRes = await fetch(`${BASE_URL}/api/internal/admin/session`, {
  headers: {
    authorization: `Bearer ${nonAdminSignIn.data.session.access_token}`,
  },
});
const nonAdminApiJson = await nonAdminApiRes.json().catch(() => ({}));

console.log(JSON.stringify({
  owner: {
    adminRouteLoaded: /Admin operations|Internal admin operations/i.test(ownerAdminText),
    hasUserLookup: /User lookup/i.test(ownerAdminText),
    hasVerificationQueue: /Executor verification queue/i.test(ownerAdminText),
    hasSupportTools: /Support tools/i.test(ownerAdminText),
  },
  nonAdmin: {
    apiStatus: nonAdminApiRes.status,
    blocked: nonAdminApiRes.status === 403,
    bodySnippet: JSON.stringify(nonAdminApiJson).slice(0, 400),
  },
  appShell: {
    adminVisibleInNormalNavigation: adminLinkVisibleInApp,
  },
  nonAdminEmail,
}, null, 2));

await browser.close();

function readEnvFileValue(filePath, key) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  } catch {
    return "";
  }
}
