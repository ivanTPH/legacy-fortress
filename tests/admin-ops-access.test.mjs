import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const {
  MASTER_ADMIN_EMAIL,
  normalizeAdminEmail,
  isMasterAdminEmail,
  isAdminAccessGranted,
} = await import("../lib/admin/access.ts");
const {
  buildVerificationMutation,
  buildSupportIssueLabel,
  normalizeAdminUserLifecycleAction,
} = await import("../lib/admin/operations.ts");

test("admin email normalization is stable", () => {
  assert.equal(normalizeAdminEmail("  IVANYARDLEY@ME.COM "), MASTER_ADMIN_EMAIL);
  assert.equal(isMasterAdminEmail("IvAnYardley@me.com"), true);
});

test("admin access respects persisted status after master bootstrap creates a row", () => {
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, null), false);
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, { status: "active", is_master: true }), true);
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, { status: "inactive", is_master: true }), false);
  assert.equal(isAdminAccessGranted("viewer@example.com", null), false);
  assert.equal(isAdminAccessGranted("viewer@example.com", { status: "active", is_master: false }), true);
  assert.equal(isAdminAccessGranted("viewer@example.com", { status: "inactive", is_master: false }), false);
});

test("verification mutation maps approve reject and review actions safely", () => {
  assert.deepEqual(buildVerificationMutation("approve"), {
    requestStatus: "approved",
    roleActivationStatus: "verified",
    grantActivationStatus: "verified",
  });
  assert.deepEqual(buildVerificationMutation("reject"), {
    requestStatus: "rejected",
    roleActivationStatus: "rejected",
    grantActivationStatus: "rejected",
  });
  assert.deepEqual(buildVerificationMutation("review"), {
    requestStatus: null,
    roleActivationStatus: null,
    grantActivationStatus: null,
  });
});

test("support issue labels stay human-readable", () => {
  assert.equal(buildSupportIssueLabel("pending", "invited"), "Invitation still pending");
  assert.equal(buildSupportIssueLabel("failed", "invited"), "Invitation delivery failed");
  assert.equal(buildSupportIssueLabel("accepted", "verification_submitted"), "Awaiting verification review");
  assert.equal(buildSupportIssueLabel("accepted", "accepted"), "Accepted access awaiting activation");
});

test("admin support snapshot distinguishes sent pending invites from saved unsent setups", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/admin/operations.ts"), "utf8");

  assert.match(source, /countOwned\(client, "contact_invitations", skip, \(query\) => query\.eq\("invitation_status", "pending"\)\.not\("sent_at", "is", null\)\)/);
  assert.match(source, /countOwned\(client, "contact_invitations", skip, \(query\) => query\.eq\("invitation_status", "pending"\)\.is\("sent_at", null\)\)/);
  assert.match(source, /\.not\("sent_at", "is", null\)/);
  assert.match(source, /\.is\("sent_at", null\)/);
  assert.match(source, /item\.invitationStatus === "pending" && Boolean\(item\.sentAt\)/);
});

test("admin lifecycle actions are explicitly normalised", () => {
  assert.equal(normalizeAdminUserLifecycleAction("activate"), "activate");
  assert.equal(normalizeAdminUserLifecycleAction("deactivate"), "deactivate");
  assert.equal(normalizeAdminUserLifecycleAction("change_role"), "change_role");
  assert.equal(normalizeAdminUserLifecycleAction("delete"), null);
  assert.equal(normalizeAdminUserLifecycleAction(""), null);
});

