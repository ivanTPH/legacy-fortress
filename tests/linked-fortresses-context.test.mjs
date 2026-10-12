import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const layout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
const wallet = fs.readFileSync(path.join(root, "app/(app)/contact-wallet/page.tsx"), "utf8");
const idv = fs.readFileSync(path.join(root, "app/identity/verify/IdentityVerificationPageClient.tsx"), "utf8");

test("personal context clears the selected linked grant before own-vault setup", () => {
  assert.match(layout, /onClick=\{\(\) => viewerContextValue\.clearLinkedGrant\(\)\}/);
  assert.match(layout, /Set up my Personal Vault/);
  assert.match(layout, /resolvedViewerAccess\.mode === "linked"/);
});

test("linked context selection uses canonical grants and preserves multiple owners", () => {
  assert.match(switcher, /from\("account_access_grants"\)/);
  assert.match(switcher, /eq\("linked_user_id", sessionUserId\)/);
  assert.match(switcher, /People I support/);
  assert.match(switcher, /contact-wallet\?grant=/);
  assert.match(switcher, /No records shared/);
});

test("contact wallet and identity verification use relationship context without granting access", () => {
  assert.match(wallet, /Your relationship with/);
  assert.match(wallet, /Identity verification alone does not establish legal authority or activate estate access/);
  assert.match(wallet, /Set up my Personal Vault/);
  assert.match(idv, /\$\{labelise\(invitedRole\)\} relationship with \$\{ownerName\}/);
  assert.doesNotMatch(idv, /Executor access for \$\{ownerName\}/);
});
