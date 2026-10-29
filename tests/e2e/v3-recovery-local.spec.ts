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
    await page.getByRole("link", { name: "Sharing", exact: true }).click();
    const sharedRecord = page.locator(".lf-pa-sharing-record").filter({ hasText: firstTitle });
    await expect(sharedRecord.getByRole("cell", { name: "Recovery Linked Person: Can view" })).toBeVisible();
    await page.screenshot({ path: `/private/tmp/lf-v4-sharing-${isMobile ? "mobile" : "desktop"}.png` });
    await page.getByRole("navigation", { name: "People and access views" }).getByRole("link", { name: "People", exact: true }).click();
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

    try {
      await page.goto(`/contacts?contact=${ids.contact}`, { waitUntil: "networkidle" });
    } catch (error) {
      if (!String(error).includes("interrupted by another navigation")) throw error;
      await page.goto(`/contacts?contact=${ids.contact}`, { waitUntil: "networkidle" });
    }
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Contact details" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Connection and identity" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Access granted" })).toBeVisible();
    await expect(drawer.getByText(firstTitle)).toBeVisible();
    expect((await grantPermissions()).asset_ids).toEqual([ids.assets[0]]);
    await page.screenshot({ path: `/private/tmp/lf-v3-recovery-${isMobile ? "mobile" : "desktop"}-person.png` });
    await drawer.getByRole("button", { name: "Edit details" }).click();
    await drawer.getByLabel("Name").fill("Recovery Edited Person");
    await drawer.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(async () => (await admin.from("contacts").select("full_name").eq("id", ids.contact!).single()).data?.full_name).toBe("Recovery Edited Person");
    await drawer.getByRole("button", { name: /Back to/ }).click();
    await drawer.getByRole("button", { name: "Edit access" }).click();
    await expect(drawer.getByRole("heading", { name: "Record permissions" })).toBeVisible();
    await expect(drawer.locator(".lf-person-access-summary-list")).toHaveCount(0);
    await expect(drawer.getByText("Checking current access...")).toHaveCount(0);
    await expect(drawer.getByLabel(secondTitle)).toBeVisible();
    await page.screenshot({ path: `/private/tmp/lf-v4-permissions-${isMobile ? "mobile" : "desktop"}.png` });
    await drawer.getByLabel(secondTitle).check();
    await drawer.getByRole("button", { name: "Save access" }).click();
    await expect.poll(async () => (await grantPermissions()).asset_ids).toEqual(expect.arrayContaining(ids.assets));
    await expect(drawer.getByText("Access updated.", { exact: true })).toBeVisible();
    await expect(drawer.getByLabel(firstTitle)).toBeEnabled();
    await drawer.getByLabel(firstTitle).uncheck();
    await expect(drawer.getByRole("button", { name: "Save access" })).toBeEnabled();
    await drawer.getByRole("button", { name: "Save access" }).click();
    await expect.poll(async () => (await grantPermissions()).asset_ids).toEqual([ids.assets[1]]);
    await drawer.getByRole("button", { name: "Revoke all" }).click();
    await expect(page.getByRole("alertdialog", { name: "Revoke all record access" })).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm revoke" }).click();
    await expect.poll(async () => (await grantPermissions()).asset_ids).toEqual([]);
    await drawer.getByRole("button", { name: "Cancel" }).click();
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

  test("V5.2 Add person saves a contact without inviting or granting record access", async ({ page, isMobile }) => {
    const addedEmail = `v4-no-access-${runId}@legacyfortress.test`;
    await signIn(page, ownerEmail);
    await page.goto("/people-access?view=people&group=trusted_contacts&add=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Add person" })).toBeVisible();
    await page.getByRole("textbox", { name: /First name/ }).fill("V4");
    await page.getByRole("textbox", { name: /Last name/ }).fill("Unshared");
    await page.getByRole("textbox", { name: /Email/ }).fill(addedEmail);
    await expect(page.getByText(/Save the person first.*separate invitation action/)).toBeVisible();
    await page.screenshot({ path: `/private/tmp/lf-v4-add-person-${isMobile ? "mobile" : "desktop"}.png` });
    try {
      await page.getByRole("button", { name: "Save person", exact: true }).click();
      await expect.poll(async () => (await admin.from("contacts").select("id").eq("owner_user_id", ids.owner!).eq("email_normalized", addedEmail).maybeSingle()).data?.id).toBeTruthy();
      const contact = await admin.from("contacts").select("id,invite_status").eq("owner_user_id", ids.owner!).eq("email_normalized", addedEmail).single();
      expect(contact.data?.invite_status).toBe("not_invited");
      const grants = await admin.from("account_access_grants").select("permissions_override").eq("owner_user_id", ids.owner!).eq("contact_id", contact.data!.id);
      expect(grants.error).toBeNull();
      for (const grant of grants.data ?? []) {
        const permissions = grant.permissions_override as { asset_ids?: string[]; record_ids?: string[] } | null;
        expect(permissions?.asset_ids ?? []).toEqual([]);
        expect(permissions?.record_ids ?? []).toEqual([]);
      }
    } finally {
      const contacts = await admin.from("contacts").select("id").eq("owner_user_id", ids.owner!).eq("email_normalized", addedEmail);
      for (const contact of contacts.data ?? []) {
        const invitations = await admin.from("contact_invitations").select("id").eq("owner_user_id", ids.owner!).eq("contact_id", contact.id);
        for (const invitation of invitations.data ?? []) {
          await admin.from("invitation_events").delete().eq("invitation_id", invitation.id);
          await admin.from("role_assignments").delete().eq("invitation_id", invitation.id);
          await admin.from("contact_invitations").delete().eq("id", invitation.id);
        }
        await admin.from("account_access_grants").delete().eq("contact_id", contact.id);
        await admin.from("contacts").delete().eq("id", contact.id);
      }
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
    await expect(person.getByText(/Identity verified/)).toBeVisible();
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
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Access granted" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Checking current access...")).toHaveCount(0);
    await page.screenshot({ path: `/private/tmp/lf-v4-people-${isMobile ? "mobile" : "desktop"}.png` });
  });

  test("V4 visual acceptance captures add, finance forms, and People & Access", async ({ page, isMobile }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await signIn(page, ownerEmail);
    const stage = process.env.V4_CAPTURE_STAGE === "before" ? "before" : "after";
    const size = isMobile ? "mobile" : "desktop";
    const visit = async (path: string) => {
      try {
        await page.goto(path, { waitUntil: "networkidle" });
      } catch (error) {
        if (!String(error).includes("interrupted by another navigation")) throw error;
        await page.goto(path, { waitUntil: "networkidle" });
      }
    };
    const bank = await admin.from("assets").insert({
      organisation_id: ids.org, wallet_id: ids.wallet, owner_user_id: ids.owner,
      section_key: "finances", category_key: "bank", title: `Visual Bank ${runId}`,
      provider_name: "Local visual fixture", status: "active", visibility: "private",
      metadata_json: { account_type: "current_account" },
    }).select("id").single();
    if (bank.error || !bank.data) throw bank.error ?? new Error("Could not create synthetic bank record");
    try {
      await visit("/add");
      await expect(page.getByRole("heading", { name: "Add to my Fortress" })).toBeVisible();
      if (stage === "after") {
        expect(await page.locator('a[href="/finances/investments?add=1"]').count()).toBeGreaterThan(0);
        await expect.poll(() => page.evaluate(() => document.fonts.check('20px "Material Symbols Rounded"'))).toBe(true);
      }
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-add-${size}.png`, fullPage: true });

      await visit("/finances");
      await expect(page.getByRole("heading", { name: "Finances", exact: true })).toBeVisible();
      if (stage === "after") {
        expect(await page.locator(".lf-v4-add-asset .lf-icon:visible").count()).toBeGreaterThan(0);
      }
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-finances-${size}.png`, fullPage: true });

      if (stage === "after") {
        await visit("/finances/bank");
        await expect(page.getByText(`Visual Bank ${runId}`)).toBeVisible();
        expect(await page.locator(".lf-v4-add-document .lf-icon:visible").count()).toBeGreaterThan(0);
      }

      for (const category of ["bank", "investments", "insurance"]) {
        await visit(`/finances/${category}?add=1`);
        const form = page.getByRole("region", { name: /^Add (new record|bank account|investment|insurance policy)/ });
        await expect(form).toBeVisible();
        if (stage === "after") {
          await expect(form.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(1);
          await expect(form.locator(".lf-v4-optional-group").first()).not.toHaveAttribute("open", "");
          const columns = await form.locator(".lf-v4-form-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
          expect(columns).toBe(isMobile ? 1 : 2);
          expect(await form.locator(".lf-shared-document-upload-field").count()).toBe(1);
          expect(await form.locator(".lf-v4-select-chevron").count()).toBeGreaterThan(0);
        }
        await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-${category}-${size}.png`, fullPage: true });
        if (stage === "after" && category === "bank") {
          await form.getByLabel("Add documents or photos").setInputFiles({ name: "synthetic-photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64") });
          await expect(form.getByText("synthetic-photo.png")).toBeVisible();
          await expect(form.locator(".lf-shared-document-upload-field")).toHaveCount(1);
          await form.getByRole("button", { name: "Remove synthetic-photo.png" }).click();
          await expect(form.getByText("synthetic-photo.png")).toHaveCount(0);
        }
      }

      await visit("/people-access?view=people");
      await expect(page.getByRole("heading", { name: "People & Access" })).toBeVisible();
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-people-${size}.png`, fullPage: true });
      await page.getByRole("button", { name: /Open Recovery Linked Person/ }).click();
      await expect(page.getByRole("dialog", { name: /Recovery Linked Person/ })).toBeVisible();
      if (stage === "after") {
        await expect(page.locator(".lf-person-shared-records li").filter({ hasText: firstTitle })).toBeVisible();
        await expect(page.getByRole("dialog", { name: /Recovery Linked Person/ }).getByRole("button", { name: "Revoke all" })).toBeVisible();
      }
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-person-${size}.png` });
      await page.getByRole("dialog").getByRole("button", { name: "Edit access" }).click();
      await expect(page.getByRole("dialog").getByRole("heading", { name: "Record permissions" })).toBeVisible();
      if (stage === "after") await expect(page.getByRole("dialog").getByLabel(firstTitle)).toBeVisible();
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-access-${size}.png` });
      if (stage === "after") {
        await page.getByRole("dialog").getByRole("button", { name: "Revoke all" }).click();
        await expect(page.getByRole("alertdialog", { name: "Revoke all record access" })).toBeVisible();
        await page.getByRole("alertdialog").getByRole("button", { name: "Keep access" }).click();
      }
      await visit("/people-access?view=sharing");
      await expect(page.getByRole("heading", { name: "People & Access" })).toBeVisible();
      await expect(page.locator(".lf-pa-sharing-record").filter({ hasText: firstTitle })).toBeVisible();
      if (stage === "after") await expect(page.getByRole("table", { name: "Who can see each record" }).getByRole("cell", { name: "Recovery Linked Person: Can view" })).toBeVisible();
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-sharing-${size}.png`, fullPage: true });
      await visit("/people-access?view=requests");
      await expect(page.getByRole("heading", { name: "People & Access" })).toBeVisible();
      await expect(page.locator(".lf-pa-request-row").filter({ hasText: "Recovery Linked Person" })).toBeVisible();
      await page.screenshot({ path: `/private/tmp/lf-v4-${stage}-requests-${size}.png`, fullPage: true });
    } finally {
      await admin.from("assets").delete().eq("id", bank.data.id);
    }
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
  await expect.poll(async () => {
    if (await button.isEnabled()) return true;
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    return button.isEnabled();
  }, { timeout: 15_000 }).toBe(true);
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
