import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Website screenshots from a synthetic demo account on TEST (owner approved 3 Nov 2026).
 * Uses one fixed synthetic "Bill Smith" account (TEST keeps accounts that have audit history), refreshes its
 * synthetic review data, and photographs the main screens on desktop and phone. The TEST banner is hidden in
 * these photos only. Images are printed to the log as JPEG base64 (artifact downloads aren't reachable).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL = "staging-demo-shots@example.test";
const PASSWORD = `StagingDemoShots-${Date.now()}-Aa1!`;
const OUT = "test-results/demo-shots";
const PAGES_ALL = ["/dashboard", "/finances", "/finances/bank", "/property", "/legal", "/legal/wills", "/personal", "/contacts", "/people-access", "/people-access?view=vault-access", "/people-access?view=sharing", "/access-sharing", "/account/billing",
  // UX review (10 Nov 2026): the rest of the everyday screens.
  "/business", "/vault/digital", "/vault/personal", "/actions", "/actions?filter=updates", "/settings", "/settings/security", "/settings/my-vault", "/support", "/profile", "/add"]; // /onboarding has its own guided set-up test below
// Tour video (owner request 7 Nov 2026): the same steps with a record opened, so the film can zoom in on it.
const PAGES = PAGES_ALL;
const OPENED_ALL = ["/finances/bank", "/legal/wills", "/contacts"];

const allowed = process.env.LEGACY_FORTRESS_ALLOW_STAGING_BROWSER === "true";
const targetIsStaging = BASE_URL === "https://test.mylegacyfortress.com" && SUPABASE_URL === "https://supabase-test.mylegacyfortress.com";

test.describe.configure({ mode: "serial" });
let admin: SupabaseClient;
let userId = "";

test.beforeAll(async () => {
  test.skip(!allowed, "Staging screenshots require explicit authorization.");
  if (!targetIsStaging) throw new Error("staging_target_mismatch");
  if (!ANON_KEY || !SERVICE_KEY) throw new Error("staging_credentials_missing");
  admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = await findUser(EMAIL);
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing, { password: PASSWORD });
    if (updated.error) throw updated.error;
    userId = existing;
  } else {
    const created = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Bill Smith" } });
    if (created.error || !created.data.user) throw created.error ?? new Error("demo_user_missing");
    userId = created.data.user.id;
  }
  const now = new Date().toISOString();
  for (const [table, row, conflict] of [
    ["user_onboarding_state", { user_id: userId, current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"], is_completed: true, terms_accepted: true, marketing_opt_in: false, tour_opt_in: false }, "user_id"],
    ["terms_acceptances", { user_id: userId, terms_version: "legacy-fortress-2026-03", accepted: true, accepted_at: now, source: "staging_demo_screenshots" }, "user_id"],
    ["identity_assurance_states", { user_id: userId, identity_level: 2, provider_key: "staging_synthetic", provider_assurance_class: "level_2_synthetic", verified_at: now }, "user_id"],
  ] as const) {
    const result = await admin.from(table).upsert(row, { onConflict: conflict });
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
  }
  // The existing synthetic review data set (accounts, property, will, LPA, pension, insurance, business, people).
  execFileSync("node", ["scripts/seed-bill-smith-review-account.mjs"], { stdio: "inherit", env: { ...process.env, SEED_TARGET_EMAIL: EMAIL } });
  fs.mkdirSync(OUT, { recursive: true });
});

const OPENED = OPENED_ALL;

async function findUser(email: string) {
  for (let page = 1; page < 50; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (result.data.users.length < 200) return null;
  }
  return null;
}

/** New-device check (4 Nov 2026): mark this synthetic password session trusted, as "Remember this device" does. */
async function trustSession(client: SupabaseClient, accessToken: string) {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: string; sub?: string };
    if (!claims.session_id || !claims.sub) return;
    await client.from("trusted_sessions").upsert({ session_id: claims.session_id, user_id: claims.sub, method: "remembered_device" }, { onConflict: "session_id" });
  } catch { /* before the new-device migration there is nothing to record */ }
}

