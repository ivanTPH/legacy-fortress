#!/usr/bin/env node
// Opt-in authenticated local UAT proof. Temporary synthetic accounts and rows
// are removed in finally; the original eight UAT users are never edited.
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium, webkit } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.PLAYWRIGHT_BASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbUrl = new URL(process.env.SUPABASE_DB_URL ?? "postgresql://invalid");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (appUrl !== "http://127.0.0.1:3012" || supabaseUrl !== "http://127.0.0.1:55421"
  || dbUrl.hostname !== "127.0.0.1" || dbUrl.port !== "55422" || dbUrl.pathname !== "/postgres"
  || !anonKey || !serviceKey) {
  throw new Error("Refusing browser proof without the approved loopback app, API and UAT database.");
}
const ledger = execFileSync("psql", ["-X", "-h", "127.0.0.1", "-p", "55422", "-U", decodeURIComponent(dbUrl.username),
  "-d", "postgres", "-At", "-c", "select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"],
{ encoding: "utf8", env: { ...process.env, PGPASSWORD: decodeURIComponent(dbUrl.password) } }).trim();
assert.equal(ledger, "61|20261015121000", "Refusing browser proof before the reviewed migration sequence is complete");
assert.equal((await fetch(`${appUrl}/api/health/schema`)).status, 200);

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const password = `LocalUat-${randomBytes(16).toString("hex")}!`;
const people = Object.fromEntries(["owner", "chrome_linked", "webkit_linked", "wrong", "admin"]
  .map((role) => [role, { email: `phase4-migration-${role}-${stamp}@local.test`, id: "" }]));
const createdUsers = [];
const fixture = { ownerOrg: "", ownerWallet: "", asset: "", invitations: [], grants: [], assurance: [] };
const screenshotDir = process.env.LF_SCREENSHOT_DIR ?? "/private/tmp/lf-phase4-uat-migration-20261015/screenshots";
const checks = [];
const limitations = [];
await mkdir(screenshotDir, { recursive: true, mode: 0o700 });

