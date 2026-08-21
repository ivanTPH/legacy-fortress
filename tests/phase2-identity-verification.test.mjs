import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260821150000_phase2_identity_verification.sql");
const types = read("lib/identity-verification/types.ts");
const provider = read("lib/identity-verification/internalExperimentalProvider.ts");
const service = read("lib/identity-verification/service.ts");
const stepUpRoute = read("app/api/identity-verification/step-up/route.ts");
const stepUpMigration = read("supabase/migrations/20260821162000_phase2_step_up_presence_preserves_level2.sql");
const acceptPage = read("app/invite/accept/InvitationAcceptPageClient.tsx");
const verifyPage = read("app/identity/verify/IdentityVerificationPageClient.tsx");
const adminOps = read("lib/admin/operations.ts");

test("Phase 2 migration creates isolated identity verification model and storage bucket", () => {
  for (const table of [
    "identity_verification_requests",
    "identity_verification_documents",
    "identity_verification_events",
    "identity_verification_decisions",
    "identity_presence_challenges",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /'identity-verification-evidence'/);
  assert.doesNotMatch(migration, /identity-verification-evidence[\s\S]*vault_docs_linked_select/);
  assert.match(migration, /identity_evidence_owner_select/);
  assert.match(migration, /identity_evidence_owner_insert/);
  assert.match(migration, /identity_evidence_owner_delete/);
});

test("Phase 2 preserves separate lifecycle state machines", () => {
  assert.match(migration, /verification_purpose IN \('linked_access','registration_required','step_up_presence','admin_review'\)/);
  assert.match(migration, /status IN \([\s\S]*'document_required'[\s\S]*'camera_required'[\s\S]*'review_required'[\s\S]*'verified'/);
  assert.match(migration, /identity_level >= 3[\s\S]*expires_at[\s\S]*15 minutes/);
  assert.match(migration, /account_access_grants_activation_status_check[\s\S]*'identity_required'/);
});

test("Level 3 step-up preserves durable Level 2 assurance", () => {
  assert.match(stepUpRoute, /getCurrentIdentityAssuranceLevel/);
  assert.match(stepUpRoute, /level_2_required_for_step_up/);
  assert.match(service, /presence_identity_level: 3/);
  assert.match(service, /presence_expires_at: decision\.expiresAt/);
  assert.match(service, /identity_level: isPresenceStepUp \? Math\.max\(existingLevel, 2\) : decision\.identityLevel/);
  assert.match(service, /expires_at: isPresenceStepUp \? \(existing\?\.expires_at \?\? null\) : decision\.expiresAt/);
  assert.match(stepUpMigration, /s\.identity_level >= 2/);
  assert.match(stepUpMigration, /metadata ->> 'presence_expires_at'/);
});

test("Provider abstraction is replaceable and provider-neutral", () => {
  assert.match(types, /export interface IdentityVerificationProvider/);
  for (const method of [
    "startVerification",
    "submitIdentityDocument|extractDocumentData",
    "capturePresenceChallenge",
    "compareFaces",
    "evaluateLiveness",
    "completeVerification",
    "getVerificationStatus",
    "cancelVerification",
    "deleteProviderEvidence",
  ]) {
    assert.match(types, new RegExp(method));
  }
  assert.match(provider, /lf_internal_experimental_v1/);
  assert.match(provider, /experimental = true/);
  assert.doesNotMatch(provider, /certified|government-document validation|1:N|population face/i);
});

test("Decision service writes assurance only server-side and activates eligible grants after verification", () => {
  assert.match(service, /getRequestUser|createSupabaseAdminClient|identity_provider_not_enabled/);
  assert.match(service, /upsertIdentityAssurance/);
  assert.match(service, /identity_assurance_states/);
  assert.match(service, /activateEligibleLinkedAccess/);
  assert.match(service, /activation_status: "verified"/);
  assert.match(service, /syntheticCaptureHash/);
  assert.match(service, /sanitizeIdentityMetadata/);
  assert.match(service, /"token", "jwt", "password", "signedUrl"/);
  assert.doesNotMatch(service, /clientVerificationScore|clientVerified|clientDecision/);
});

test("Invitation acceptance sends insufficient-assurance users to identity verification", () => {
  assert.match(acceptPage, /result\.activation_status !== "verified" && result\.activation_status !== "active"/);
  assert.match(acceptPage, /\/identity\/verify/);
  assert.match(acceptPage, /purpose: "linked_access"/);
});

test("Browser capture uses real camera APIs with explicit capture and track cleanup", () => {
  assert.match(verifyPage, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(verifyPage, /videoRef/);
  assert.match(verifyPage, /toBlob/);
  assert.match(verifyPage, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(verifyPage, /UAT upload fallback/);
  assert.doesNotMatch(verifyPage, /mark verified|set verified|bypass/i);
});

test("Admin verification queue includes Phase 2 review-required identity requests", () => {
  assert.match(adminOps, /identity_verification_requests/);
  assert.match(adminOps, /identity_verification_decisions/);
  assert.match(adminOps, /manual_review_approved/);
  assert.match(adminOps, /manual_review_rejected/);
  assert.match(adminOps, /reviewNotes/);
});
