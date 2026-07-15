import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const runId = Date.now();
const email = `final-uat-workflows-${runId}@example.test`;
const password = "FinalUatWorkflows123!";
let userId = "";

type FieldFill = { label: string | RegExp; value: string; kind?: "input" | "select" | "textarea" };

const routes: Array<{
  name: string;
  path: string;
  add: RegExp;
  save: RegExp;
  tokenPrefix: string;
  fields: FieldFill[];
}> = [
  {
    name: "Finances bank",
    path: "/finances/bank",
    add: /add bank record/i,
    save: /save bank record/i,
    tokenPrefix: "UAT Bank",
    fields: [
      { label: "Record title", value: "UAT Bank Record" },
      { label: "Bank / provider name", value: "UAT Bank Provider" },
      { label: "Account type", value: "current_account", kind: "select" },
      { label: "Account holder", value: "UAT Bank Holder" },
      { label: "Account number", value: "12345678" },
      { label: "Country", value: "UK", kind: "select" },
      { label: "Current balance", value: "12345" },
      { label: "Balance last updated", value: "2027-01-15" },
    ],
  },
  {
    name: "Legal wills",
    path: "/legal/wills",
    add: /add record/i,
    save: /save record/i,
    tokenPrefix: "UAT Will",
    fields: [
      { label: "Will or document name", value: "UAT Will Record" },
      { label: "Document or note type", value: "Will document" },
      { label: "Short description", value: "Synthetic will summary" },
      { label: "Notes or instructions", value: "Synthetic will notes", kind: "textarea" },
    ],
  },
  {
    name: "Property",
    path: "/vault/property",
    add: /add property/i,
    save: /save property asset|save record/i,
    tokenPrefix: "UAT Property",
    fields: [
      { label: "Property name", value: "UAT Property Asset" },
      { label: "Property type", value: "residential", kind: "select" },
      { label: "Ownership type", value: "sole", kind: "select" },
      { label: "Address", value: "1 Synthetic Street, Test Town", kind: "textarea" },
      { label: "Country", value: "UK", kind: "select" },
      { label: "Occupancy status", value: "main_residence", kind: "select" },
      { label: "Estimated value", value: "350000" },
      { label: "Mortgage status", value: "none", kind: "select" },
    ],
  },
  {
    name: "Business",
    path: "/business",
    add: /add business/i,
    save: /save business interest|save record/i,
    tokenPrefix: "UAT Business",
    fields: [
      { label: "Business name", value: "UAT Business Interest" },
      { label: "Business type", value: "limited_company", kind: "select" },
      { label: "Jurisdiction", value: "UK", kind: "select" },
      { label: "Status", value: "active", kind: "select" },
      { label: "Estimated value", value: "42000" },
    ],
  },
  {
    name: "Cars and Transport",
    path: "/cars-transport",
    add: /add transport record|add record/i,
    save: /save record/i,
    tokenPrefix: "UAT Transport",
    fields: [
      { label: "Title", value: "UAT Transport Record" },
      { label: "Summary", value: "Synthetic car record" },
      { label: "Estimated value", value: "9000" },
    ],
  },
  {
    name: "Employment",
    path: "/employment",
    add: /add employment record|add record/i,
    save: /save record/i,
    tokenPrefix: "UAT Employment",
    fields: [
      { label: "Title", value: "UAT Employment Record" },
      { label: "Summary", value: "Synthetic employer record" },
      { label: "Estimated value", value: "1000" },
      { label: "Employment details", value: "Synthetic employment details", kind: "textarea" },
    ],
  },
];