try {
  for (const [role, person] of Object.entries(people)) {
    const res = await admin.auth.admin.createUser({ email: person.email, password, email_confirm: true,
      user_metadata: { phase4_local_migration_proof: true } });
    if (res.error || !res.data.user) throw res.error ?? new Error(`Could not create ${role}`);
    person.id = res.data.user.id;
    createdUsers.push(person.id);
    await prepareAccount(person.id, role);
  }
  const org = await row(admin.from("organisations").insert({ owner_user_id: people.owner.id,
    name: `Phase 4 migration proof ${stamp}` }).select("id").single());
  fixture.ownerOrg = org.id;
  const wallet = await row(admin.from("wallets").insert({ organisation_id: org.id, owner_user_id: people.owner.id,
    label: "Synthetic proof wallet", status: "active" }).select("id").single());
  fixture.ownerWallet = wallet.id;
  const title = `Phase 4 assigned property ${stamp}`;
  const asset = await row(admin.from("assets").insert({ organisation_id: org.id, wallet_id: wallet.id,
    owner_user_id: people.owner.id, section_key: "property", category_key: "property", title })
    .select("id").single());
  fixture.asset = asset.id;

  await row(admin.from("admin_users").insert({ email_normalized: people.admin.email, user_id: people.admin.id,
    display_name: "Phase 4 Synthetic Support", status: "active", is_master: false, role: "support_agent" }));
  console.log("SETUP temporary synthetic users and owner wallet ready");
  await apiDisclosureChecks();

  const browserEngines = process.env.LF_PHASE4_ENGINE === "webkit" || process.env.LF_PHASE4_ENGINE === "chrome"
    ? [process.env.LF_PHASE4_ENGINE] : ["chrome", "webkit"];
  for (const engine of process.env.LF_PHASE4_API_ONLY === "1" ? [] : browserEngines) {
    const linked = people[`${engine}_linked`];
    const token = randomBytes(24).toString("hex");
    const invite = await row(admin.from("contact_invitations").insert({ owner_user_id: people.owner.id,
      contact_name: "Synthetic linked user", contact_email: linked.email, assigned_role: "executor",
      invitation_status: "pending", invite_token_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: new Date(Date.now() + 86_400_000).toISOString() }).select("id").single());
    fixture.invitations.push(invite.id);
    const url = `/invite/accept?invitation=${invite.id}&token=${token}`;
    await browserJourney(engine, linked, invite.id, url, title);
  }
  console.log(`PASS local UAT checks: ${checks.join(", ")}`);
  if (limitations.length) console.log(`LIMITATION ${limitations.join("; ")}`);
} catch (error) {
  const message = String(error instanceof Error ? error.message : error)
    .replace(/([?&]token=)[^&\s"']+/gi, "$1[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  console.error(`FAIL local UAT check: ${message}`);
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  async function remove(query, label) { const res = await query; if (res.error) cleanupErrors.push(`${label}: ${res.error.code ?? "error"}`); }
  for (const id of fixture.grants) await remove(admin.from("account_access_grants").delete().eq("id", id), "grant");
  for (const id of fixture.invitations) await remove(admin.from("contact_invitations").delete().eq("id", id), "invitation");
  for (const id of fixture.assurance) await remove(admin.from("identity_assurance_states").delete().eq("user_id", id), "assurance");
  if (fixture.asset) await remove(admin.from("assets").delete().eq("id", fixture.asset), "asset");
  if (fixture.ownerWallet) await remove(admin.from("wallets").delete().eq("id", fixture.ownerWallet), "wallet");
  if (fixture.ownerOrg) await remove(admin.from("organisations").delete().eq("id", fixture.ownerOrg), "organisation");
  for (const id of createdUsers) {
    await remove(admin.from("admin_users").delete().eq("user_id", id), "admin");
    await remove(admin.from("terms_acceptances").delete().eq("user_id", id), "terms");
    await remove(admin.from("user_onboarding_state").delete().eq("user_id", id), "onboarding");
    await remove(admin.from("user_profiles").delete().eq("user_id", id), "profile");
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) cleanupErrors.push(`auth user: ${deleted.error.status ?? "error"}`);
  }
  if (cleanupErrors.length) throw new Error(`Synthetic cleanup incomplete: ${cleanupErrors.join(", ")}`);
  console.log(`PASS synthetic fixture cleanup: ${createdUsers.length} temporary users removed`);
}

async function prepareAccount(id, role) {
  const profile = await admin.from("user_profiles").select("id").eq("user_id", id).maybeSingle();
  if (profile.error) throw profile.error;
  const name = `Phase 4 ${role}`;
  if (profile.data?.id) await row(admin.from("user_profiles").update({ display_name: name }).eq("id", profile.data.id));
  else await row(admin.from("user_profiles").insert({ user_id: id, display_name: name }));
  await row(admin.from("user_onboarding_state").upsert({ user_id: id, current_step: "complete",
    completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"],
    is_completed: true, terms_accepted: true, marketing_opt_in: false }, { onConflict: "user_id" }));
  await row(admin.from("terms_acceptances").insert({ user_id: id, terms_version: "legacy-fortress-2026-03",
    accepted: true, accepted_at: new Date().toISOString(), source: "phase4-local-migration-proof" }));
}

async function apiDisclosureChecks() {
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const [name, args] of [
    ["lf_identity_assurance_level", { p_user_id: people.owner.id }],
    ["lf_vault_lifecycle_state", { p_owner_user_id: people.owner.id }],
    ["lf_vault_allows_owner_mutation", { p_owner_user_id: people.owner.id }],
  ]) {
    const result = await anon.rpc(name, args);
    assert.ok(result.error, `Anonymous ${name} unexpectedly executed through PostgREST`);
  }
  const owner = await asUser(people.owner.email);
  const stranger = await asUser(people.wrong.email);
  assert.equal(await row(owner.rpc("lf_identity_assurance_level", { p_user_id: people.owner.id })), 1);
  assert.equal(await row(owner.rpc("lf_vault_lifecycle_state", { p_owner_user_id: people.owner.id })), "OWNER_ACTIVE");
  assert.equal(await row(stranger.rpc("lf_identity_assurance_level", { p_user_id: people.owner.id })), null);
  assert.equal(await row(stranger.rpc("lf_vault_lifecycle_state", { p_owner_user_id: people.owner.id })), null);
  assert.equal(await row(stranger.rpc("lf_vault_allows_owner_mutation", { p_owner_user_id: people.owner.id })), false);
  checks.push("real-JWT-anonymous-and-cross-user-RPC-denial");
  console.log("PASS real JWT anonymous and cross-user RPC denial");
}

async function browserJourney(engine, linked, invitationId, invitePath, title) {
  const journeyViewport = engine === "chrome" ? { width: 1440, height: 900 } : { width: 390, height: 844 };
  const blockedHosts = [];
  async function watch(context) {
    context.on("request", (request) => { const u = new URL(request.url());
      if (["http:", "https:"].includes(u.protocol) && !(u.hostname === "127.0.0.1" && ["3012", "55421"].includes(u.port))) blockedHosts.push(u.hostname);
    });
    await context.route("https://**/*", (route) => route.abort());
  }
  const browser = await (engine === "chrome" ? chromium : webkit).launch(engine === "chrome"
    ? { channel: "chrome", headless: true } : { headless: true });
  try {
    const targetViewports = engine === "chrome"
      ? [["desktop", { width: 1440, height: 900 }]]
      : [["mobile", { width: 390, height: 844 }]];
    for (const [device, viewport] of targetViewports) {
      const context = await browser.newContext({ viewport, baseURL: appUrl });
      await watch(context);
      const page = await context.newPage();
      try {
        await signIn(page, people.owner.email);
        for (const [name, path, heading] of [
          ["dashboard", "/dashboard", "Dashboard"],
          ["actions", "/actions", "Action Centre"],
          ["add", "/add", "Add to my Fortress"],
          ["finances", "/finances", "Finances"],
          ["legal", "/legal", "Legal"],
          ["property", "/property", "Property"],
          ["business", "/business", "Business"],
          ["digital", "/vault/digital", "Digital"],
          ["possessions", "/vault/personal", "Possessions"],
          ["people", "/contacts", "People I Trust"],
        ]) {
          const screenPage = await context.newPage();
          try {
            await screenPage.goto(path, { waitUntil: "domcontentloaded" });
            if (name === "dashboard" && device === "mobile") await screenPage.locator(".lf-shell").waitFor({ timeout: 20_000 });
            else await screenPage.getByRole("heading", { name: heading, exact: true }).first().waitFor({ timeout: 20_000 });
            await screenPage.waitForFunction(() => !/Loading (dashboard summary|finance summary|legal records|records|contacts network|actions)/i.test(document.body.innerText), null, { timeout: 30_000 });
            if (name === "dashboard") await screenPage.waitForFunction(() => {
              const value = document.querySelector(".lf-v3-stats-strip strong")?.textContent?.trim();
              return Boolean(value && value !== "…");
            }, null, { timeout: 30_000 });
            if (name === "property") await screenPage.getByText(title, { exact: false }).first().waitFor({ timeout: 20_000 });
            await screenPage.screenshot({ path: `${screenshotDir}/${engine}-${device}-${name}.png` });
            if (name === "actions" && await screenPage.getByRole("button", { name: "Review", exact: true }).count()) {
              await screenPage.getByRole("button", { name: "Review", exact: true }).first().click();
              await screenPage.locator(".lf-dashboard-review-panel").waitFor({ timeout: 20_000 });
              await screenPage.waitForFunction(() => document.activeElement?.classList.contains("lf-dashboard-review-panel"), null, { timeout: 20_000 });
            }
            if (name === "property") {
              await screenPage.getByRole("link", { name: new RegExp(title) }).click();
              await screenPage.waitForURL((url) => url.pathname === "/vault/property" && url.searchParams.get("asset") === fixture.asset);
              await screenPage.getByText(title, { exact: false }).first().waitFor({ timeout: 20_000 });
            }
          } finally { await screenPage.close(); }
        }
        const ownerApi = await asUser(people.owner.email);
        assert.deepEqual((await row(ownerApi.from("assets").select("id").eq("id", fixture.asset))).map((x) => x.id), [fixture.asset]);
        for (const [path, heading] of [["/admin", /Admin access is restricted|Access not available/i],
          ["/enterprise", /Access denied|Enterprise workspace unavailable/i]]) {
          const domainPage = await context.newPage();
          try {
            await domainPage.goto(path, { waitUntil: "domcontentloaded" });
            await domainPage.getByRole("heading", { name: heading }).waitFor({ timeout: 20_000 });
          } finally { await domainPage.close(); }
        }
        checks.push(`${engine}-${device}-owner-and-domain-isolation`);
      console.log(`PASS ${engine} ${device} owner and domain isolation`);
      } finally { await context.close(); }
    }

    const wrongContext = await browser.newContext({ baseURL: appUrl, viewport: journeyViewport });
    await watch(wrongContext);
    try {
      const wrongAuthPage = await wrongContext.newPage();
      await signIn(wrongAuthPage, people.wrong.email);
      const wrongPage = await wrongContext.newPage();
      await wrongPage.goto(invitePath, { waitUntil: "domcontentloaded" });
      await wrongPage.getByRole("region", { name: "Wrong account" }).waitFor({ timeout: 20_000 });
      assert.equal(await wrongPage.getByRole("button", { name: /Accept .*role and continue/i }).count(), 0);
      await wrongPage.screenshot({ path: `${screenshotDir}/${engine}-wrong-account.png` });
      const wrongApi = await asUser(people.wrong.email);
      assert.deepEqual(await row(wrongApi.from("assets").select("id").eq("id", fixture.asset)), []);
      const wrongVaultPage = await wrongContext.newPage();
      await wrongVaultPage.goto("/vault/property", { waitUntil: "domcontentloaded" });
      await wrongVaultPage.waitForFunction(() => !document.body.innerText.includes("Loading records…"), null, { timeout: 20_000 });
      assert.equal(await wrongVaultPage.getByText(title, { exact: false }).count(), 0,
        "Unassigned account must not see the owner's property");
      checks.push(`${engine}-wrong-account-invitation`);
      console.log(`PASS ${engine} wrong-account invitation`);
    } finally { await wrongContext.close(); }

    const linkedContext = await browser.newContext({ baseURL: appUrl, viewport: journeyViewport });
    await watch(linkedContext);
    try {
      const linkedAuthPage = await linkedContext.newPage();
      await signIn(linkedAuthPage, linked.email);
      const linkedInvitePage = await linkedContext.newPage();
      await linkedInvitePage.goto(invitePath, { waitUntil: "domcontentloaded" });
      await linkedInvitePage.getByRole("button", { name: /Accept .*role and continue/i }).click();
      await linkedInvitePage.waitForURL(/\/identity\/verify/, { timeout: 20_000 });
      const grant = await row(admin.from("account_access_grants").select("id,activation_status")
        .eq("invitation_id", invitationId).single());
      fixture.grants.push(grant.id);
      assert.equal(grant.activation_status, "pending_verification");
      const linkedApi = await asUser(linked.email);
      assert.deepEqual(await row(linkedApi.from("assets").select("id").eq("id", fixture.asset)), []);
      await row(admin.from("identity_assurance_states").upsert({ user_id: linked.id, identity_level: 2,
        provider_key: "local_uat_fixture", provider_assurance_class: "level_2_verified" }, { onConflict: "user_id" }));
      fixture.assurance.push(linked.id);
      await row(admin.from("account_access_grants").update({ activation_status: "active",
        permissions_override: { asset_ids: [fixture.asset] } }).eq("id", grant.id));
      assert.deepEqual((await row(linkedApi.from("assets").select("id,title").eq("owner_user_id", people.owner.id)))
        .map((x) => x.id), [fixture.asset]);
      const linkedDashboardPage = await linkedContext.newPage();
      await linkedDashboardPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await linkedDashboardPage.locator(".lf-v3-vault-tile").first().waitFor({ timeout: 20_000 });
      try {
        await linkedDashboardPage.waitForFunction(() => document.querySelector(".lf-v3-stats-strip strong")?.textContent?.trim() === "1", null, { timeout: 30_000 });
      } catch (error) {
        await linkedDashboardPage.screenshot({ path: `${screenshotDir}/${engine}-linked-dashboard-timeout.png`, fullPage: true });
        const state = await linkedDashboardPage.evaluate(() => ({
          path: location.pathname,
          count: document.querySelector(".lf-v3-stats-strip strong")?.textContent?.trim() ?? "missing",
          status: document.querySelector(".lf-dashboard-shell > [role='status']")?.textContent?.slice(0, 100) ?? "none",
        }));
        console.error(`LINKED_DASHBOARD_DIAGNOSTIC ${JSON.stringify(state)}`);
        throw error;
      }
      assert.equal(await linkedDashboardPage.locator('.lf-v3-dashboard-pageheader a[href="/add"]').count(), 0);
      assert.deepEqual(await linkedDashboardPage.locator(".lf-v3-vault-tile").evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("href"))), ["/property"]);
      assert.equal(await linkedDashboardPage.locator(".lf-dashboard-readiness-summary").count(), 0);
      await linkedDashboardPage.screenshot({ path: `${screenshotDir}/${engine}-linked-dashboard.png` });
      const linkedPage = await linkedContext.newPage();
      await linkedPage.goto("/vault/property", { waitUntil: "domcontentloaded" });
      await linkedPage.locator(".lf-shell").waitFor({ timeout: 20_000 });
      await linkedPage.getByText(title, { exact: false }).first().waitFor({ timeout: 20_000 });
      assert.equal(new URL(linkedPage.url()).pathname, "/vault/property", "Assigned area must remain open");
      await linkedPage.screenshot({ path: `${screenshotDir}/${engine}-linked-assigned.png` });
      assert.equal(await linkedPage.getByRole("button", { name: "Edit record" }).count(), 0);
      assert.equal(await linkedPage.getByRole("button", { name: "Delete record" }).count(), 0);
      await row(admin.from("account_access_grants").update({ activation_status: "revoked" }).eq("id", grant.id));
      assert.deepEqual(await row(linkedApi.from("assets").select("id").eq("id", fixture.asset)), []);
      await linkedPage.reload({ waitUntil: "domcontentloaded" });
      assert.equal(await linkedPage.getByText(title, { exact: false }).count(), 0);
      checks.push(`${engine}-invitation-linked-identity-revocation`);
      console.log(`PASS ${engine} invitation, linked identity and revocation`);
    } finally { await linkedContext.close(); }

    const adminContext = await browser.newContext({ baseURL: appUrl, viewport: journeyViewport });
    await watch(adminContext);
    try {
      const adminAuthPage = await adminContext.newPage();
      await signIn(adminAuthPage, people.admin.email);
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/admin", { waitUntil: "domcontentloaded" });
      await adminPage.getByRole("heading", { name: /Admin overview/i }).waitFor({ timeout: 20_000 });
      await adminPage.screenshot({ path: `${screenshotDir}/${engine}-admin.png` });
      checks.push(`${engine}-authorised-admin`);
      console.log(`PASS ${engine} authorised admin`);
    } finally { await adminContext.close(); }
    assert.deepEqual(blockedHosts, []);
  } finally { await browser.close(); }
}

async function signIn(page, email) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: /^sign in$/i });
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    if (await button.isEnabled()) break;
    await page.waitForTimeout(750);
  }
  assert.equal(await button.isEnabled(), true, "Sign-in form did not hydrate");
  await button.click();
  await page.waitForURL((u) => u.pathname !== "/sign-in", { timeout: 20_000 });
}

async function asUser(email) {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const res = await client.auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  return client;
}

async function row(promise) {
  const res = await promise;
  if (res.error) throw res.error;
  return res.data;
}
