import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EXPECTED_SHA = process.env.EXPECTED_STAGING_SHA ?? "";
const RUN_MARKER = `staging-admin-boundary-${Date.now()}`;
const PASSWORD = `StagingAdminBoundary-${Date.now()}-Aa1!`;

const requiredHostedFlag = process.env.LEGACY_FORTRESS_ALLOW_STAGING_BROWSER === "true";
const targetIsStaging = BASE_URL === "https://test.mylegacyfortress.com"
  && SUPABASE_URL === "https://supabase-test.mylegacyfortress.com";

test.describe.configure({ mode: "serial" });

let adminClient: SupabaseClient;
let organisationId = "";
const users: Array<{ id: string; email: string }> = [];

test.beforeAll(async () => {
  test.skip(!requiredHostedFlag, "Staging browser acceptance requires explicit authorization.");
  if (!targetIsStaging) throw new Error("staging_browser_target_mismatch");
  if (!/^[0-9a-f]{40}$/.test(EXPECTED_SHA)) throw new Error("staging_browser_expected_sha_missing");
  if (!ANON_KEY || !SERVICE_KEY) throw new Error("staging_browser_credentials_missing");

  const version = await fetch(`${BASE_URL}/api/version`).then((response) => response.json());
  if (version.env !== "staging" || version.commitSha !== EXPECTED_SHA) {
    throw new Error("staging_browser_version_mismatch");
  }

  adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const platform = await createUser("platform");
  const enterprise = await createUser("enterprise");
  const personal = await createUser("personal");
  await seedCompletedPersonalOnboarding(personal.id);

  const adminRow = await adminClient.from("admin_users").insert({
    email_normalized: platform.email,
    user_id: platform.id,
    display_name: "Staging Platform Admin",
    status: "active",
    is_master: false,
    role: "super_admin",
  });
  if (adminRow.error) throw adminRow.error;

  const organisation = await adminClient.from("enterprise_organisations").insert({
    legal_name: `Staging Boundary ${RUN_MARKER}`,
    trading_name: `Staging Boundary ${RUN_MARKER}`,
    organisation_type: "employer",
    status: "active",
    created_by_user_id: platform.id,
  }).select("id").single();
  if (organisation.error || !organisation.data) throw organisation.error ?? new Error("staging_browser_organisation_missing");
  organisationId = organisation.data.id;

  const membership = await adminClient.from("enterprise_memberships").insert({
    organisation_id: organisationId,
    user_id: enterprise.id,
    email_normalized: enterprise.email,
    full_name: "Staging Enterprise Admin",
    organisation_role: "organisation_admin",
    membership_status: "active",
    onboarding_status: "complete",
    consent_status: "accepted",
    synthetic_run_marker: RUN_MARKER,
    created_by_user_id: platform.id,
    updated_by_user_id: platform.id,
  });
  if (membership.error) throw membership.error;
});

test.afterAll(async () => {
  if (!adminClient) return;
  await adminClient.from("enterprise_memberships").delete().eq("synthetic_run_marker", RUN_MARKER);
  if (organisationId) await adminClient.from("enterprise_organisations").delete().eq("id", organisationId);
  for (const user of users) {
    await adminClient.from("admin_users").delete().eq("user_id", user.id);
    await adminClient.auth.admin.deleteUser(user.id);
  }
});