// Owner report 10 Nov 2026 ("This page couldn't load"): record every in-browser error, and fail if an error page shows.
const watched = new WeakSet<Page>();
function watchErrors(page: Page) {
  if (watched.has(page)) return;
  watched.add(page);
  page.on("pageerror", (error) => console.log(`Page-error: ${new URL(page.url()).pathname} ${error.name}: ${error.message}`.slice(0, 400)));
  page.on("console", (message) => { if (message.type() === "error" && /\[LF\]|ChunkLoad|chunk/i.test(message.text())) console.log(`Console-error: ${new URL(page.url()).pathname} ${message.text()}`.slice(0, 400)); });
}
async function assertNoErrorPage(page: Page, name: string) {
  const broken = await page.getByText(/This page couldn.t load|Sorry, this page didn.t load/).filter({ visible: true }).count().catch(() => 0);
  expect(broken, `${name}: an error page is showing`).toBe(0);
}

async function signIn(page: Page) {
  watchErrors(page);
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (auth.error || !auth.data.session) throw auth.error ?? new Error("demo_sign_in_failed");
  await trustSession(admin, auth.data.session.access_token);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((session) => { window.localStorage.clear(); window.localStorage.setItem("sb-supabase-test-auth-token", JSON.stringify(session)); }, auth.data.session);
}

async function shoot(page: Page, name: string) {
  await page.addStyleTag({ content: ".lf-uat-environment-banner{display:none!important}" }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const shot = await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82 });
  console.log(`Demo-shot: ${name} ${new URL(page.url()).pathname} ${shot.toString("base64")}`);
  await assertNoErrorPage(page, name);
}

async function capture(browser: Browser, kind: "desk" | "phone") {
  const context = kind === "desk"
    ? await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await signIn(page);
  for (const path of PAGES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname, `${path} opened sign-in instead`).not.toMatch(/sign-in|login|onboarding/);
    await shoot(page, `${kind}${path.replace(/[^a-z0-9]+/gi, "-")}`);
  }
  for (const path of OPENED) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const row = page.locator("main button[aria-expanded='false'], main [role='button'][aria-expanded='false']").first();
    if (await row.isVisible().catch(() => false)) {
      await row.click().catch(() => undefined);
      await shoot(page, `${kind}${path.replace(/[^a-z0-9]+/gi, "-")}-open`);
    }
  }
  // The home dashboard, captured again once everything has loaded (the first shot of a run can miss it).
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Total recorded value").first()).toBeVisible({ timeout: 30_000 }).catch(() => undefined);
  await shoot(page, `${kind}-home`);
  // The Premium sheet as it appears when a free limit is reached.
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  // Ask until the page has finished loading and the sheet is listening.
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lf:premium-required", { detail: { reason: "type" } })));
    await expect(page.locator(".lf-premium-sheet")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  await shoot(page, `${kind}-premium-sheet`);
  await context.close();
}

test("To do agrees with the vault: the sample account has a Will, so it isn't asked for one", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page);
  await page.goto(`${BASE_URL}/actions`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.getByText("Do you have a Will?")).toHaveCount(0);
  await expect(page.getByText("No will has been uploaded")).toHaveCount(0);
  await context.close();
});

// Website and sign-in journey (owner question 7 Nov 2026), on a laptop and a phone, synthetic account only.
for (const kind of ["desk", "phone"] as const) {
  test(`website and sign-in journey (${kind})`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = kind === "desk"
      ? await browser.newContext({ viewport: { width: 1440, height: 900 } })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    // 1. A browser that has never signed in sees the website with Sign in / Start free.
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("header a[data-signup]").first()).toHaveAttribute("href", "/sign-up");
    await expect(page.getByText("Open my Vault")).toHaveCount(0);
    await shoot(page, `journey-${kind}-1-website-signed-out`);
    // 2. Signing in with a password on a new browser asks for the emailed code. The code request itself is
    //    blocked here, so no email is sent to the synthetic address.
    await page.route("**/auth/v1/otp**", (route) => route.abort());
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.locator("input[type=email]").first().fill(EMAIL);
    await page.locator("input[type=password]").first().fill(PASSWORD);
    await page.locator("button[type=submit]").filter({ hasText: /sign in/i }).first().click();
    await page.waitForURL(/verify-device|dashboard/, { timeout: 30_000 });
    const askedForCode = /verify-device/.test(page.url());
    console.log(`Journey ${kind}: new browser after password -> ${new URL(page.url()).pathname}`);
    await shoot(page, `journey-${kind}-2-after-password`);
    expect(askedForCode, "a new browser should be asked for the emailed code").toBe(true);
    await page.unroute("**/auth/v1/otp**");
    // 3. Once this browser is trusted (as "Remember this device" does), the website offers the Vault.
    await signIn(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const vault = page.locator("header a[data-signup]").first();
    await expect(vault).toHaveAttribute("href", "/dashboard");
    await expect(vault).toBeVisible();
    await expect(page.locator("section#top a[data-signup]").first()).toHaveText("Open my Vault");
    await shoot(page, `journey-${kind}-3-website-signed-in`);
    // 3b. The sign-in page knows too: "You're signed in" with Continue to my Vault (9 Nov 2026).
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Continue to my Vault/ })).toBeVisible({ timeout: 20_000 });
    await shoot(page, `journey-${kind}-3b-sign-in-page-signed-in`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    // 4. Tapping it opens the Vault without signing in again.
    await vault.click();
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
    // The phone dashboard has a different layout, so check we're in the Vault rather than for a desktop label.
    await expect(page.getByText(/Finances/).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).not.toMatch(/sign-in|verify-device/);
    await shoot(page, `journey-${kind}-4-vault`);
    await context.close();
  });
}