test("Admin Users lists the newest accounts first and counts this week's, with no record details (owner, 16 Nov 2026)", () => {
  const ops = fs.readFileSync(new URL("../lib/admin/operations.ts", import.meta.url), "utf8");
  assert.match(ops, /export async function listAuthUsersNewestFirst/);
  assert.match(ops, /localeCompare\(String\(left\.created_at/);
  assert.match(ops, /export async function countNewAccounts/);
  const route = fs.readFileSync(new URL("../app/api/internal/admin/users/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminCapability\(admin\.access, "users:lookup"\)/, "still needs the lookup capability");
  assert.match(route, /recordAdminAuditEvent/, "still audited");
  assert.match(route, /const newThisWeek = query\.trim\(\) \? null : await countNewAccounts/);
  const ui = fs.readFileSync(new URL("../components/admin/AdminControlPlaneWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /new in the last 7 days/);
  assert.match(ui, /header: "Signed up"/);
  assert.match(ui, /if \(state !== "ready" \|\| section !== "users"\) return;/);
});

test("Admin hides automated test accounts by default; reserved test domains only", async () => {
  const { isTestAccountEmail } = await import("../lib/admin/operations.ts").catch(() => ({ isTestAccountEmail: null }));
  const ops = fs.readFileSync(new URL("../lib/admin/operations.ts", import.meta.url), "utf8");
  assert.match(ops, /if \(!includeTests && !normalizedQuery && isTestAccountEmail\(user\.email\)\) return false;/, "searching still finds any account");
  if (isTestAccountEmail) {
    for (const email of ["vault-access-1-applicant@example.test", "a@example.com", "x@foo.test", "y@bar.invalid"]) assert.equal(isTestAccountEmail(email), true, email);
    for (const email of ["ivan@me.com", "someone@gmail.com", "a@example.co.uk", "b@testing.com"]) assert.equal(isTestAccountEmail(email), false, email);
  }
  const ui = fs.readFileSync(new URL("../components/admin/AdminControlPlaneWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /Show test accounts/);
});

test("Admin Inbox: account details and counts only, same permission and audit as finding customers (16 Nov 2026)", () => {
  const lib = fs.readFileSync(new URL("../lib/admin/inbox.ts", import.meta.url), "utf8");
  const selects = [...lib.matchAll(/select\("([^"]+)"/g)].map((match) => match[1]).join(",");
  assert.doesNotMatch(selects, /file_name|storage_path|contact_name|contact_email|full_name|title|value_minor|metadata|payload/, "reads never include names, files, values or invitees");
  assert.match(lib, /select\("owner_user_id,event_type,created_at"\)/);
  assert.match(lib, /select\("owner_user_id,created_at"\)/);
  assert.match(lib, /isTestAccountEmail/);
  const route = fs.readFileSync(new URL("../app/api/internal/admin/inbox/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminCapability\(admin\.access, "users:lookup"\)/);
  assert.match(route, /recordAdminAuditEvent/);
  const ui = fs.readFileSync(new URL("../components/admin/AdminInbox.tsx", import.meta.url), "utf8");
  for (const text of ["Refresh", "Pull to refresh", "60_000", "Mark all as read", "Show test accounts"]) assert.ok(ui.includes(text), text);
  const nav = fs.readFileSync(new URL("../components/admin/adminNavigation.ts", import.meta.url), "utf8");
  assert.match(nav, /key: "inbox", label: "Inbox", href: "\/admin\/inbox", icon: "inbox", capability: "users:lookup"/);
});

test("Admin customer page: counts open details only; no names, emails, titles, values or file names (16 Nov 2026)", () => {
  const ops = fs.readFileSync(new URL("../lib/admin/operations.ts", import.meta.url), "utf8");
  const detail = ops.slice(ops.indexOf("export async function loadUserOperationalDetail"), ops.indexOf("export async function loadUserOperationalDetail") + 9000);
  const selects = [...detail.matchAll(/select\("([^"]+)"/g)].map((match) => match[1]);
  const listSelects = selects.filter((cols) => !/display_name|account_plan|organisation_role/.test(cols)).join(",");
  assert.doesNotMatch(listSelects, /full_name|email|contact_name|contact_email|title|value_minor|file_name|storage_path|metadata|notes/);
  assert.match(detail, /label: `Person \$\{index \+ 1\}`/);
  const ui = fs.readFileSync(new URL("../components/admin/AdminAccountSummary.tsx", import.meta.url), "utf8");
  assert.match(ui, /aria-expanded=\{open === key\}/);
  assert.doesNotMatch(ui, /fullName|contactName|contactEmail|fileName|file_name/);
  const page = fs.readFileSync(new URL("../components/admin/AdminControlPlaneWorkspace.tsx", import.meta.url), "utf8");
  assert.match(page, /<AdminAccountSummary detail=\{detail\} \/>/);
});

test("one Show test accounts choice applies across Admin; counts and lists agree (16 Nov 2026)", () => {
  const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const route of ["dashboard-summary", "support", "verifications", "probate-cases", "legal-authorities", "users", "inbox"]) {
    assert.match(read(`app/api/internal/admin/${route}/route.ts`), /includeTestsFrom\(request\)/, route);
  }
  const ui = read("components/admin/AdminControlPlaneWorkspace.tsx");
  assert.match(ui, /if \(readIncludeTests\(\)\) headers\.set\("x-lf-include-tests", "1"\)/);
  assert.match(ui, /const probateToReview = probate\.filter/, "Overview counts probate like the Probate page");
  assert.match(read("lib/admin/dashboardSummary.ts"), /without\|with no\|incomplete/, "'Users with no …' is not shown as healthy");
  assert.doesNotMatch(read("lib/admin/dashboardSummary.ts"), /perPage: 1000/, "counts read every account, not the first 1,000");
});
