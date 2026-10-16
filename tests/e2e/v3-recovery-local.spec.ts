import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const localOnly = url === "http://127.0.0.1:55421" && baseUrl === "http://127.0.0.1:3012"
  && (() => { try { const db = new URL(databaseUrl); return db.hostname === "127.0.0.1" && db.port === "55422"; } catch { return false; } })();
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const password = "V3RecoveryLocal123!";
const ownerEmail = `v3-recovery-owner-${runId}@legacyfortress.test`;
const linkedEmail = `v3-recovery-linked-${runId}@legacyfortress.test`;
const wrongEmail = `v3-recovery-wrong-${runId}@legacyfortress.test`;
const admin = createClient(url || "http://127.0.0.1:55421", serviceKey || anonKey || "placeholder", { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url || "http://127.0.0.1:55421", anonKey || "placeholder", { auth: { autoRefreshToken: false, persistSession: false } });
const ids: { owner?: string; linked?: string; wrong?: string; org?: string; wallet?: string; contact?: string; grant?: string; invitation?: string; assignment?: string; request?: string; assets: string[] } = { assets: [] };
const firstTitle = `Recovery Property ${runId}`;
const secondTitle = `Recovery Other Property ${runId}`;

test.describe("V3 recovery local owner journey", () => {
  test.beforeAll(async () => {
    test.skip(!localOnly || !anonKey || !serviceKey, "Synthetic fixtures require the approved local Supabase and app only.");
    ids.owner = await createUser(ownerEmail);
    ids.linked = await createUser(linkedEmail);
    ids.wrong = await createUser(wrongEmail);
    const onboardingClient = admin as unknown as Parameters<typeof saveOnboardingState>[0];
    const terms = await saveTermsAcceptance(onboardingClient, ids.owner, { accepted: true, source: "local_synthetic_test" });
    const onboarding = await saveOnboardingState(onboardingClient, ids.owner, {
      current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"],
      is_completed: true, terms_accepted: true,
    });
    if (!terms.accepted || !onboarding.is_completed) throw new Error("Synthetic owner onboarding fixture did not persist");

    const org = await admin.from("organisations").insert({ owner_user_id: ids.owner, name: `Recovery Org ${runId}` }).select("id").single();
    if (org.error || !org.data) throw org.error ?? new Error("Could not create synthetic organisation");
    ids.org = org.data.id;
    const wallet = await admin.from("wallets").insert({ organisation_id: ids.org, owner_user_id: ids.owner, label: "Recovery wallet", status: "active" }).select("id").single();
    if (wallet.error || !wallet.data) throw wallet.error ?? new Error("Could not create synthetic wallet");
    ids.wallet = wallet.data.id;
    const assets = await admin.from("assets").insert([firstTitle, secondTitle].map((title) => ({
      organisation_id: ids.org, wallet_id: ids.wallet, owner_user_id: ids.owner,
      section_key: "property", category_key: "property", title, provider_name: "Local test", status: "active", visibility: "private",
    }))).select("id,title");
    if (assets.error || !assets.data || assets.data.length !== 2) throw assets.error ?? new Error("Could not create synthetic assets");
    ids.assets = [firstTitle, secondTitle].map((title) => assets.data.find((asset) => asset.title === title)!.id);
    const contact = await admin.from("contacts").insert({
      owner_user_id: ids.owner, full_name: "Recovery Linked Person", email: linkedEmail, email_normalized: linkedEmail,
      contact_role: "friend_or_family", relationship: "Friend", invite_status: "accepted", verification_status: "verified",
      source_type: "invitation", user_id: ids.linked, linked_user_id: ids.linked, linked_context: [],
    }).select("id").single();
    if (contact.error || !contact.data) throw contact.error ?? new Error("Could not create synthetic contact");
    ids.contact = contact.data.id;
    const grant = await admin.from("account_access_grants").insert({
      owner_user_id: ids.owner, linked_user_id: ids.linked, contact_id: ids.contact, assigned_role: "friend_or_family",
      activation_status: "verified", permissions_override: {
        read_only: true, allowed_sections: ["property"], asset_ids: [ids.assets[0]], record_ids: [],
        editable_asset_ids: [], editable_record_ids: [], explicit_permissions: ["view", "view_summary", "view_detail", "download"],
      },
    }).select("id").single();
    if (grant.error || !grant.data) throw grant.error ?? new Error("Could not create synthetic grant");
    ids.grant = grant.data.id;
    const invitation = await admin.from("contact_invitations").insert({
      owner_user_id: ids.owner, contact_id: ids.contact, contact_name: "Recovery Linked Person", contact_email: linkedEmail,
      assigned_role: "friend_or_family", invitation_status: "accepted", accepted_user_id: ids.linked,
      activation_status: "verified", sent_at: new Date().toISOString(), accepted_at: new Date().toISOString(),
    }).select("id").single();
    if (invitation.error || !invitation.data) throw invitation.error ?? new Error("Could not create synthetic invitation");
    ids.invitation = invitation.data.id;
    const assignment = await admin.from("role_assignments").insert({ owner_user_id: ids.owner, invitation_id: ids.invitation, assigned_role: "friend_or_family", activation_status: "verified" }).select("id").single();
    if (assignment.error || !assignment.data) throw assignment.error ?? new Error("Could not create synthetic assignment");
    ids.assignment = assignment.data.id;
    const request = await admin.from("verification_requests").insert({ owner_user_id: ids.owner, role_assignment_id: ids.assignment, request_type: "record_access", request_status: "submitted" }).select("id").single();
    if (request.error || !request.data) throw request.error ?? new Error("Could not create synthetic access request");
    ids.request = request.data.id;
  });

  test.afterAll(async () => {
    if (!localOnly) return;
    if (ids.request) await admin.from("verification_requests").delete().eq("id", ids.request);
    if (ids.assignment) await admin.from("role_assignments").delete().eq("id", ids.assignment);
    if (ids.invitation) await admin.from("contact_invitations").delete().eq("id", ids.invitation);
    if (ids.grant) await admin.from("account_access_grants").delete().eq("id", ids.grant);
    if (ids.contact) await admin.from("contacts").delete().eq("id", ids.contact);
    if (ids.assets.length) await admin.from("assets").delete().in("id", ids.assets);
    if (ids.wallet) await admin.from("wallets").delete().eq("id", ids.wallet);
    if (ids.org) await admin.from("organisations").delete().eq("id", ids.org);
    if (ids.owner) {
      await admin.from("terms_acceptances").delete().eq("user_id", ids.owner);
      await admin.from("user_onboarding_state").delete().eq("user_id", ids.owner);
    }
    for (const id of [ids.owner, ids.linked, ids.wrong]) if (id) await admin.auth.admin.deleteUser(id);
  });

  test("workspace menu dismisses and contact edits, sharing, and revocation persist", async ({ page, isMobile }) => {
    test.setTimeout(180_000);
    await signIn(page, ownerEmail);
    await page.waitForURL((next) => next.pathname === "/dashboard", { timeout: 20_000 });
    await page.goto("/people-access", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "People & Access" })).toBeVisible();
    if (isMobile) await page.getByRole("button", { name: "Toggle navigation menu" }).click();
    const switcher = page.locator(".lf-workspace-switcher:visible").first();
    const trigger = switcher.locator(".lf-workspace-current");
    await expect(trigger).toBeEnabled();
    const navigation = isMobile ? page.locator(".lf-mobile-drawer .lf-mobile-tree") : page.locator(".lf-sidebar .lf-nav");
    const navigationContainer = isMobile ? page.locator(".lf-mobile-drawer") : page.locator(".lf-sidebar");
    const navigationTop = (await navigation.boundingBox())!.y - (await navigationContainer.boundingBox())!.y;
    expect(navigationTop).toBeDefined();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = switcher.getByRole("navigation", { name: "Available workspaces" });
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(bounds).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(bounds!.height).toBeLessThanOrEqual(360);
    expect((await navigation.boundingBox())!.y - (await navigationContainer.boundingBox())!.y).toBe(navigationTop);
    await expect(menu.getByRole("link", { name: /Admin|Enterprise/ })).toHaveCount(0);
    if (!isMobile) {
      const sidebar = await page.locator(".lf-sidebar").boundingBox();
      expect(sidebar).not.toBeNull();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(sidebar!.x + sidebar!.width);
    }
    await page.screenshot({ path: `/private/tmp/lf-v3-recovery-${isMobile ? "mobile" : "desktop"}-workspace.png` });
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator(".lf-workspace-switcher:visible").first().getByRole("link", { name: /Personal Vault/ }).click();
    await page.waitForURL((next) => next.pathname === "/dashboard", { timeout: 20_000 });
    await expect(page.locator(".lf-workspace-links:visible")).toHaveCount(0);
    if (isMobile) {
      const mobileToggle = page.getByRole("button", { name: "Toggle navigation menu" });
      await expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
      await mobileToggle.click();
      await expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
    }
    await trigger.click();
    await page.locator(".lf-workspace-switcher:visible").first().getByRole("navigation", { name: "Available workspaces" }).waitFor();
    await page.mouse.click(360, 170);
    await expect(page.locator(".lf-workspace-links:visible")).toHaveCount(0);
    await page.waitForLoadState("networkidle");

    await page.goto(`/contacts?contact=${ids.contact}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Contact details" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Invitation and identity" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Records shared" })).toBeVisible();
    await expect(drawer.getByText(firstTitle)).toBeVisible();
    expect((await grantPermissions()).asset_ids).toEqual([ids.assets[0]]);
    await page.screenshot({ path: `/private/tmp/lf-v3-recovery-${isMobile ? "mobile" : "desktop"}-person.png` });
    await drawer.getByRole("button", { name: "Edit details" }).click();
    await drawer.getByLabel("Name").fill("Recovery Edited Person");
    await drawer.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(async () => (await admin.from("contacts").select("full_name").eq("id", ids.contact!).single()).data?.full_name).toBe("Recovery Edited Person");
    await drawer.getByRole("button", { name: /Back to/ }).click();
    await drawer.getByRole("button", { name: "Change or revoke record access" }).click();
    await expect(drawer.getByRole("heading", { name: "Record permissions" })).toBeVisible();
    await expect(drawer.locator(".lf-person-access-summary-list")).toHaveCount(0);
    await expect(drawer.getByText("Checking current access...")).toHaveCount(0);
    await expect(drawer.getByLabel(secondTitle)).toBeVisible();
    await page.screenshot({ path: `/private/tmp/lf-v4-permissions-${isMobile ? "mobile" : "desktop"}.png` });
    await drawer.getByLabel(secondTitle).check();
    await drawer.getByRole("button", { name: "Save record sharing" }).click();
    await expect.poll(async () => (await grantPermissions()).asset_ids).toEqual(expect.arrayContaining(ids.assets));
    await drawer.getByLabel(firstTitle).uncheck();
    await drawer.getByRole("button", { name: "Save record sharing" }).click();
    await expect.poll(async () => (await grantPermissions()).asset_ids).toEqual([ids.assets[1]]);
    page.once("dialog", (dialog) => dialog.accept());
    await drawer.getByRole("button", { name: "Remove all access" }).click();
    await expect.poll(async () => (await grantPermissions()).asset_ids).toEqual([]);
    await drawer.getByRole("button", { name: /Back to/ }).click();
    await expect(drawer.getByText("No records shared")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("an unrelated signed-in user cannot read the owner's grant or assets", async () => {
    const { data, error } = await anon.auth.signInWithPassword({ email: wrongEmail, password });
    if (error || !data.session) throw error ?? new Error("Synthetic wrong-user sign-in failed");
    expect(data.user.id).toBe(ids.wrong);
    for (const table of ["account_access_grants", "assets"]) {
      const response = await fetch(`${url}/rest/v1/${table}?owner_user_id=eq.${ids.owner}&select=id`, {
        headers: { apikey: anonKey, authorization: `Bearer ${data.session.access_token}` },
      });
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual([]);
    }
  });

  test("People & Access reviews a request without silently changing record sharing", async ({ page, isMobile }) => {
    test.setTimeout(120_000);
    await signIn(page, ownerEmail);
    await page.goto("/people-access?view=people", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "People & Access" })).toBeVisible();
    const person = page.getByRole("button", { name: /Open Recovery (Linked|Edited) Person/ });
    await expect(person).toBeVisible();
    await expect(person.getByText("Accepted")).toBeVisible();
    await expect(person.getByText("Verified")).toBeVisible();
    await page.screenshot({ path: `/private/tmp/lf-v4-people-list-${isMobile ? "mobile" : "desktop"}.png` });
    await person.click();
    const personDrawer = page.getByRole("dialog", { name: /Recovery (Linked|Edited) Person/ });
    await expect(personDrawer.getByRole("heading", { name: "Request awaiting decision" })).toBeVisible();
    await personDrawer.getByRole("link", { name: "Review request" }).click();
    await expect(page).toHaveURL(/view=requests.*request=/);
    const review = page.getByRole("dialog", { name: "Review request" });
    await expect(review.getByText(/does not change record access/)).toBeVisible();
    await page.screenshot({ path: `/private/tmp/lf-v4-request-review-${isMobile ? "mobile" : "desktop"}.png` });
    const before = await grantPermissions();
    await review.getByRole("button", { name: "Approve request" }).click();
    const confirmation = page.getByRole("dialog", { name: "Approve this request?" });
    await expect(confirmation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Approve request" }).click();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Confirm approval" }).click();
    await expect(review.getByText("Request approved; record sharing is unchanged.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Requests", exact: true })).toBeVisible();
    await expect.poll(async () => (await admin.from("verification_requests").select("request_status").eq("id", ids.request!).single()).data?.request_status).toBe("approved");
    expect((await grantPermissions()).asset_ids).toEqual(before.asset_ids);
    await review.getByRole("button", { name: "Review shared records" }).click();
    await expect(page).toHaveURL(/view=people.*contact=/);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Records shared" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Checking current access...")).toHaveCount(0);
    await page.screenshot({ path: `/private/tmp/lf-v4-people-${isMobile ? "mobile" : "desktop"}.png` });
  });
});

async function createUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Could not create synthetic user");
  return data.user.id;
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const button = page.getByRole("button", { name: /^sign in$/i });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.click();
  await page.waitForURL((next) => !next.pathname.includes("sign-in"), { timeout: 20_000 });
  if (await page.getByRole("heading", { name: "Welcome to Legacy Fortress" }).isVisible()) {
    await page.getByRole("checkbox", { name: "I accept the Terms and Conditions" }).check();
    await page.getByRole("button", { name: "Continue into your secure record" }).click();
    await page.waitForURL((next) => !next.pathname.includes("onboarding"), { timeout: 20_000 });
  }
}

async function grantPermissions() {
  const result = await admin.from("account_access_grants").select("permissions_override").eq("id", ids.grant!).single();
  if (result.error) throw result.error;
  return result.data.permissions_override as { asset_ids: string[] };
}