// Inbox, Mail style (owner, 11 Nov 2026). Uses the synthetic account only. Read marks it changes are its own rows;
// Later is opened and cancelled, and nothing is completed or cleared.
for (const kind of ["desk", "phone"] as const) {
  test(`inbox (${kind})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = kind === "desk"
      ? await browser.newContext({ viewport: { width: 1440, height: 900 } })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await signIn(page);
    await page.goto(`${BASE_URL}/actions`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Inbox" }).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    for (const name of [/^All, \d+/, /^Needs you, \d+/, /^Waiting, \d+/, /^Updates, \d+/, /^Archived, \d+/]) await expect(page.getByRole("button", { name })).toBeVisible();
    await expect(page.locator(".lf-notification-control")).toHaveCount(0);
    await expect(page.locator(".lf-inbox-row").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shoot(page, `inbox-${kind}-1-all`);
    // The badge and "N need you" are the same number (owner saw 2 on the badge and "5 need you" on 11 Nov 2026).
    const needYou = Number((await page.locator(".lf-inbox-subtitle").first().innerText()).match(/(\d+) needs? you/)?.[1] ?? "0");
    const badge = page.locator(kind === "phone" ? ".lf-mobile-tab-badge" : ".lf-nav-badge").filter({ visible: true }).first();
    if (needYou > 0) await expect(badge).toHaveText(String(needYou), { timeout: 10_000 });
    else await expect(badge).toHaveCount(0, { timeout: 10_000 });

    // Select: tick a row, the floating bar appears; Later opens the date sheet; cancel everything.
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.locator(".lf-inbox-row-button").first().click();
    await expect(page.getByText("1 selected")).toBeVisible();
    const toolbar = page.getByRole("toolbar", { name: "Selected items" });
    // On screen, not tucked under the list (owner couldn't see it, 11 Nov 2026); on a phone it replaces the tab bar.
    await expect(toolbar).toBeInViewport();
    await expect(toolbar.getByRole("button", { name: /^(Read|Unread)$/ })).toBeVisible(); // depends on the row picked
    for (const name of ["Later", "Archive", "Done", "Delete"]) await expect(toolbar.getByRole("button", { name, exact: true })).toBeVisible();
    if (kind === "phone") await expect(page.locator(".lf-mobile-bottom-nav")).toBeHidden();
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    const rowCount = await page.locator(".lf-inbox-row").count();
    await expect(page.getByText(`${rowCount} selected`)).toBeVisible();
    await shoot(page, `inbox-${kind}-2-select`);
    await page.getByRole("button", { name: "Deselect all", exact: true }).click();
    await page.locator(".lf-inbox-row-button").first().click();
    await page.getByRole("toolbar", { name: "Selected items" }).getByRole("button", { name: "Later" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Tomorrow morning" })).toBeVisible();
    await shoot(page, `inbox-${kind}-3-later`);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    if (kind === "phone") {
      // Swipes: one action per side (owner, 11 Nov 2026). Right shows Read/Unread only; left shows Later and Done.
      // The message slides over the buttons at full width rather than squashing. Nothing is tapped.
      const swipe = async (index: number, dx: number) => {
        const box = await page.locator(".lf-inbox-row .lf-swipe").nth(index).boundingBox();
        if (!box) throw new Error("No row to swipe");
        await page.locator(".lf-inbox-row .lf-swipe").nth(index).evaluate((el, { x, y, dx: move }) => {
          const fire = (type: string, cx: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", pointerId: 7, clientX: cx, clientY: y, isPrimary: true }));
          fire("pointerdown", x);
          for (let i = 1; i <= 8; i += 1) fire("pointermove", x + (move * i) / 8);
          fire("pointerup", x + move);
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2, dx });
      };
      const rowIndex = (await page.locator(".lf-inbox-row").evaluateAll((rows) => rows.findIndex((row) => row.querySelector(".lf-inbox-tag")?.textContent === "Needs you")));
      const target = Math.max(0, rowIndex);
      const swipeRow = page.locator(".lf-inbox-row").nth(target);
      const fullWidth = (await swipeRow.locator(".lf-inbox-row-copy").boundingBox())!.width;
      await swipe(target, 110);
      const right = swipeRow.locator(".lf-swipe-actions.is-right[data-showing]");
      await expect(right).toBeVisible();
      await expect(right.getByRole("button")).toHaveCount(1);
      await expect(right.getByRole("button")).toHaveText(/Read|Unread/);
      await page.waitForTimeout(400);
      expect(Math.round((await swipeRow.locator(".lf-inbox-row-copy").boundingBox())!.width)).toBe(Math.round(fullWidth));
      await shoot(page, `inbox-${kind}-5-swipe-right`);
      await swipe(target, -110 - 110);
      const left = swipeRow.locator(".lf-swipe-actions.is-left[data-showing]");
      await expect(left).toBeVisible();
      await expect(left.getByRole("button", { name: "Later" })).toBeVisible();
      await expect(left.getByRole("button", { name: /Read|Unread/ })).toHaveCount(0);
      await page.waitForTimeout(400);
      expect(Math.round((await swipeRow.locator(".lf-inbox-row-copy").boundingBox())!.width)).toBe(Math.round(fullWidth));
      await shoot(page, `inbox-${kind}-6-swipe-left`);
      await swipeRow.locator(".lf-inbox-row-copy").click(); // a tap on an open row just closes it
      await expect(swipeRow.locator(".lf-swipe-actions[data-showing]")).toHaveCount(0);
      await expect(page.locator(".lf-inbox-message")).toHaveCount(0);

      // Archive one item, see it in Archived, move it back. Only this synthetic account's own Inbox rows change.
      const firstTitle = (await page.locator(".lf-inbox-row .lf-inbox-row-top strong").first().innerText()).split("\n")[0];
      await page.getByRole("button", { name: "Select", exact: true }).click();
      await page.locator(".lf-inbox-row-button").first().click();
      await toolbar.getByRole("button", { name: "Archive", exact: true }).click();
      await expect(page.getByText("Moved to Archived")).toBeVisible();
      const archivedChip = page.getByRole("button", { name: /^Archived, [1-9]/ });
      await archivedChip.click();
      await expect(archivedChip).toBeInViewport({ ratio: 1 }); // the chosen filter is never cut off
      await expect(page.locator(".lf-inbox-row").filter({ hasText: firstTitle })).toBeVisible();
      await shoot(page, `inbox-${kind}-7-archived`);
      await page.getByRole("button", { name: "Select", exact: true }).click();
      await page.getByRole("button", { name: "Select all", exact: true }).click();
      await toolbar.getByRole("button", { name: "Inbox", exact: true }).click();
      await expect(page.getByText("Moved back to Inbox")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Archived, 0/ })).toBeVisible();

      // Delete (bin) is only for updates and own reminders: offered for an update, not for a suggestion. Not pressed.
      await page.getByRole("button", { name: /^All, \d+/ }).click();
      await page.getByRole("button", { name: "Select", exact: true }).click();
      const suggestionRow = page.locator(".lf-inbox-row").filter({ has: page.locator(".lf-inbox-tag", { hasText: /^(Suggested|Needs you|Waiting)$/ }) }).first();
      await suggestionRow.locator(".lf-inbox-row-button").click();
      await expect(toolbar.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
      const updateRow = page.locator(".lf-inbox-row").filter({ has: page.locator(".lf-inbox-tag", { hasText: /^Update$/ }) }).first();
      if (await updateRow.count()) {
        await updateRow.locator(".lf-inbox-row-button").click();
        await expect(toolbar.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
      }
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: /^All, \d+/ }).click();
    }

    if (kind === "desk") {
      // Laptop: pointing at a row shows Read/Unread, Later, Done. Unread survives a reload with this browser's copy wiped.
      const row = page.locator(".lf-inbox-row").first();
      const dot = row.locator(".lf-inbox-dot");
      await row.hover();
      await expect(row.locator(".lf-inbox-hover")).toBeVisible();
      await shoot(page, `inbox-${kind}-4-hover`);
      const toggle = row.locator(".lf-inbox-hover button").first();
      if ((await toggle.textContent())?.trim() === "Read") { await toggle.click(); await row.hover(); }
      await expect(dot).not.toHaveClass(/is-new/);
      await row.locator(".lf-inbox-hover button").first().click(); // Unread
      await expect(dot).toHaveClass(/is-new/);
      await page.waitForTimeout(1500);
      await page.evaluate(() => { window.localStorage.removeItem("lf:inbox:read"); window.localStorage.removeItem("lf:inbox:read-pending"); });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".lf-inbox-row").first().locator(".lf-inbox-dot")).toHaveClass(/is-new/, { timeout: 30_000 });
      console.log("Inbox desk: Unread survives a reload with this browser's copy wiped (synced on TEST)");
    }

    // Executors decided in place: the panel loads and its buttons can be reached (owner, 11 Nov 2026: on a phone the
    // Add form's buttons were hidden below the screen in the design). Nothing is added or sent.
    const executorRow = page.locator(".lf-inbox-row-button[data-named]").first();
    // The seed puts two names "found" in Bill's Will (Sarah Smith, in People; Robert Sample, not), so this step is always there.
    await expect(executorRow).toBeVisible({ timeout: 20_000 });
    {
      await executorRow.click();
      await expect(page.locator(".lf-inbox-message .lf-named, .lf-inbox-message .lf-inbox-message-body").first()).toBeVisible({ timeout: 20_000 });
      const drawerText = async () => (await page.locator(".lf-inbox-message").count())
        ? (await page.locator(".lf-inbox-message").first().innerText()).replace(/\s+/g, " ").slice(0, 400) : "(drawer closed)";
      console.log(`Inbox ${kind} executors, just opened: ${await drawerText()}`);
      await page.locator(".lf-named, .lf-inbox-message-body").filter({ hasNotText: "Loading the names" }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      console.log(`Inbox ${kind} executors, 3s later: ${await drawerText()}`);
      const done = page.locator(".lf-inbox-message").getByRole("button", { name: "Done", exact: true });
      await done.scrollIntoViewIfNeeded();
      await expect(done).toBeInViewport();
      await shoot(page, `inbox-${kind}-4b-executors`);
      await expect(page.locator(".lf-named").getByText("Robert Sample")).toBeVisible();
      await expect(page.locator(".lf-named").getByRole("button", { name: "Confirm", exact: true }).first()).toBeVisible();
      const add = page.locator(".lf-named").getByRole("button", { name: "Add", exact: true }).first();
      {
        await add.click();
        const addInvite = page.getByRole("button", { name: "Add and invite" });
        await addInvite.scrollIntoViewIfNeeded();
        await expect(addInvite).toBeInViewport();
        await shoot(page, `inbox-${kind}-4c-add-form`);
      }
      await page.locator(".lf-inbox-message .lf-inbox-back").click();
    }

    await page.getByRole("button", { name: /^Updates, \d+/ }).click();
    await shoot(page, `inbox-${kind}-5-updates`);
    await page.getByRole("button", { name: /^All, \d+/ }).click();

    // One tap goes straight to the thing (no in-between screen) for an action that isn't your own task.
    const target = page.locator(".lf-inbox-row.is-needs .lf-inbox-row-button:not([data-named])").filter({ hasNotText: /Your task/ }).first();
    if (await target.count()) {
      await target.click();
      await page.waitForURL((url) => !url.pathname.startsWith("/actions") || url.search.includes("review=") || url.search.includes("request="), { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      console.log(`Inbox ${kind}: one tap opened ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
      await shoot(page, `inbox-${kind}-6-one-tap`);
    }
    await context.close();
  });
}

