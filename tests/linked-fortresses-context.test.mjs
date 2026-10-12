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

test("personal context clears the selected linked grant before own-vault setup", () => {
  assert.match(layout, /onClick=\{\(\) => viewerContextValue\.clearLinkedGrant\(\)\}/);
  assert.match(layout, /Return to My Fortress/);
  assert.match(wallet, /Set up my Personal Vault/);
  assert.match(layout, /resolvedViewerAccess\.mode === "linked"/);
});

test("linked context selection uses canonical grants and preserves multiple owners", () => {
  assert.match(viewerAccess, /from\("account_access_grants"\)/);
  assert.match(viewerAccess, /eq\("linked_user_id", sessionUserId\)/);
  assert.match(switcher, /People I support/);
  assert.match(switcher, /contact-wallet\?grant=/);
  assert.match(switcher, /getLinkedFortressAccessLabel/);
  assert.match(viewerAccess, /No records shared/);
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
  assert.match(linkedList, /People I support/);
  assert.match(linkedDetail, /Being linked does not by itself give you access/);
  assert.match(linkedDetail, /No estate records are currently available to you/);
  assert.match(linkedDetail, /Report a death \/ begin estate access request/);
  assert.match(linkedDetail, /Estate access remains locked/);
  assert.match(deathReportApi, /account_access_grants/);
  assert.match(deathReportApi, /estate_relationship_required/);
  assert.match(deathReportApi, /declarationAccepted/);
});

test("linked record navigation and dashboard copy do not offer owner creation controls", () => {
  const access = fs.readFileSync(path.join(root, "lib/access-control/viewerAccess.ts"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const summaryCard = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx"), "utf8");
  assert.match(access, /assignedSectionKeys\.length === 0 && section !== "dashboard"/);
  assert.match(dashboard, /Only records explicitly shared with you are shown here/);
  assert.match(dashboard, /showAddAction=\{viewer\.mode !== "linked"\}/);
  assert.match(summaryCard, /showAddAction = true/);
});