test("platform admin remains in admin context while using users, invitations, organisation resources and account menu", async ({ page }) => {
  await signIn(page, users[0].email, "/admin");
  await expect(page).toHaveURL(`${BASE_URL}/admin`);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Customer users" })).toBeVisible();
  await page.goto(`${BASE_URL}/admin/invitations`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Invitations", exact: true })).toBeVisible();
  await expect(page.getByText("Platform Admin", { exact: true }).first()).toBeVisible();
  await page.goto(`${BASE_URL}/admin/organisations/${organisationId}`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/admin/organisations/${organisationId}`));
  await expect(page).not.toHaveURL(/\/enterprise/);
  await assertAccountMenu(page);
});

test("enterprise admin is organisation-scoped and cannot use platform administration", async ({ page }) => {
  const session = await signIn(page, users[1].email, "/enterprise");
  await expect(page.getByText(/Enterprise Operations/i).first()).toBeVisible();
  await assertAccountMenu(page);
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  await assertDeniedWorkspace(page, /Admin access is restricted|Access denied|Sign in/i);
  const responseStatus = await page.evaluate(async (accessToken) => (await fetch("/api/internal/admin/admin-users", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })).status, session.access_token);
  expect(responseStatus).toBe(403);
});

test("personal user cannot enter administrative workspaces", async ({ page }) => {
  const session = await signIn(page, users[2].email, "/dashboard");
  await assertAccountMenu(page);
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  await assertDeniedWorkspace(page, /Admin access is restricted|Access denied|Sign in/i);
  const adminResponseStatus = await page.evaluate(async (accessToken) => (await fetch("/api/internal/admin/admin-users", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })).status, session.access_token);
  expect(adminResponseStatus).toBe(403);
  await page.goto(`${BASE_URL}/enterprise`, { waitUntil: "domcontentloaded" });
  await assertDeniedWorkspace(page, /Access denied|Enterprise workspace unavailable|Sign in/i);
});

// Phone-size diagnostics (owner reports, 1 Nov 2026). They report what they find as GitHub notices
// and never fail the release: the findings are fixed in follow-up changes.
function notice(title: string, message: string) {
  console.log(`::notice title=${title}::${message.replace(/\r?\n/g, " | ").slice(0, 900)}`);
}

async function widestOverflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= width + 1) continue;
      // Report the outermost offender only: skip elements whose parent already overflows.
      const parent = element.parentElement?.getBoundingClientRect();
      if (parent && parent.right > width + 1) continue;
      const className = typeof element.className === "string" ? element.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push(`${element.tagName.toLowerCase()}${className ? `.${className}` : ""} right=${Math.round(rect.right)}`);
      if (offenders.length >= 6) break;
    }
    return { width, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
}

test("phone: platform admin pages fit the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, users[0].email, "/admin");
  for (const path of ["/admin", "/admin/verification", "/admin/authorities", "/admin/probate", "/admin/users"]) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.waitForTimeout(1500);
    const result = await widestOverflow(page);
    notice(`Phone layout ${path}`, result.scrollWidth > result.width + 1
      ? `too wide: page ${result.scrollWidth}px on a ${result.width}px screen; ${result.offenders.join("; ")}`
      : `fits (${result.width}px)`);
  }
});

test("phone: owner records a Power of Attorney and links a person", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, users[2].email, "/legal/power-of-attorney?add=1");
  await page.waitForTimeout(2500);
  const steps: string[] = [];
  const fields = await page.locator("form input:visible, main input:visible, main textarea:visible, main select:visible").evaluateAll((elements) => elements.map((element) => {
    const input = element as HTMLInputElement;
    const label = input.labels?.[0]?.textContent?.trim() || input.getAttribute("aria-label") || input.name || input.placeholder || input.type;
    return `${label}${input.required ? "*" : ""}`;
  }));
  steps.push(`fields: ${fields.join(", ").slice(0, 300)}`);
  await page.getByLabel(/Document name/i).first().fill("Synthetic Lasting Power of Attorney").catch(() => steps.push("no Document name field"));
  await page.getByLabel(/Short description/i).first().fill("Property and financial affairs, synthetic").catch(() => steps.push("no Short description field"));
  const saveAndAdd = page.getByRole("button", { name: /Save and add person/i });
  if (!(await saveAndAdd.count())) {
    steps.push("no 'Save and add person' button");
  } else {
    await saveAndAdd.first().click();
    await page.waitForTimeout(4000);
    const alerts = (await page.locator("[role=alert], .lf-v4-form-error").allInnerTexts()).filter(Boolean).join(" / ");
    steps.push(`after save: url=${page.url().replace(BASE_URL, "")}${alerts ? ` messages=${alerts}` : ""}`);
    const dialog = page.getByRole("dialog");
    steps.push(`add-person panel ${await dialog.count() ? `open: ${(await dialog.first().innerText()).slice(0, 160)}` : "not open"}`);
    const linkedSection = page.getByText(/People linked to this document/i);
    steps.push(`linked-people section ${await linkedSection.count() ? "shown" : "not shown"}`);
  }
  const layout = await widestOverflow(page);
  if (layout.scrollWidth > layout.width + 1) steps.push(`too wide: ${layout.offenders.join("; ")}`);
  notice("Phone: Power of Attorney record", steps.join(" || "));
});

async function createUser(role: string) {
  const email = `${RUN_MARKER}-${role}@example.test`;
  const result = await adminClient.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Staging ${role} Admin` } });
  if (result.error || !result.data.user) throw result.error ?? new Error("staging_browser_user_missing");
  users.push({ id: result.data.user.id, email });
  const profile = await adminClient.from("user_profiles").insert({ user_id: result.data.user.id, display_name: `Staging ${role === "personal" ? "Personal User" : `${role[0].toUpperCase()}${role.slice(1)} Admin`}` });
  if (profile.error) throw profile.error;
  return { id: result.data.user.id, email };
}

