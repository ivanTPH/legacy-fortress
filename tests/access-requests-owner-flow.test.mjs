import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("access requests separate owner permissions from invited-person evidence escalation", () => {
  const workspace = fs.readFileSync(path.join(root, "components/access-requests/AccessRequestsWorkspace.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const dashboardPage = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const deathCertificatePage = fs.readFileSync(path.join(root, "app/(app)/legal/death-certificate/page.tsx"), "utf8");

  assert.match(workspace, /Access Requests/);
  assert.match(workspace, /Requests awaiting your decision/);
  assert.match(workspace, /requester_name/);
  assert.match(workspace, /requester_email/);
  assert.match(workspace, /Requested access/);
  assert.match(workspace, /Approve/);
  assert.match(workspace, /Reject/);
  assert.match(workspace, /decideOwnerRequest/);
  assert.match(workspace, /contact_invitations/);
  assert.match(workspace, /Current access lives in Contacts/);
  assert.match(workspace, /Death certificate escalation/);
  assert.match(workspace, /Manage contacts and permissions/);
  assert.match(workspace, /tick or toggle exactly what wallet sections they can view or edit/);
  assert.match(workspace, /request_type !== "death_certificate"/);
  assert.match(workspace, /Request elevated access/);
  assert.match(workspace, /Submit death certificate evidence/);
  assert.match(workspace, /isLinkedRequester/);
  assert.match(workspace, /review_notes/);
  assert.doesNotMatch(workspace, /Invited access/);
  assert.doesNotMatch(workspace, /Shared Access/);
  assert.doesNotMatch(workspace, /Application review queue/);
  assert.doesNotMatch(workspace, /DEMO_ACCESS_REQUESTS/);
  assert.doesNotMatch(workspace, /Open application review/);
  assert.doesNotMatch(workspace, /Prototype rows/);
  assert.match(dashboardPage, /death-certificate"\) return "\/legal\/death-certificate"/);
  assert.match(deathCertificatePage, /Wallet owners do not submit a death certificate as evidence/);
  assert.doesNotMatch(deathCertificatePage, /router\.replace\("\/access-requests"\)/);
  assert.match(css, /\.lf-access-owner-actions/);
  assert.match(css, /max-width: 700px\)[\s\S]*\.lf-access-owner-actions[\s\S]*grid-template-columns: 1fr !important/);
});
