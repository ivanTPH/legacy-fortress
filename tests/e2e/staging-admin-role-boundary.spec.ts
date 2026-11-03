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
const totpFactors = new Map<string, { id: string; secret: string; lastStep?: number }>();

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
  // ADMIN_PARTNER organisation detail: seats, details, actions; a reason is needed to suspend.
  await expect(page.getByRole("heading", { name: "Details", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Members’ Vaults stay private", { exact: false })).toBeVisible();
  const desktopShot = await page.screenshot({ type: "jpeg", quality: 45, scale: "css", fullPage: true }).catch(() => null);
  if (desktopShot) console.log(`Phone-shot: admin-organisation-detail ${desktopShot.toString("base64")}`);
  const suspend = page.getByRole("button", { name: "Suspend", exact: true });
  if (await suspend.isVisible().catch(() => false)) {
    await suspend.click();
    await expect(page.getByRole("button", { name: "Suspend organisation" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel" }).click();
  }
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
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || style.position === "fixed" && rect.left >= width) continue;
      // Report the outermost offender only: skip elements whose parent already overflows.
      const parent = element.parentElement?.getBoundingClientRect();
      if (parent && parent.right > width + 1) continue;
      const className = typeof element.className === "string" ? element.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push(`${element.tagName.toLowerCase()}${className ? `.${className}` : ""} w=${Math.round(rect.width)} right=${Math.round(rect.right)}`);
      if (offenders.length >= 8) break;
    }
    return { width, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
}

test("phone: platform admin and partner pages fit the screen", async ({ browser }) => {
  test.setTimeout(420_000);
  const review = async (email: string, home: string, paths: string[], label: string) => {
    const page = await iphonePage(browser);
    await signIn(page, email, home);
    for (const path of paths) {
      const started = Date.now();
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" }).catch(() => null);
      await page.waitForTimeout(1500);
      await page.getByText(/^(Checking admin access|Checking organisation access|Loading commercial register|Loading…)$/).first().waitFor({ state: "hidden", timeout: 20_000 }).catch(() => null);
      console.log(`Admin-ready: ${label} ${path} ${Date.now() - started}ms`);
      const onSignIn = await page.getByText(/Sign in to (Platform Admin|the partner portal)/).first().isVisible().catch(() => false);
      expect(onSignIn, `${label} ${path} stuck on staff sign-in`).toBe(false);
      const result = await widestOverflow(page);
      console.log(`Admin-fit: ${label} ${path} ${result.scrollWidth > result.width + 1 ? `TOO WIDE ${result.scrollWidth}px: ${result.offenders.slice(0, 4).join("; ")}` : "fits"}`);
      const shot = await page.screenshot({ type: "jpeg", quality: 40, scale: "css", fullPage: true }).catch(() => null);
      if (shot) console.log(`Phone-shot: ${label}${path.replace(/[^a-z0-9]+/gi, "-")} ${shot.toString("base64")}`);
    }
    await page.context().close();
  };
  await review(users[0].email, "/admin", [
    "/admin", "/admin/users", "/admin/invitations", "/admin/access", "/admin/support", "/admin/probate", "/admin/verification", "/admin/authorities",
    "/admin/organisations", `/admin/organisations/${organisationId}`, "/admin/licences", "/admin/audit", "/admin/system-health", "/admin/admin-users", "/admin/settings",
  ], "admin");
  await review(users[1].email, "/enterprise", [
    "/enterprise", "/enterprise?tab=users", "/enterprise?tab=invitations", "/enterprise?tab=registration-links", "/enterprise?tab=reports", `/enterprise/organisations/${organisationId}`,
  ], "partner");
});
// iPhone-like page (mobile layout viewport + touch) so pages widen the way Safari does.
async function iphonePage(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  return context.newPage();
}

test("phone: owner pages fit the screen", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await iphonePage(browser);
  await signIn(page, users[2].email, "/dashboard");
  for (const path of ["/dashboard", "/finances", "/legal", "/legal/power-of-attorney", "/legal/power-of-attorney?add=1", "/people-access", "/people-access?view=people&group=trusted_contacts&add=1", "/profile", "/settings", "/account/security", "/identity/verify"]) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const result = await widestOverflow(page);
    // Content can be clipped (overflow hidden) without the page scrolling, so list anything past the edge.
    console.log(`Phone-fit: ${path} ${result.offenders.length ? `CUT OFF (page ${result.scrollWidth}px/${result.width}px): ${result.offenders.join("; ")}` : "fits"}`);
    console.log(`Phone-shift: ${path} ${await layoutShifts(page)}`);
    // A small screenshot in the log for visual review against the design (synthetic account only).
    const shot = await page.screenshot({ type: "jpeg", quality: 45, scale: "css" }).catch(() => null);
    if (shot) console.log(`Phone-shot: ${path} ${shot.toString("base64")}`);
  }
  await page.context().close();
});

test("phone: owner records a Power of Attorney by tapping and links a person", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await iphonePage(browser);
  const log = (line: string) => console.log(`PoA-diag: ${line.slice(0, 400)}`);
  page.on("pageerror", (error) => log(`pageerror: ${error.message}`));
  await signIn(page, users[2].email, "/legal/power-of-attorney?add=1");
  await page.waitForTimeout(3000);
  // Tap each field like a person (a covered field would send the tap elsewhere).
  const name = page.getByLabel(/Document name/i).first();
  await name.tap();
  await page.keyboard.type("Synthetic Lasting Power of Attorney");
  const description = page.getByLabel(/Short description/i).first();
  await description.scrollIntoViewIfNeeded();
  await description.tap();
  await page.keyboard.type("Property and financial affairs, synthetic");
  log(`typed: name=${await name.inputValue()} description=${await description.inputValue()}`);
  expect(await name.inputValue()).toBe("Synthetic Lasting Power of Attorney");
  const saveAndAdd = page.getByRole("button", { name: /Save and choose attorney/i }).first();
  await saveAndAdd.scrollIntoViewIfNeeded();
  await saveAndAdd.tap();
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toContainText("Add a person", { timeout: 25_000 });
  log("add-person panel open");
  // Choose an existing person: the role is already "Attorney", then a clear confirmation.
  await dialog.getByRole("button", { name: /Choose from People/i }).first().tap();
  await dialog.locator("button[aria-pressed]").filter({ hasText: /Select person|Selected/ }).first().tap();
  await dialog.getByRole("button", { name: /Add as Attorney/i }).tap();
  await expect(dialog).toContainText(/added as Attorney/i, { timeout: 20_000 });
  await expect(dialog.getByRole("button", { name: /Not now|Done/i }).or(dialog.getByRole("link", { name: /Add their email/i })).first()).toBeVisible();
  log(`confirmation: ${(await dialog.innerText()).replace(/\s+/g, " ").slice(0, 200)}`);
  const shoot = async (label: string) => { const shot = await page.screenshot({ type: "jpeg", quality: 45, scale: "css" }).catch(() => null); if (shot) console.log(`Phone-shot: ${label} ${shot.toString("base64")}`); };
  await shoot("/poa-confirmation");
  await dialog.getByRole("button", { name: /Not now|Done/i }).first().tap().catch(() => null);
  await page.waitForTimeout(1500);
  await page.getByText(/Your attorney/i).first().scrollIntoViewIfNeeded().catch(() => null);
  await shoot("/poa-record-people");
  // Person panel (va-n1), reached from the attorney's name on the record.
  const personHref = await page.locator(".lf-v52-record-person-copy a").first().getAttribute("href").catch(() => null);
  if (personHref) {
    await page.goto(`${BASE_URL}${personHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await shoot("/person-panel");
    await page.locator(".lf-person-drawer-content").evaluate((node) => { node.scrollTop = node.scrollHeight; }).catch(() => null);
    await page.waitForTimeout(500);
    await shoot("/person-panel-lower");
  }
  await page.context().close();
});

test("design review: people screens on a phone and main pages on desktop", async ({ browser }) => {
  test.setTimeout(180_000);
  const shoot = async (target: import("@playwright/test").Page, label: string) => { const shot = await target.screenshot({ type: "jpeg", quality: 45, scale: "css" }).catch(() => null); if (shot) console.log(`Phone-shot: ${label} ${shot.toString("base64")}`); };
  const phone = await iphonePage(browser);
  await signIn(phone, users[2].email, "/people-access?view=people");
  await phone.waitForTimeout(3000);
  await shoot(phone, "/people-list");
  const firstPerson = phone.locator(".lf-contact-summary-row, [data-contact-id], .lf-pa-person-row").first();
  if (await firstPerson.count()) { await firstPerson.tap().catch(() => null); await phone.waitForTimeout(2000); await shoot(phone, "/person-panel"); }
  await phone.goto(`${BASE_URL}/people-access?view=vault-access`, { waitUntil: "domcontentloaded" });
  await phone.waitForTimeout(3000);
  await shoot(phone, "/vault-access");
  await phone.context().close();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((context) => context.newPage());
  await signIn(desktop, users[2].email, "/dashboard");
  for (const path of ["/dashboard", "/finances", "/legal", "/legal/power-of-attorney", "/people-access?view=vault-access"]) {
    await desktop.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await desktop.waitForTimeout(3500);
    await shoot(desktop, `/desk${path}`);
  }
  await desktop.context().close();
});

// Layout shifts while loading ("screens jump on refresh", owner report 2 Nov 2026).
async function layoutShifts(page: Page) {
  return page.evaluate(() => new Promise<string>((resolve) => {
    const found: string[] = [];
    let total = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }> }>) {
        if (entry.hadRecentInput) continue;
        total += entry.value;
        for (const source of entry.sources ?? []) {
          const element = source.node instanceof Element ? source.node : source.node?.parentElement;
          const name = element ? `${element.tagName.toLowerCase()}.${String(element.className || "").split(/\s+/).slice(0, 2).join(".")}` : "?";
          found.push(`${name} ${Math.round(source.previousRect.y)}→${Math.round(source.currentRect.y)}`);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
    setTimeout(() => resolve(`${total.toFixed(3)} ${found.slice(0, 6).join("; ")}`), 300);
  })).catch(() => "unavailable");
}

test("phone: sub-pages load without jumping and fit the screen", async ({ browser }) => {
  test.setTimeout(420_000);
  const page = await iphonePage(browser);
  await signIn(page, users[2].email, "/dashboard");
  const paths = [
    "/finances/bank", "/finances/pensions", "/finances/investments", "/finances/insurance", "/finances/debts",
    "/legal/wills", "/legal/trusts", "/legal/power-of-attorney", "/legal/funeral-wishes", "/legal/marriage-divorce-documents", "/legal/other-legal-documents", "/identity-documents", "/personal/wishes",
    "/property", "/business", "/vault/digital", "/vault/personal",
    "/people-access?view=vault-access", "/people-access?view=requests", "/people-access?view=sharing", "/vault-nominations",
    "/notifications", "/actions", "/add", "/support",
    "/account/my-vault", "/account/appearance", "/account/accessibility", "/account/communications-preferences", "/account/reminder-preferences", "/account/billing", "/account/terms",
  ];
  for (const path of paths) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const fit = await widestOverflow(page);
    console.log(`Sub-shift: ${path} ${await layoutShifts(page)}${fit.offenders.length ? ` | CUT OFF: ${fit.offenders.slice(0, 3).join("; ")}` : ""}`);
  }
  // A record page (the Power of Attorney the earlier test saved).
  await page.goto(`${BASE_URL}/legal/power-of-attorney`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // Record rows are buttons that open "?asset=<id>"; read the id rather than clicking so the measurement starts from a fresh load.
  const recordId = await page.locator("article[data-record-id]").first().getAttribute("data-record-id", { timeout: 8000 }).catch(() => null);
  if (recordId) {
    await page.goto(`${BASE_URL}/legal/power-of-attorney?asset=${encodeURIComponent(recordId)}`, { waitUntil: "domcontentloaded" }).catch(() => null);
    await page.waitForTimeout(3000);
    const fit = await widestOverflow(page);
    console.log(`Sub-shift: record page ${await Promise.race([layoutShifts(page), new Promise<string>((resolve) => setTimeout(() => resolve("not measured"), 5000))])}${fit.offenders.length ? ` | CUT OFF: ${fit.offenders.slice(0, 3).join("; ")}` : ""}`);
  } else console.log("Sub-shift: record page not found");
  await page.context().close();
});

test("suggested documents: a connected person suggests, the owner reviews, rejects one and approves one", async ({ browser }) => {
  test.setTimeout(240_000);
  const owner = users[2];
  const adviser = await createUser("adviser");
  // Synthetic connection: the owner's contact, an active verified connection with no view scope, and permission to suggest for one record.
  const asset = await adminClient.from("assets").select("id,title").eq("owner_user_id", owner.id).is("deleted_at", null).limit(1).maybeSingle();
  if (asset.error || !asset.data) throw asset.error ?? new Error("suggestion_test_needs_a_record");
  const contact = await adminClient.from("contacts").insert({ owner_user_id: owner.id, full_name: "Staging Adviser", linked_user_id: adviser.id }).select("id").single();
  if (contact.error) throw contact.error;
  const assurance = await adminClient.from("identity_assurance_states").insert({ user_id: adviser.id, identity_level: 2, provider_key: "staging_synthetic", provider_assurance_class: "level_2_synthetic", verified_at: new Date().toISOString() });
  if (assurance.error) throw assurance.error;
  const grant = await adminClient.from("account_access_grants").insert({ owner_user_id: owner.id, linked_user_id: adviser.id, contact_id: contact.data.id, assigned_role: "professional_advisor", activation_status: "active", required_identity_level: 2, permissions_override: {} }).select("id").single();
  if (grant.error) throw grant.error;
  const permission = await adminClient.from("record_suggestion_permissions").insert({ owner_user_id: owner.id, grant_id: grant.data.id, asset_id: asset.data.id });
  if (permission.error) throw permission.error;

  const sessionFor = async (email: string) => {
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (auth.error || !auth.data.session) throw auth.error ?? new Error("suggestion_sign_in_failed");
    return auth.data.session.access_token;
  };
  const adviserToken = await sessionFor(adviser.email);
  const ownerToken = await sessionFor(owner.email);
  const pdf = new Blob(["%PDF-1.4\n% synthetic staging suggestion\n%%EOF\n"], { type: "application/pdf" });
  const suggest = async (name: string) => {
    const form = new FormData();
    form.set("assetId", asset.data!.id); form.set("note", "Synthetic staging suggestion"); form.set("file", new File([pdf], name, { type: "application/pdf" }));
    const response = await fetch(`${BASE_URL}/api/suggestions`, { method: "POST", headers: { Authorization: `Bearer ${adviserToken}` }, body: form });
    const json = await response.json();
    expect(response.status, JSON.stringify(json)).toBe(200);
    return String(json.suggestionId);
  };
  const toReject = await suggest("staging-reject.pdf");
  const toApprove = await suggest("staging-approve.pdf");

  // The adviser still can't open the record, and can't decide their own suggestion.
  const viewing = await fetch(`${SUPABASE_URL}/rest/v1/assets?id=eq.${asset.data.id}&select=id`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${adviserToken}` } }).then((response) => response.json());
  expect(viewing).toEqual([]);
  const selfApprove = await fetch(`${BASE_URL}/api/suggestions/${toApprove}`, { method: "POST", headers: { Authorization: `Bearer ${adviserToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
  expect(selfApprove.status).toBe(403);

  // Owner rejects one with a reason.
  const rejected = await fetch(`${BASE_URL}/api/suggestions/${toReject}`, { method: "POST", headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", reason: "wrong_document", comment: "Synthetic rejection" }) });
  expect(rejected.status).toBe(200);

  // Owner sees the other in To do and approves it in the review dialog.
  const page = await iphonePage(browser);
  await signIn(page, owner.email, "/actions");
  await expect(page.getByText("Review Staging’s document", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await page.goto(`${BASE_URL}/actions?review=${toApprove}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: "Review document" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Nothing else on", { exact: false })).toBeVisible();
  const reviewShot = await page.screenshot({ type: "jpeg", quality: 45, scale: "css" }).catch(() => null);
  if (reviewShot) console.log(`Phone-shot: suggestion-review ${reviewShot.toString("base64")}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Review document" })).toHaveCount(0, { timeout: 30_000 });
  await page.context().close();

  const rows = await adminClient.from("record_suggestions").select("id,status,applied_document_id,file_removed_at").in("id", [toReject, toApprove]);
  const byId = new Map((rows.data ?? []).map((row) => [row.id, row]));
  expect(byId.get(toReject)?.status).toBe("rejected");
  expect(byId.get(toReject)?.file_removed_at).toBeTruthy();
  expect(byId.get(toApprove)?.status).toBe("applied");
  const documentId = byId.get(toApprove)?.applied_document_id as string;
  const doc = await adminClient.from("documents").select("id,storage_path,asset_id").eq("id", documentId).single();
  expect(doc.data?.asset_id).toBe(asset.data.id);
  const history = await adminClient.from("record_history").select("action,actor_kind").eq("record_id", asset.data.id).in("action", ["suggestion_proposed", "suggestion_rejected", "suggestion_approved", "document_added"]);
  const seen = new Set((history.data ?? []).map((row) => `${row.action}:${row.actor_kind}`));
  for (const entry of ["suggestion_proposed:person", "suggestion_rejected:owner", "suggestion_approved:owner", "document_added:system"]) expect(seen.has(entry), entry).toBe(true);
  const audit = await adminClient.from("audit_events").select("action").eq("category", "vault_audit").eq("resource_id", toApprove);
  console.log(`Suggestion-audit: ${(audit.data ?? []).map((row) => row.action).sort().join(",") || "none yet"}`);

  // Clean up the synthetic document and its file; the rest goes with the synthetic users.
  if (doc.data?.storage_path) await adminClient.storage.from("vault-docs").remove([doc.data.storage_path]);
  await adminClient.from("documents").delete().eq("id", documentId);
  await adminClient.from("record_suggestion_permissions").delete().eq("grant_id", grant.data.id);
  await adminClient.from("account_access_grants").delete().eq("id", grant.data.id);
  await adminClient.from("contacts").delete().eq("id", contact.data.id);
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
    // Enrol once per synthetic user, then reuse that authenticator for every later sign-in in this run.
    let factor = totpFactors.get(email);
    if (!factor) {
      const enrol = await authClient.auth.mfa.enroll({ factorType: "totp", friendlyName: `Synthetic browser acceptance ${Date.now()}` });
      if (!enrol.error && enrol.data) { factor = { id: enrol.data.id, secret: enrol.data.totp.secret }; totpFactors.set(email, factor); }
    }
    if (factor) {
      // A code can't be used twice: wait for the next 30-second code if this one was already used.
      if (factor.lastStep === Math.floor(Date.now() / 30_000)) await new Promise((resolve) => setTimeout(resolve, 30_000 - (Date.now() % 30_000) + 500));
      factor.lastStep = Math.floor(Date.now() / 30_000);
      const verified = await authClient.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totpCode(factor.secret) });
      const upgraded = await authClient.auth.getSession();
      if (!verified.error && upgraded.data.session) session = upgraded.data.session;
      else console.log(`MFA-diag: ${email.split("@")[0]} ${verified.error?.message ?? "no session"}`);
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
