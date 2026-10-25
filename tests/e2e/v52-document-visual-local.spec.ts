import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";

const localOnly = process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:55421" && process.env.PLAYWRIGHT_BASE_URL === "http://127.0.0.1:3012";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin = createClient("http://127.0.0.1:55421", serviceKey || anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient("http://127.0.0.1:55421", anonKey || "placeholder", { auth: { persistSession: false, autoRefreshToken: false } });
const runId = randomUUID().slice(0, 8);
const email = `v52-doc-${runId}@legacyfortress.test`;
const password = "V52Document123!";
const ids: { user?: string; org?: string; wallet?: string; asset?: string; document?: string; storagePath?: string } = {};

test.describe("V5.2 authorised document presentation", () => {
  test.beforeAll(async () => {
    test.skip(!localOnly || !anonKey || !serviceKey, "Approved local app and Supabase are required.");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Synthetic user creation failed");
    ids.user = created.data.user.id;
    const onboardingClient = admin as unknown as Parameters<typeof saveOnboardingState>[0];
    await saveTermsAcceptance(onboardingClient, ids.user, { accepted: true, source: "v52_document_visual_local" });
    await saveOnboardingState(onboardingClient, ids.user, { current_step: "complete", completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"], is_completed: true, terms_accepted: true });
    const org = await admin.from("organisations").insert({ owner_user_id: ids.user, name: `Synthetic Documents ${runId}` }).select("id").single();
    if (org.error || !org.data) throw org.error ?? new Error("Synthetic organisation creation failed");
    ids.org = org.data.id;
    const wallet = await admin.from("wallets").insert({ organisation_id: ids.org, owner_user_id: ids.user, label: "Synthetic wallet", status: "active" }).select("id").single();
    if (wallet.error || !wallet.data) throw wallet.error ?? new Error("Synthetic wallet creation failed");
    ids.wallet = wallet.data.id;
    const asset = await admin.from("assets").insert({ organisation_id: ids.org, wallet_id: ids.wallet, owner_user_id: ids.user, section_key: "property", category_key: "homes", title: `Synthetic home ${runId}`, visibility: "private", status: "active" }).select("id").single();
    if (asset.error || !asset.data) throw asset.error ?? new Error("Synthetic property creation failed");
    ids.asset = asset.data.id;
    ids.storagePath = `users/${ids.user}/assets/${ids.asset}/documents/synthetic-statement-${runId}.png`;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y5X5QAAAABJRU5ErkJggg==", "base64");
    const uploaded = await admin.storage.from("vault-docs").upload(ids.storagePath, png, { contentType: "image/png", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const document = await admin.from("documents").insert({ organisation_id: ids.org, wallet_id: ids.wallet, asset_id: ids.asset, owner_user_id: ids.user, storage_bucket: "vault-docs", storage_path: ids.storagePath, file_name: `Synthetic statement ${runId}.png`, mime_type: "image/png", size_bytes: png.byteLength, document_kind: "document" }).select("id").single();
    if (document.error || !document.data) throw document.error ?? new Error("Synthetic document creation failed");
    ids.document = document.data.id;
  });

  test.afterAll(async () => {
    if (!localOnly) return;
    if (ids.document) await admin.from("documents").delete().eq("id", ids.document);
    if (ids.storagePath) await admin.storage.from("vault-docs").remove([ids.storagePath]);
    if (ids.asset) await admin.from("assets").delete().eq("id", ids.asset);
    if (ids.wallet) await admin.from("wallets").delete().eq("id", ids.wallet);
    if (ids.org) await admin.from("organisations").delete().eq("id", ids.org);
    if (ids.user) {
      await admin.from("terms_acceptances").delete().eq("user_id", ids.user);
      await admin.from("user_onboarding_state").delete().eq("user_id", ids.user);
      await admin.auth.admin.deleteUser(ids.user);
    }
  });

  test("list, viewer and uploader keep signed document actions", async ({ page, isMobile }, testInfo) => {
    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic sign-in failed");
    await page.addInitScript((session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)), signedIn.data.session);
    await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/property/documents", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible({ timeout: 30_000 });
    const documentRow = page.getByRole("button", { name: `Open Synthetic statement ${runId}.png` });
    await expect(documentRow).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: testInfo.outputPath(`documents-list-${isMobile ? "mobile" : "desktop"}.png`), fullPage: true });
    await documentRow.click();
    const preview = page.getByRole("dialog", { name: `Synthetic statement ${runId}.png preview` });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("button", { name: "Download" })).toBeVisible();
    await expect(preview.getByText("Replace")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`document-viewer-${isMobile ? "mobile" : "desktop"}.png`), fullPage: true });
    await preview.getByRole("button", { name: "Close preview" }).click();
    await page.locator(".lf-v52-document-upload > summary").click();
    await expect(page.getByText("Link a document")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`document-uploader-${isMobile ? "mobile" : "desktop"}.png`), fullPage: true });
  });
});
