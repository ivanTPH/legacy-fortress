#!/usr/bin/env node
// Opt-in local-only, disposable synthetic People & Access journey.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { webkit } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbUrl = new URL(process.env.SUPABASE_DB_URL ?? "postgresql://invalid");
const appUrl = "http://127.0.0.1:3012";
if (apiUrl !== "http://127.0.0.1:55421" || dbUrl.hostname !== "127.0.0.1"
  || dbUrl.port !== "55422" || dbUrl.pathname !== "/postgres"
  || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Refusing to run without approved local app, API and UAT database.");
}
const ledger = execFileSync("psql", ["-X", "-h", "127.0.0.1", "-p", "55422",
  "-U", decodeURIComponent(dbUrl.username), "-d", "postgres", "-At", "-c",
  "select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"], {
  encoding: "utf8", env: { ...process.env, PGPASSWORD: decodeURIComponent(dbUrl.password) },
}).trim();
assert.equal(ledger, "61|20261015121000", "Local schema must match the reviewed 61-migration baseline.");
assert.equal((await fetch(`${appUrl}/api/version`)).status, 200);

const admin = createClient(apiUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const password = `LocalPeople-${randomBytes(12).toString("hex")}!`;
const ownerEmail = `local-people-owner-${stamp}@local.test`;
const linkedEmail = `local-people-linked-${stamp}@local.test`;
const ids = { owner: "", linked: "", organisation: "", wallet: "", contact: "", grant: "", assets: [] };
let browser;
async function row(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}
async function remove(query) {
  const result = await query;
  if (result.error) throw result.error;
}
try {
  for (const [key, email] of [["owner", ownerEmail], ["linked", linkedEmail]]) {
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw result.error ?? new Error("Synthetic user creation failed");
    ids[key] = result.data.user.id;
  }
  await row(admin.from("user_profiles").insert({ user_id: ids.owner, display_name: "Local People Owner" }));
  await row(admin.from("user_onboarding_state").upsert({ user_id: ids.owner, current_step: "complete",
    completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"],
    is_completed: true, terms_accepted: true, marketing_opt_in: false }, { onConflict: "user_id" }));
  await row(admin.from("terms_acceptances").insert({ user_id: ids.owner, terms_version: "legacy-fortress-2026-03",
    accepted: true, accepted_at: new Date().toISOString(), source: "local-people-sharing-proof" }));
  const organisation = await row(admin.from("organisations").insert({ owner_user_id: ids.owner, name: `Local People ${stamp}` }).select("id").single());
  ids.organisation = organisation.id;
  const wallet = await row(admin.from("wallets").insert({ organisation_id: ids.organisation, owner_user_id: ids.owner,
    label: "Synthetic owner wallet", status: "active" }).select("id").single());
  ids.wallet = wallet.id;
  async function insertFinanceAsset(index) {
    const title = `Local Finance record ${index} ${stamp}`;
    const asset = await row(admin.from("assets").insert({ organisation_id: ids.organisation, wallet_id: ids.wallet,
      owner_user_id: ids.owner, section_key: "finances", category_key: "bank", title,
      provider_name: "Local test bank", metadata_json: { account_type: "current_account", asset_category_token: "bank-accounts" } }).select("id").single());
    ids.assets.push(asset.id);
    return { id: asset.id, title };
  }
  for (let index = 1; index <= 3; index += 1) await insertFinanceAsset(index);
  const contact = await row(admin.from("contacts").insert({ owner_user_id: ids.owner,
    full_name: "Local Linked Person", email: linkedEmail, email_normalized: linkedEmail,
    contact_role: "friend_or_family", relationship: "Friend", invite_status: "accepted",
    verification_status: "verified", source_type: "invitation", user_id: ids.linked,
    linked_user_id: ids.linked, linked_context: [] }).select("id").single());
  ids.contact = contact.id;
  await row(admin.from("identity_assurance_states").upsert({ user_id: ids.linked, identity_level: 2,
    provider_key: "local_uat_fixture", provider_assurance_class: "level_2_verified" }, { onConflict: "user_id" }));
  const grant = await row(admin.from("account_access_grants").insert({ owner_user_id: ids.owner,
    linked_user_id: ids.linked, contact_id: ids.contact, assigned_role: "friend_or_family",
    activation_status: "active", permissions_override: {
      read_only: true, allowed_sections: [], asset_ids: [], record_ids: [],
      editable_asset_ids: [], editable_record_ids: [], explicit_permissions: [],
    } }).select("id").single());
  ids.grant = grant.id;

  const linked = createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await linked.auth.signInWithPassword({ email: linkedEmail, password });
  if (signIn.error) throw signIn.error;
  async function visibleLinkedAssets() {
    const result = await linked.from("assets").select("id").eq("owner_user_id", ids.owner);
    if (result.error) throw result.error;
    return (result.data ?? []).map((item) => item.id).sort();
  }
  assert.deepEqual(await visibleLinkedAssets(), [], "Empty grant must reveal no Finance records");

  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${appUrl}/sign-in?next=/dashboard`);
  await page.locator('input[type="email"]').waitFor();
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill(ownerEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 20000 });
  const selector = page.locator(".lf-mobile-workspace-trigger .lf-workspace-current");
  await selector.waitFor();
  assert.equal(await selector.isDisabled(), true, "Single customer context must have no redundant menu");
  assert.equal(await page.getByText("1 available").count(), 0);

  await page.locator('.lf-mobile-bottom-nav a[href="/people-access"]').click();
  const card = page.locator(".lf-pa-person-row").filter({ hasText: "Local Linked Person" });
  await card.waitFor({ timeout: 20000 });
  async function checkMobileCard(width, height) {
    await page.setViewportSize({ width, height });
    const layout = await card.evaluate((element) => {
      const actions = [...element.querySelectorAll(".lf-contact-summary-action button")];
      const rects = actions.map((button) => button.getBoundingClientRect());
      return { scrollWidth: document.documentElement.scrollWidth, innerWidth,
        targets: rects.map((rect) => ({ width: rect.width, height: rect.height, left: rect.left, right: rect.right })),
        firstRowBottom: element.querySelector(".lf-pa-person-open")?.getBoundingClientRect().bottom ?? 0,
        firstActionTop: rects[0]?.top ?? 0 };
    });
    assert.ok(layout.scrollWidth <= layout.innerWidth, `People card overflows at ${width}px`);
    assert.ok(layout.targets.length >= 1 && layout.targets.every((target) => target.width >= 44 && target.height >= 44
      && target.left >= 0 && target.right <= width), `People actions are clipped or too small at ${width}px`);
    assert.ok(layout.firstActionTop >= layout.firstRowBottom, `People actions overlap card text at ${width}px`);
  }
  await checkMobileCard(390, 844);
  await checkMobileCard(320, 568);
  await page.setViewportSize({ width: 390, height: 844 });

  await card.getByRole("button", { name: "Manage record access" }).click();
  await page.getByRole("heading", { name: "Choose individual records" }).waitFor({ timeout: 20000 });
  await page.locator(".lf-person-access-record").first().waitFor();
  assert.equal(await page.locator(".lf-person-access-record").count(), 3);
  const fourth = await insertFinanceAsset(4);
  assert.deepEqual(await visibleLinkedAssets(), [], "A newly created Finance record must not be shared automatically");
  await page.reload();
  const choice = page.locator(".lf-person-access-record").filter({ hasText: fourth.title });
  await choice.waitFor({ timeout: 20000 });
  assert.equal(await page.locator(".lf-person-access-record").count(), 4, "Fourth Finance record must be listed");
  assert.equal(await choice.locator('input[type="checkbox"]').isChecked(), false, "Fourth record must start unselected");
  await choice.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Save access", exact: true }).click();
  await page.getByText("Access updated.", { exact: true }).waitFor({ timeout: 15000 });
  let saved = await row(admin.from("account_access_grants").select("permissions_override").eq("id", ids.grant).single());
  assert.deepEqual(saved.permissions_override.asset_ids, [fourth.id], "Only explicit selection may persist");
  assert.deepEqual(await visibleLinkedAssets(), [fourth.id], "Linked user may see only the explicitly granted record");

  await choice.locator('input[type="checkbox"]').uncheck();
  await page.getByRole("button", { name: "Save access", exact: true }).click();
  await page.getByText("Access removed. The person remains in People I Trust.", { exact: true }).waitFor({ timeout: 15000 });
  saved = await row(admin.from("account_access_grants").select("permissions_override").eq("id", ids.grant).single());
  assert.deepEqual(saved.permissions_override.asset_ids, [], "Revocation must persist");
  assert.deepEqual(await visibleLinkedAssets(), [], "Revoked linked user must lose record visibility");
  console.log("PASS 390/320 People actions; single customer selector; fourth Finance record initially unselected; explicit grant and revocation persist under RLS");
} finally {
  await browser?.close();
  if (ids.grant) await remove(admin.from("account_access_grants").delete().eq("id", ids.grant));
  if (ids.contact) await remove(admin.from("contacts").delete().eq("id", ids.contact));
  if (ids.linked) await remove(admin.from("identity_assurance_states").delete().eq("user_id", ids.linked));
  for (const id of ids.assets) await remove(admin.from("assets").delete().eq("id", id));
  if (ids.wallet) await remove(admin.from("wallets").delete().eq("id", ids.wallet));
  if (ids.organisation) await remove(admin.from("organisations").delete().eq("id", ids.organisation));
  for (const id of [ids.linked, ids.owner]) if (id) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw result.error;
  }
}