test.describe("Final selector-specific workflow UAT", () => {
  test.beforeAll(async () => {
    test.skip(!supabaseUrl || !supabaseAnonKey || !databaseUrl, "Local Supabase URL, anon key, and DB URL are required.");
    ensureLocalStorageBucket();
    userId = await signUpSyntheticUser(email);
    confirmSyntheticUser(userId);
    markOnboardingComplete(userId);
  });

  test.afterAll(async () => {
    deleteSyntheticUsers([userId].filter(Boolean));
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const route of routes) {
    test(`${route.name}: create, refresh, search, edit, and delete`, async ({ page }) => {
      const token = `${route.tokenPrefix} ${runId}`;
      const editedToken = `${token} Edited`;

      await page.goto(route.path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await page.getByRole("button", { name: route.add }).first().click();
      await fillRouteFields(page, route.fields, token);
      await page.getByRole("button", { name: route.save }).first().click();
      await expect(page.getByText(/record added securely|changes saved securely/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(token, { exact: false })).toBeVisible({ timeout: 15000 });

      await page.reload();
      await expect(page.getByText(token, { exact: false })).toBeVisible({ timeout: 15000 });
      await searchFor(page, token);
      await expect(page.getByText(token, { exact: false })).toBeVisible();

      await page.getByRole("button", { name: /edit record/i }).first().click();
      await replacePrimaryTitle(page, route.fields[0].label, editedToken);
      await page.getByRole("button", { name: /save changes/i }).first().click();
      await expect(page.getByText(/changes saved securely/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(editedToken, { exact: false })).toBeVisible({ timeout: 15000 });

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: /delete record|^delete$/i }).first().click();
      await expect(page.getByText(/record deleted/i)).toBeVisible({ timeout: 15000 });
      await searchFor(page, editedToken);
      await expect(page.getByText(editedToken, { exact: false })).toHaveCount(0);
    });
  }

  test("Contacts: create, refresh, search, edit, and remove", async ({ page }) => {
    const token = `UAT Contact ${runId}`;
    const editedToken = `${token} Edited`;
    const contactEmail = `uat-contact-${runId}@example.test`;

    await page.goto("/contacts");
    await expect(page.getByText("Contacts in place")).toBeVisible();
    await page.getByRole("button", { name: /^add contact$/i }).first().click();
    const addRegion = page.getByRole("region", { name: /add contact and permissions/i });
    await addRegion.getByLabel("Name").fill(token);
    await addRegion.getByLabel("Email").fill(contactEmail);
    await addRegion.getByLabel("Role").selectOption("friend_or_family");
    await addRegion.getByLabel("Owner notes").fill("Synthetic contact notes");
    await addRegion.getByRole("button", { name: /^add contact$/i }).click();
    await expect(page.getByRole("button", { name: /family\s+1/i })).toBeVisible({ timeout: 15000 });
    await page.goto("/contacts");
    await expect(page.getByText(token, { exact: false })).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.getByText(token, { exact: false })).toBeVisible({ timeout: 15000 });
    await page.getByRole("textbox", { name: /^search contacts$/i }).fill(token);
    await expect(page.getByText(token, { exact: false })).toBeVisible();

    await page.getByRole("button", { name: /manage/i }).first().click();
    const manageRegion = page.getByRole("region", { name: new RegExp(`Manage selected contact: ${escapeRegExp(token)}`, "i") });
    await manageRegion.getByLabel("Name").fill(editedToken);
    await manageRegion.getByRole("button", { name: /^save$/i }).click();
    await page.getByRole("textbox", { name: /^search contacts$/i }).fill(editedToken);
    await expect(page.getByText(editedToken, { exact: false })).toBeVisible({ timeout: 15000 });
    const editedManageRegion = page.getByRole("region", { name: new RegExp(`Manage selected contact: ${escapeRegExp(editedToken)}`, "i") });

    page.once("dialog", (dialog) => dialog.accept());
    await editedManageRegion.getByRole("button", { name: /^remove$/i }).click();
    await page.getByRole("textbox", { name: /^search contacts$/i }).fill(editedToken);
    await expect(page.getByText(editedToken, { exact: false })).toHaveCount(0);
  });

  test("Attachments: canonical and legacy records support upload, preview, download, print, replace, remove, and fallback", async ({ page }) => {
    const bankRoute = routes.find((route) => route.name === "Finances bank");
    const transportRoute = routes.find((route) => route.name === "Cars and Transport");
    if (!bankRoute || !transportRoute) throw new Error("Attachment test routes are missing.");

    const canonicalToken = `UAT Attachment Bank ${runId}`;
    const legacyToken = `UAT Attachment Transport ${runId}`;
    await createWorkflowRecord(page, bankRoute, canonicalToken);
    await createWorkflowRecord(page, transportRoute, legacyToken);

    await page.goto(bankRoute.path);
    await openRecordDocuments(page, canonicalToken);
    await uploadRecordDocument(page, canonicalToken, testFile(`canonical-${runId}.pdf`, "application/pdf", "%PDF-1.4\n% synthetic pdf\n"));
    await proveAttachmentVisibleAfterRefresh(page, canonicalToken, `canonical-${runId}.pdf`);
    await provePreviewDownloadAndPrint(page, `canonical-${runId}.pdf`, true);

    await replaceAttachment(page, `canonical-${runId}.pdf`, testFile(`canonical-${runId}.png`, "image/png", tinyPngBuffer()));
    await expectAttachmentText(page, `canonical-${runId}.png`);
    await page.reload();
    await openRecordDocuments(page, canonicalToken);
    await expectAttachmentText(page, `canonical-${runId}.png`);
    await provePreviewDownloadAndPrint(page, `canonical-${runId}.png`, true);

    await replaceAttachment(page, `canonical-${runId}.png`, testFile(`canonical-${runId}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "synthetic office document"));
    await expectAttachmentText(page, `canonical-${runId}.docx`);
    await page.getByRole("button", { name: new RegExp(`Open ${escapeRegExp(`canonical-${runId}.docx`)}`, "i") }).click();
    await expect(page.getByRole("dialog", { name: new RegExp(`canonical-${runId}\\.docx preview`, "i") })).toBeVisible();
    await expect(page.getByText(/cannot be previewed safely/i).first()).toBeVisible();
    await page.getByRole("button", { name: /close preview/i }).click();
    await expect(page.getByRole("button", { name: new RegExp(`Print ${escapeRegExp(`canonical-${runId}.docx`)}`, "i") })).toHaveCount(0);
    await downloadAttachment(page, `canonical-${runId}.docx`);
    await removeAttachment(page, `canonical-${runId}.docx`);
    await expect(page.getByText(`canonical-${runId}.docx`, { exact: false })).toHaveCount(0);

    await page.goto(transportRoute.path);
    await uploadLegacyDocument(page, legacyToken, testFile(`legacy-${runId}.pdf`, "application/pdf", "%PDF-1.4\n% synthetic legacy pdf\n"));
    await proveAttachmentVisibleAfterRefresh(page, legacyToken, `legacy-${runId}.pdf`);
    await replaceAttachment(page, `legacy-${runId}.pdf`, testFile(`legacy-${runId}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "synthetic legacy office document"));
    await expectAttachmentText(page, `legacy-${runId}.docx`);
    await downloadAttachment(page, `legacy-${runId}.docx`);
    await removeAttachment(page, `legacy-${runId}.docx`);
    await expect(page.getByText(`legacy-${runId}.docx`, { exact: false })).toHaveCount(0);
  });

  test("Dashboard counts update after create, edit, delete, refresh, and re-login", async ({ page }) => {
    test.setTimeout(240_000);
    const checkedRoutes = routes.filter((route) => ["Finances bank", "Property", "Business"].includes(route.name));
    const cards = {
      "Finances bank": /All finances summary/i,
      Property: /Property summary/i,
      Business: /Business summary/i,
    } as const;
    const expectedFinalCounts: Array<{ card: RegExp; count: number }> = [];

    for (const route of checkedRoutes) {
      const title = `UAT Dashboard ${route.name} ${runId}`;
      const editedTitle = `${title} Edited`;
      const cardName = cards[route.name as keyof typeof cards];
      await page.goto("/dashboard");
      const before = await readDashboardCount(page, cardName);

      await createWorkflowRecord(page, route, title);
      await page.goto("/dashboard");
      await page.reload();
      await expectDashboardCount(page, cardName, before + 1);

      await page.goto(route.path);
      await searchFor(page, title);
      await page.locator("article").filter({ hasText: title }).first().getByRole("button", { name: /edit record/i }).click();
      await replacePrimaryTitle(page, route.fields[0].label, editedTitle);
      await page.getByRole("button", { name: /save changes/i }).first().click();
      await expect(page.getByText(/changes saved securely/i)).toBeVisible({ timeout: 15000 });
      await page.goto("/dashboard");
      await expectDashboardCount(page, cardName, before + 1);

      await page.goto(route.path);
      await searchFor(page, editedTitle);
      let targetCard = page.locator("article").filter({ hasText: editedTitle }).first();
      if (await targetCard.count() === 0) {
        await searchFor(page, title);
        targetCard = page.locator("article").filter({ hasText: title }).first();
      }
      page.once("dialog", (dialog) => dialog.accept());
      await targetCard.getByRole("button", { name: /delete record|^delete$/i }).click();
      await page.goto("/dashboard");
      await page.reload();
      await expectDashboardCount(page, cardName, before);
      expectedFinalCounts.push({ card: cardName, count: before });
    }

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await signIn(page);
    await page.goto("/dashboard");
    for (const expected of expectedFinalCounts) {
      await expectDashboardCount(page, expected.card, expected.count);
    }
  });

  test("Mobile release smoke covers auth, records, contact, attachment, navigation, and validation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const bankRoute = routes.find((route) => route.name === "Finances bank");
    const transportRoute = routes.find((route) => route.name === "Cars and Transport");
    if (!bankRoute || !transportRoute) throw new Error("Mobile smoke routes are missing.");

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /All finances summary/i })).toBeVisible();
    await page.goto(bankRoute.path);
    await page.getByRole("button", { name: bankRoute.add }).first().click();
    await page.getByRole("button", { name: bankRoute.save }).first().click();
    await expect(page.getByText(/required/i).first()).toBeVisible();

    const mobileBankToken = `UAT Mobile Bank ${runId}`;
    await fillRouteFields(page, bankRoute.fields, mobileBankToken);
    await page.getByRole("button", { name: bankRoute.save }).first().click();
    await expect(page.getByText(mobileBankToken, { exact: false })).toBeVisible({ timeout: 15000 });
    await openRecordDocuments(page, mobileBankToken);
    await uploadRecordDocument(page, mobileBankToken, testFile(`mobile-${runId}.pdf`, "application/pdf", "%PDF-1.4\n% mobile pdf\n"));
    await expect(page.getByText(`mobile-${runId}.pdf`, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await removeAttachment(page, `mobile-${runId}.pdf`);

    const mobileTransportToken = `UAT Mobile Transport ${runId}`;
    await createWorkflowRecord(page, transportRoute, mobileTransportToken);
    await page.goto(transportRoute.path);
    await searchFor(page, mobileTransportToken);
    await page.getByRole("button", { name: /edit record/i }).first().click();
    await replacePrimaryTitle(page, transportRoute.fields[0].label, `${mobileTransportToken} Edited`);
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByText(`${mobileTransportToken} Edited`, { exact: false })).toBeVisible({ timeout: 15000 });

    const contactToken = `UAT Mobile Contact ${runId}`;
    await page.goto("/contacts");
    await page.getByRole("button", { name: /^add contact$/i }).first().click();
    const addRegion = page.getByRole("region", { name: /add contact and permissions/i });
    await addRegion.getByLabel("Name").fill(contactToken);
    await addRegion.getByLabel("Email").fill(`uat-mobile-contact-${runId}@example.test`);
    await addRegion.getByLabel("Role").selectOption("friend_or_family");
    await addRegion.getByRole("button", { name: /^add contact$/i }).click();
    await page.getByRole("textbox", { name: /^search contacts$/i }).fill(contactToken);
    await expect(page.getByText(contactToken, { exact: false })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /manage/i }).first().click();
    const manageRegion = page.getByRole("region", { name: new RegExp(`Manage selected contact: ${escapeRegExp(contactToken)}`, "i") });
    page.once("dialog", (dialog) => dialog.accept());
    await manageRegion.getByRole("button", { name: /^remove$/i }).click();
    await page.getByRole("textbox", { name: /^search contacts$/i }).fill(contactToken);
    await expect(page.getByText(contactToken, { exact: false })).toHaveCount(0);

    await page.goto("/dashboard");
    await expect(page.locator("body")).not.toContainText(/Checking session/i);
    await page.getByRole("button", { name: /toggle navigation menu/i }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

async function signIn(page: Page) {
  await page.goto("/sign-in");
  if (!/sign-in/.test(page.url())) return;
  await page.getByLabel("Email").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

async function createWorkflowRecord(page: Page, route: (typeof routes)[number], token: string) {
  await page.goto(route.path);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.getByRole("button", { name: route.add }).first().click();
  await fillRouteFields(page, route.fields, token);
  await page.getByRole("button", { name: route.save }).first().click();
  await expect(page.getByText(/record added securely|changes saved securely/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(token, { exact: false })).toBeVisible({ timeout: 15000 });
}

async function openRecordDocuments(page: Page, token: string) {
  const card = page.locator("article").filter({ hasText: token }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  const disclosure = card.getByRole("button", { name: /documents|open document|hide documents/i }).first();
  if (await disclosure.count()) {
    await disclosure.click();
  }
}

async function uploadRecordDocument(page: Page, token: string, file: ReturnType<typeof testFile>) {
  const card = page.locator("article").filter({ hasText: token }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.locator("label").filter({ hasText: /Upload document to/i }).locator("input[type=file]").first().setInputFiles(file);
  await expectAttachmentText(page, file.name);
}

async function uploadLegacyDocument(page: Page, token: string, file: ReturnType<typeof testFile>) {
  const card = page.locator("article").filter({ hasText: token }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.locator("label").filter({ hasText: /Upload file/i }).locator("input[type=file]").first().setInputFiles(file);
  await expectAttachmentText(page, file.name);
}

async function proveAttachmentVisibleAfterRefresh(page: Page, token: string, fileName: string) {
  await expectAttachmentText(page, fileName);
  await page.reload();
  await openRecordDocuments(page, token);
  await expectAttachmentText(page, fileName);
}

async function expectAttachmentText(page: Page, fileName: string) {
  await expect(page.getByText(fileName, { exact: false }).first()).toBeVisible({ timeout: 15000 });
}

async function provePreviewDownloadAndPrint(page: Page, fileName: string, printable: boolean) {
  await page.getByRole("button", { name: new RegExp(`Open preview for ${escapeRegExp(fileName)}|Open ${escapeRegExp(fileName)}`, "i") }).click();
  await expect(page.getByRole("dialog", { name: new RegExp(`${escapeRegExp(fileName)} preview`, "i") })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /close preview/i }).click();
  await downloadAttachment(page, fileName);
  if (printable) {
    const iframeCount = await page.locator("iframe").count();
    await page.getByRole("button", { name: new RegExp(`Print ${escapeRegExp(fileName)}`, "i") }).click();
    await expect.poll(() => page.locator("iframe").count(), { timeout: 15000 }).toBeGreaterThan(iframeCount);
  }
}

async function downloadAttachment(page: Page, fileName: string) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: new RegExp(`Download ${escapeRegExp(fileName)}`, "i") }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(fileName);
}

async function replaceAttachment(page: Page, oldFileName: string, file: ReturnType<typeof testFile>) {
  await page.locator(`label[aria-label="Replace ${cssEscape(oldFileName)}"] input[type=file]`).setInputFiles(file);
}

async function removeAttachment(page: Page, fileName: string) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: new RegExp(`Remove ${escapeRegExp(fileName)}`, "i") }).click();
  await expect(page.getByText(/attachment removed|document removed/i)).toBeVisible({ timeout: 15000 });
}

async function readDashboardCount(page: Page, cardName: RegExp) {
  const card = page.getByRole("link", { name: cardName });
  await expect(card).toBeVisible({ timeout: 15000 });
  const text = await card.innerText();
  const count = text.match(/\b(\d+)\b/)?.[1];
  if (!count) throw new Error(`Could not parse dashboard count from: ${text}`);
  return Number(count);
}

async function expectDashboardCount(page: Page, cardName: RegExp, expected: number) {
  await expect.poll(() => readDashboardCount(page, cardName), { timeout: 15000 }).toBe(expected);
}

function testFile(name: string, mimeType: string, content: string | Buffer) {
  return {
    name,
    mimeType,
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
  };
}

function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}

