import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("finance category navigation does not render a second parent chooser", async () => {
  const dashboard = await read("app/(app)/dashboard/page.tsx");
  const finances = await read("app/(app)/finances/page.tsx");
  const addToFortress = await read("app/(app)/components/dashboard/AddToFortressPanel.tsx");

  assert.match(dashboard, /title="Finances"[\s\S]*addHref="\/finances"/);
  assert.match(addToFortress, /FINANCE_CATEGORY_CHOICE/);
  assert.doesNotMatch(finances, /Add to Finances|FINANCE_RECORD_CHOICES|role="dialog"/);
  assert.match(finances, /addHref=\{`\$\{section\.href\}\?add=1`\}/);
  assert.match(await read("lib/vault/addRecordTypes.ts"), /href: "\/finances"/);
});

test("guided destinations remain exact while category navigation stays exploratory", async () => {
  const guidance = await read("lib/readiness/guidance.ts");
  const queue = await read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(guidance, /href: "\/legal\/wills\?add=1"/);
  assert.match(guidance, /href: "\/support\?topic=will"/);
  assert.match(queue, /Would you like to add your Will to your Fortress\?/);
  assert.match(queue, /actionLabel.*Add my Will|return "Add my Will"/);
});

test("invitation copy explains the relationship, product and access boundary", async () => {
  const email = await read("lib/contacts/invitations.ts");
  const page = await read("app/invite/accept/InvitationAcceptPageClient.tsx");
  assert.match(email, /invited you to Legacy Fortress/);
  assert.match(email, /secure digital vault/);
  assert.match(email, /does not automatically give you access/);
  assert.match(page, /Personal Vault/);
  assert.match(page, /separate permission and verification/);
});

test("copy standard keeps customer language precise without weakening security claims", async () => {
  const standard = await read("docs/PRODUCT_COPY_STANDARD.md");
  assert.match(standard, /Ask before assuming/);
  assert.match(standard, /linked person does not automatically\s+have Vault access/);
  assert.match(standard, /personal wishes separate from formal legal dispositions/);
  assert.match(standard, /Action Centre answers `What should I do next\?`/);
});
