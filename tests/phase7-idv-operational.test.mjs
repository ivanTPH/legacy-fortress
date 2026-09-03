import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260830100000_phase7_idv_operational_workflow.sql");
const service = read("lib/identity-verification/service.ts");
const provider = read("lib/identity-verification/internalExperimentalProvider.ts");
const userPage = read("app/identity/verify/IdentityVerificationPageClient.tsx");
const adminPage = read("components/admin/AdminControlPlaneWorkspace.tsx");
const adminOps = read("lib/admin/operations.ts");
const callback = read("app/api/identity-verification/callback/route.ts");
const documentRoute = read("app/api/identity-verification/[requestId]/document/route.ts");
const cameraRoute = read("app/api/identity-verification/[requestId]/camera/route.ts");
const startRoute = read("app/api/identity-verification/route.ts");
const contactWallet = read("app/(app)/contact-wallet/page.tsx");

test("operational migration isolates review notes and adds reviewer/idempotency fields", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.identity_verification_review_notes/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.identity_verification_review_notes FROM anon/);
  assert.match(migration, /REVOKE ALL ON public\.identity_verification_review_notes FROM authenticated/);
  assert.match(migration, /assigned_reviewer_user_id/);
  assert.match(migration, /provider_event_id/);
});

test("staging simulator is explicit and has deterministic safe scenarios", () => {
  assert.match(service, /knownProductionTarget/);
  assert.match(service, /knownNonProductionTarget/);
  assert.match(provider, /experimental = true/);
  assert.match(provider, /document-failed/);
  assert.match(provider, /liveness-fail/);
  assert.match(provider, /provider-timeout/);
});

test("user journey exposes document selection and labels synthetic results", () => {
  assert.match(userPage, /STAGING IDENTITY SIMULATOR/);
  assert.match(userPage, /No genuine identity or biometric verification is performed/);
  assert.match(userPage, /national_identity_document/);
  assert.match(userPage, /STAGING IDENTITY SIMULATOR/);
  assert.match(userPage, /Use synthetic test document/);
  assert.match(userPage, /Use synthetic live-person capture/);
  assert.match(userPage, /How would you provide your document/);
  assert.match(userPage, /Take a photo/);
  assert.match(userPage, /Choose from Photo Library/);
  assert.match(userPage, /Choose a file/);
  assert.match(userPage, /STAGING SIMULATION/);
  assert.match(userPage, /Document check/);
  assert.match(userPage, /Live check/);
  assert.match(userPage, /lf-trust-journey/);
  assert.doesNotMatch(userPage, /type="file"/);
  assert.doesNotMatch(userPage, /localStorage|sessionStorage/);
});

test("synthetic operations use server-side metadata-only paths", () => {
  assert.match(documentRoute, /body\.synthetic/);
  assert.match(documentRoute, /generateSyntheticDocumentEvidence/);
  assert.match(cameraRoute, /body\.synthetic/);
  assert.match(cameraRoute, /generateSyntheticCameraEvidence/);
  assert.match(service, /storage_bucket: "synthetic"/);
  assert.match(service, /storage_path: null/);
  assert.match(startRoute, /simulatorScenario/);
  assert.match(service, /linked_access_context_required/);
});

test("identity admin workflow is limited to review-safe actions", () => {
  const verificationUi = adminPage.slice(adminPage.indexOf("function renderVerification"), adminPage.indexOf("function renderProbate"));
  assert.match(adminPage, /Assign to me/);
  assert.match(adminPage, /Request retry/);
  assert.match(adminPage, /Add review note/);
  assert.match(adminPage, /Raw identity documents, selfies, biometric templates/);
  assert.doesNotMatch(adminPage, /Override IDV/);
  assert.doesNotMatch(verificationUi, />Approve<|>Activate</);
  assert.match(adminOps, /identity_manual_decision_not_supported/);
});

test("provider callback verifies signed, bounded, idempotent events", () => {
  assert.match(callback, /timingSafeEqual/);
  assert.match(callback, /MAX_CLOCK_SKEW_MS/);
  assert.match(callback, /providerReference/);
  assert.match(callback, /provider_event_id/);
  assert.match(callback, /identity_callback_reference_unknown/);
  assert.match(callback, /safeMetadata/);
});

test("executor workspace keeps identity, authority, and access visibly separate", () => {
  assert.match(contactWallet, /label="Acting for"/);
  assert.match(contactWallet, /label="Role acceptance"/);
  assert.match(contactWallet, /label="Identity"/);
  assert.match(contactWallet, /label="Authority"/);
  assert.match(contactWallet, /label="Access"/);
  assert.match(contactWallet, /Next step/);
  assert.match(contactWallet, /does not establish legal authority or activate estate access/);
});
