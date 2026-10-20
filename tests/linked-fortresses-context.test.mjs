import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const layout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
const switcher = fs.readFileSync(path.join(root, "components/navigation/WorkspaceSwitcher.tsx"), "utf8");
const viewerAccess = fs.readFileSync(path.join(root, "lib/access-control/viewerAccess.ts"), "utf8");
const wallet = fs.readFileSync(path.join(root, "app/(app)/contact-wallet/page.tsx"), "utf8");
const idv = fs.readFileSync(path.join(root, "app/identity/verify/IdentityVerificationPageClient.tsx"), "utf8");
const linkedList = fs.readFileSync(path.join(root, "app/(app)/linked-fortresses/page.tsx"), "utf8");
const linkedDetail = fs.readFileSync(path.join(root, "app/(app)/linked-fortresses/[grantId]/page.tsx"), "utf8");
const deathReportApi = fs.readFileSync(path.join(root, "app/api/estate/death-reports/route.ts"), "utf8");
const releaseMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261020091848_linked_release_access_policy.sql"), "utf8");

test("personal context clears the selected linked grant before own-vault setup", () => {
  assert.match(layout, /onClick=\{\(\) => viewerContextValue\.clearLinkedGrant\(\)\}/);
  assert.match(layout, /Return to My Fortress/);
  assert.match(wallet, /Set up my Personal Vault/);
  assert.match(layout, /resolvedViewerAccess\.mode === "linked"/);
});

test("linked context selection uses narrow relationship RPC and preserves multiple owners", () => {
  assert.match(viewerAccess, /rpc\("lf_linked_relationships"\)/);
  assert.match(viewerAccess, /row\.linked_user_id === sessionUserId/);
  assert.match(switcher, /Linked Fortresses/);
  assert.match(switcher, /contact-wallet\?grant=/);
  assert.match(switcher, /getLinkedFortressAccessLabel/);
  assert.match(viewerAccess, /Records locked/);
});

test("contact wallet and identity verification use relationship context without granting access", () => {
  assert.match(wallet, /Your relationship with/);
  assert.match(wallet, /Identity verification alone does not establish legal authority or activate estate access/);
  assert.match(wallet, /Set up my Personal Vault/);
  assert.match(idv, /\$\{labelise\(invitedRole\)\} relationship with \$\{ownerName\}/);
  assert.doesNotMatch(idv, /Executor access for \$\{ownerName\}/);
});

test("linked Fortress surfaces preserve relationship and access separation", () => {
  assert.match(linkedList, /Linked Fortresses/);
  assert.match(linkedList, /Your linked relationships/);
  assert.match(linkedDetail, /Being linked does not by itself give you access/);
  assert.match(linkedDetail, /No estate records are currently available to you/);
  assert.match(linkedDetail, /Begin estate access request/);
  assert.match(linkedDetail, /How executor access works/);
  assert.match(linkedDetail, /Estate access remains locked/);
  assert.match(deathReportApi, /account_access_grants/);
  assert.match(deathReportApi, /estate_relationship_required/);
  assert.match(deathReportApi, /declarationAccepted/);
});

test("linked record navigation and dashboard copy do not offer owner creation controls", () => {
  const access = fs.readFileSync(path.join(root, "lib/access-control/viewerAccess.ts"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  assert.match(access, /assignedSectionKeys\.length === 0 && section !== "dashboard"/);
  assert.match(access, /loadAssetSectionKeys\(client, selectedGrant\.owner_user_id, assignedAssetIds\)/);
  assert.match(dashboard, /if \(viewer\.mode === "linked"\)/);
  assert.match(dashboard, /Records and financial information remain locked pending explicit authorisation/);
  assert.match(access, /viewer\.releaseState !== "ESTATE_RELEASED"/);
});

test("new grant states default locked and released records require a reviewed scope", () => {
  assert.match(releaseMigration, /access_state text NOT NULL DEFAULT 'DESIGNATED_LOCKED'/);
  assert.match(releaseMigration, /UPDATE public\.account_access_grants SET access_state = 'REVOKED'/);
  assert.match(releaseMigration, /c\.status = 'active'/);
  assert.match(releaseMigration, /d\.status = 'confirmed'/);
  assert.match(releaseMigration, /g\.release_scope -> 'asset_ids'/);
  assert.match(releaseMigration, /g\.permissions_override -> 'asset_ids'/);
  assert.match(releaseMigration, /attorney_owner_authorized_at IS NOT NULL/);
  assert.match(releaseMigration, /DROP POLICY IF EXISTS account_access_grants_linked_select/);
  assert.match(releaseMigration, /lf_linked_relationships/);
});