// Guided set-up (UX review, 10 Nov 2026), shown for the synthetic account without changing anything on TEST:
// the page is told set-up isn't finished yet, and every table write is answered here instead of reaching TEST.
for (const kind of ["desk", "phone"] as const) {
  test(`guided set-up screens (${kind})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = kind === "desk"
      ? await browser.newContext({ viewport: { width: 1440, height: 900 } })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await signIn(page);
    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const url = request.url();
      if (request.method() === "GET") {
        if (!/\/rest\/v1\/user_onboarding_state/.test(url)) return route.continue();
        const response = await route.fetch();
        const body = await response.json().catch(() => null);
        const notDone = (row: Record<string, unknown>) => ({ ...row, is_completed: false, current_step: "identity" });
        return route.fulfill({ response, json: Array.isArray(body) ? body.map(notDone) : body && typeof body === "object" ? notDone(body) : body });
      }
      if (/\/rest\/v1\/rpc\//.test(url)) return route.continue();
      let sent: unknown = null;
      try { sent = request.postDataJSON(); } catch { sent = null; }
      const rows = Array.isArray(sent) ? sent : sent ? [sent] : [];
      const single = /vnd\.pgrst\.object/.test(request.headers()["accept"] ?? "");
      console.log(`Set-up ${kind}: answered ${request.method()} ${new URL(url).pathname} here, nothing written`);
      return route.fulfill({ status: 201, json: single ? (rows[0] ?? {}) : rows });
    });
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Is this right\?|What’s your name\?/ })).toBeVisible({ timeout: 30_000 });
    await shoot(page, `setup-${kind}-1-name`);
    await page.getByRole("button", { name: /Yes, continue|^Continue$/ }).click();
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible({ timeout: 30_000 });
    await shoot(page, `setup-${kind}-2-welcome`);
    await page.getByRole("link", { name: /Watch a 1-minute tour first/ }).click();
    await page.waitForURL(/how-it-works\?from=setup/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Back to set-up/ })).toBeVisible({ timeout: 30_000 });
    await shoot(page, `setup-${kind}-3-tour`);
    await page.getByRole("link", { name: /Back to set-up/ }).click();
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Set up with me" }).click();
    await expect(page.getByRole("heading", { name: "What would you like to keep safe?" })).toBeVisible();
    await page.getByRole("button", { name: /Bank and savings accounts/ }).click();
    await page.getByRole("button", { name: /Your home/ }).click();
    await shoot(page, `setup-${kind}-4-keep-safe`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Let’s add your first thing" })).toBeVisible();
    await expect(page.getByRole("button", { name: /A bank or savings account/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Your Will/ })).toHaveCount(0);
    await shoot(page, `setup-${kind}-5-first-thing`);
    await page.getByRole("button", { name: "Skip this step" }).click();
    await expect(page.getByRole("heading", { name: "Who should know about your Vault?" })).toBeVisible();
    // Every screen offers the same two ways out.
    await expect(page.getByRole("button", { name: "Skip set-up" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip this step" })).toBeVisible();
    await shoot(page, `setup-${kind}-6-person`);
    await context.close();
  });
}

test("desktop screens", async ({ browser }) => { test.setTimeout(600_000); await capture(browser, "desk"); });
test("phone screens", async ({ browser }) => { test.setTimeout(600_000); await capture(browser, "phone"); });

// Owner report 12 Nov 2026: a £1m life policy added with a photo on a phone didn't show in Insurance, and the
// Premium sheet appeared (document limit). Repeat those steps on the synthetic account, record what happens at each
// step, then remove the test policy. Nothing is paid for; the sheet is only looked at.
test("insurance: a new policy with a photo shows in the Insurance list (phone)", async ({ browser }) => {
  test.setTimeout(240_000);
  const marker = `Diag Insurer ${Date.now()}`;
  const startedAt = new Date().toISOString();
  const docs = await admin.from("documents").select("id", { count: "exact", head: true }).eq("owner_user_id", userId).is("deleted_at", null);
  const atts = await admin.from("attachments").select("id", { count: "exact", head: true }).eq("owner_user_id", userId);
  const plan = await admin.from("billing_profiles").select("account_plan").eq("user_id", userId).maybeSingle();
  console.log(`Insurance diag: plan=${plan.data?.account_plan ?? "none"} documents=${docs.count ?? "?"} attachments=${atts.count ?? "?"}`);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") console.log(`Insurance diag console: ${message.text().slice(0, 300)}`); });
  page.on("response", (response) => { if (response.status() >= 400) console.log(`Insurance diag http ${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`); });
  await signIn(page);
  await page.goto(`${BASE_URL}/finances/insurance?add=1`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const labels = (await page.locator("main label, [role='dialog'] label").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
  console.log(`Insurance diag labels: ${labels.join(" | ").slice(0, 900)}`);
  const fill = async (label: RegExp, value: string) => {
    const field = page.getByLabel(label).first();
    if (!(await field.count())) { console.log(`Insurance diag: no field ${label}`); return; }
    const tag = await field.evaluate((el) => el.tagName.toLowerCase());
    if (tag === "select") await field.selectOption({ label: value }).catch(async () => { await field.selectOption({ index: 1 }); });
    else await field.fill(value);
  };
  await fill(/Insurer name|Provider/i, marker);
  await fill(/Policy type|Insurance type/i, "Life insurance");
  await fill(/Policy number/i, `DIAG-${Date.now()}`);
  await fill(/Insured person|Insured/i, "Bill Smith");
  await fill(/Cover amount/i, "1000000");
  const photo = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count()) await fileInput.setInputFiles({ name: "image.jpg", mimeType: "image/jpeg", buffer: photo });
  else console.log("Insurance diag: no file input");
  await shoot(page, "insurance-diag-1-filled");
  const save = page.getByRole("button", { name: /^Save/ }).last();
  console.log(`Insurance diag save button: ${await save.count() ? await save.innerText() : "none"}`);
  await save.click();
  const sheet = page.locator(".lf-premium-sheet");
  await Promise.race([sheet.waitFor({ timeout: 30_000 }).catch(() => undefined), page.waitForURL(/\/finances\/insurance(?!\?add)/, { timeout: 30_000 }).catch(() => undefined)]);
  await page.waitForTimeout(4000);
  const sheetShown = await sheet.isVisible().catch(() => false);
  const buttons = (await page.getByRole("button").allInnerTexts()).map((text) => text.trim()).filter((text) => /Sav/i.test(text));
  const statusText = (await page.locator("[role='alert'], [role='status']").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
  console.log(`Insurance diag after save: url=${new URL(page.url()).pathname}${new URL(page.url()).search} sheet=${sheetShown} saveButtons=${JSON.stringify(buttons)} status=${JSON.stringify(statusText).slice(0, 600)}`);
  await shoot(page, "insurance-diag-2-after-save");
  if (sheetShown) { await page.getByRole("button", { name: "Not now" }).click().catch(() => undefined); await page.waitForTimeout(3000); }
  const buttonsLater = (await page.getByRole("button").allInnerTexts()).map((text) => text.trim()).filter((text) => /Sav/i.test(text));
  console.log(`Insurance diag after Not now: url=${new URL(page.url()).pathname}${new URL(page.url()).search} saveButtons=${JSON.stringify(buttonsLater)}`);
  await shoot(page, "insurance-diag-3-after-not-now");
  const saved = await admin.from("assets").select("id,section_key,category_key,status,deleted_at,archived_at,title,value_minor").eq("owner_user_id", userId).ilike("title", `%${marker}%`);
  const savedByProvider = saved.data?.length ? saved : await admin.from("assets").select("id,section_key,category_key,status,deleted_at,archived_at,title,value_minor,provider_name").eq("owner_user_id", userId).ilike("provider_name", `%${marker}%`);
  console.log(`Insurance diag saved rows: ${JSON.stringify(savedByProvider.data ?? savedByProvider.error)}`);
  const recent = await admin.from("assets").select("id,section_key,category_key,status,deleted_at,title,created_at").eq("owner_user_id", userId).gte("created_at", startedAt);
  console.log(`Insurance diag rows created by this test: ${JSON.stringify(recent.data ?? recent.error)}`);
  await page.goto(`${BASE_URL}/finances/insurance`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  const listText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  console.log(`Insurance diag list: ${listText.slice(0, 900)}`);
  await shoot(page, "insurance-diag-4-list");
  const inList = listText.includes(marker);
  // Tidy up: remove only the policies this test created (soft delete, synthetic account).
  const ids = [...(savedByProvider.data ?? []), ...(recent.data ?? [])].map((row) => (row as { id: string }).id);
  if (ids.length) await admin.from("assets").update({ deleted_at: new Date().toISOString() }).eq("owner_user_id", userId).in("id", ids).is("deleted_at", null);
  await context.close();
  expect(inList, "the new policy should be in the Insurance list").toBe(true);
});