function cssEscape(value: string) {
  return value.replace(/"/g, '\\"');
}

async function fillRouteFields(page: Page, fields: FieldFill[], token: string) {
  for (const field of fields) {
    const value = field === fields[0] ? token : field.value;
    await fillByLabel(page, field.label, value, field.kind);
  }
}

async function fillByLabel(page: Page, label: string | RegExp, value: string, kind: FieldFill["kind"] = "input") {
  const control = page.getByLabel(label).first();
  await expect(control).toBeVisible({ timeout: 10000 });
  if (kind === "select") {
    await control.selectOption(value, { timeout: 2000 }).catch(async () => control.selectOption({ index: 1 }));
    return;
  }
  await control.fill(value);
}

async function replacePrimaryTitle(page: Page, label: string | RegExp, value: string) {
  await fillByLabel(page, label, value);
}

async function searchFor(page: Page, value: string) {
  const search = page.getByLabel(/^search contacts$|^search$/i).first();
  if (await search.count()) {
    await search.fill(value);
    return;
  }
  const placeholderSearch = page.getByPlaceholder(/search|find/i).first();
  if (await placeholderSearch.count()) {
    await placeholderSearch.fill(value);
  }
}

async function signUpSyntheticUser(recipient: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signUp({
    email: recipient,
    password,
  });
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error(`Supabase did not return a user id for ${recipient}.`);
  return id;
}

function confirmSyntheticUser(id: string) {
  runPsql(`
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = ${uuidLiteral(id)};
  `);
}

function markOnboardingComplete(id: string) {
  const now = new Date().toISOString();
  runPsql(`
    insert into public.user_onboarding_state (
      user_id,
      current_step,
      completed_steps,
      is_completed,
      terms_accepted,
      marketing_opt_in,
      updated_at
    )
    values (
      ${uuidLiteral(id)},
      'complete',
      array['identity', 'verification', 'consent', 'personal_details', 'vault_categories', 'complete']::text[],
      true,
      true,
      false,
      ${stringLiteral(now)}::timestamptz
    )
    on conflict (user_id) do update
    set current_step = excluded.current_step,
        completed_steps = excluded.completed_steps,
        is_completed = excluded.is_completed,
        terms_accepted = excluded.terms_accepted,
        marketing_opt_in = excluded.marketing_opt_in,
        updated_at = excluded.updated_at;

    insert into public.terms_acceptances (
      user_id,
      terms_version,
      accepted,
      accepted_at,
      source,
      updated_at
    )
    values (
      ${uuidLiteral(id)},
      'legacy-fortress-2026-03',
      true,
      ${stringLiteral(now)}::timestamptz,
      'final-uat-workflows',
      ${stringLiteral(now)}::timestamptz
    )
    on conflict (user_id) do update
    set terms_version = excluded.terms_version,
        accepted = excluded.accepted,
        accepted_at = excluded.accepted_at,
        source = excluded.source,
        updated_at = excluded.updated_at;
  `);
}

function ensureLocalStorageBucket() {
  runPsql(`
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'vault-docs',
      'vault-docs',
      false,
      15728640,
      array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ]
    )
    on conflict (id) do update
    set name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types,
        updated_at = now();
  `);
}

function deleteSyntheticUsers(ids: string[]) {
  if (!ids.length || !databaseUrl) return;
  runPsql(`
    delete from auth.users
    where id in (${ids.map(uuidLiteral).join(",")});
  `);
}

function runPsql(sql: string) {
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

function uuidLiteral(value: string) {
  const normalized = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`Invalid UUID literal: ${value}`);
  }
  return `${stringLiteral(normalized)}::uuid`;
}

function stringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