async function seedCompletedPersonalOnboarding(userId: string) {
  const now = new Date().toISOString();
  const onboarding = await adminClient.from("user_onboarding_state").upsert({
    user_id: userId,
    current_step: "complete",
    completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"],
    is_completed: true,
    terms_accepted: true,
    marketing_opt_in: false,
    tour_opt_in: false,
  }, { onConflict: "user_id" });
  if (onboarding.error) throw onboarding.error;

  const terms = await adminClient.from("terms_acceptances").upsert({
    user_id: userId,
    terms_version: "legacy-fortress-2026-03",
    accepted: true,
    accepted_at: now,
    source: "staging_browser_acceptance",
  }, { onConflict: "user_id" });
  if (terms.error) throw terms.error;
}

async function signIn(page: Page, email: string, next: string) {
  const authClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await authClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (auth.error || !auth.data.session) throw auth.error ?? new Error("staging_browser_authentication_failed");
  let session = auth.data.session;
  // Staff portals need a two-step sign-in (authenticator code) when it is enforced.
  if (next.startsWith("/admin") || next.startsWith("/enterprise")) {
    const enrol = await authClient.auth.mfa.enroll({ factorType: "totp", friendlyName: "Synthetic browser acceptance" });
    if (!enrol.error && enrol.data) {
      const verified = await authClient.auth.mfa.challengeAndVerify({ factorId: enrol.data.id, code: totpCode(enrol.data.totp.secret) });
      const upgraded = await authClient.auth.getSession();
      if (!verified.error && upgraded.data.session) session = upgraded.data.session;
    }
  }
  await page.context().clearCookies();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.evaluate((session) => {
    window.localStorage.setItem("sb-supabase-test-auth-token", JSON.stringify(session));
  }, session);
  await page.goto(`${BASE_URL}${next}`, { waitUntil: "domcontentloaded" });
  return session;
}

async function assertAccountMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /Open account menu for/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Account menu" })).toHaveCount(0);
  await trigger.click();
  await page.getByRole("heading").first().click();
  await expect(page.getByRole("menu", { name: "Account menu" })).toHaveCount(0);
}

async function assertDeniedWorkspace(page: Page, heading: RegExp) {
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
}

/** RFC 6238 code (30 s, 6 digits, SHA-1), as an authenticator app shows. */
function totpCode(base32Secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32Secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String(((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000)).padStart(6, "0");
}
