import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const {
  ProbateCaseTransitionError,
  assertProbateCaseTransitionAllowed,
  getAllowedProbateCaseActions,
  isTerminalProbateCaseStatus,
} = await import("../lib/admin/probateCases.ts");

test("Phase 2B migration adds canonical probate case and evidence tables", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.probate_cases/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.probate_case_evidence/);
  assert.match(migration, /status IN \('submitted','needs_information','under_review','approved','rejected','revoked','closed'\)/);
  assert.match(migration, /verification_request_id uuid REFERENCES public\.verification_requests/);
  assert.match(migration, /role_assignment_id uuid REFERENCES public\.role_assignments/);
  assert.match(migration, /access_grant_id uuid REFERENCES public\.account_access_grants/);
  assert.match(migration, /document_id uuid REFERENCES public\.documents/);
  assert.match(migration, /ALTER TABLE public\.probate_cases ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.probate_case_evidence ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /INSERT INTO public\.probate_cases/);
});

test("Phase 2B admin routes enforce capability gates and required decision notes", () => {
  const listRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/probate-cases/route.ts"), "utf8");
  const actionRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/probate-cases/[caseId]/actions/route.ts"), "utf8");
  const evidenceRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/probate-cases/[caseId]/evidence/route.ts"), "utf8");
  const signedRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url/route.ts"), "utf8");

  assert.match(listRoute, /requireAdminCapability\(admin\.access, "verification:read"\)/);
  assert.match(listRoute, /requireAdminCapability\(admin\.access, "verification:review"\)/);
  assert.match(actionRoute, /"verification:decide"/);
  assert.match(actionRoute, /"verification:review"/);
  assert.match(actionRoute, /Decision notes are required before changing a probate case/);
  assert.match(actionRoute, /recordAdminAuditEvent/);
  assert.match(evidenceRoute, /requireAdminCapability\(admin\.access, "verification:read"\)/);
  assert.match(evidenceRoute, /requireAdminCapability\(admin\.access, "verification:review"\)/);
  assert.match(evidenceRoute, /recordAdminAuditEvent/);
  assert.match(signedRoute, /requireAdminCapability\(admin\.access, "verification:review"\)/);
  assert.match(signedRoute, /createProbateEvidenceSignedUrl/);
  assert.match(signedRoute, /recordAdminAuditEvent/);
});

test("Phase 2B service creates case-scoped grants and safe signed evidence access", () => {
  const service = fs.readFileSync(path.join(root, "lib/admin/probateCases.ts"), "utf8");

  assert.match(service, /export async function loadProbateCases/);
  assert.match(service, /export async function submitProbateCaseFromVerification/);
  assert.match(service, /export async function applyProbateCaseAction/);
  assert.match(service, /export async function addProbateCaseEvidence/);
  assert.match(service, /export async function createProbateEvidenceSignedUrl/);
  assert.match(service, /permissions_override:[\s\S]*scope: "probate_case"[\s\S]*read_only: true[\s\S]*no_billing: true[\s\S]*no_owner_settings: true/);
  assert.match(service, /createSignedUrl\(evidence\.storage_path, expiresInSeconds\)/);
  assert.doesNotMatch(service, /publicUrl|getPublicUrl/);
});

test("Phase 2B probate state machine blocks duplicate terminal decisions", () => {
  assert.deepEqual(getAllowedProbateCaseActions("submitted"), ["request_information", "review", "approve", "reject"]);
  assert.deepEqual(getAllowedProbateCaseActions("needs_information"), ["request_information", "review", "approve", "reject"]);
  assert.deepEqual(getAllowedProbateCaseActions("under_review"), ["request_information", "review", "approve", "reject"]);
  assert.deepEqual(getAllowedProbateCaseActions("approved"), ["revoke"]);
  assert.deepEqual(getAllowedProbateCaseActions("rejected"), []);
  assert.equal(isTerminalProbateCaseStatus("approved"), true);
  assert.equal(isTerminalProbateCaseStatus("rejected"), true);
  assert.equal(isTerminalProbateCaseStatus("submitted"), false);

  assert.doesNotThrow(() => assertProbateCaseTransitionAllowed("submitted", "reject"));
  assert.throws(
    () => assertProbateCaseTransitionAllowed("rejected", "reject"),
    (error) => error instanceof ProbateCaseTransitionError
      && error.status === 409
      && error.code === "terminal_probate_case",
  );
  assert.throws(
    () => assertProbateCaseTransitionAllowed("rejected", "approve"),
    (error) => error instanceof ProbateCaseTransitionError
      && error.status === 409
      && error.code === "terminal_probate_case",
  );
  assert.throws(
    () => assertProbateCaseTransitionAllowed("approved", "reject"),
    (error) => error instanceof ProbateCaseTransitionError
      && error.status === 409
      && error.code === "terminal_probate_case",
  );
});

test("Phase 2B workspace exposes live cases without adding prototype-only controls", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminOpsWorkspace.tsx"), "utf8");

  assert.match(workspace, /Probate and executor cases/);
  assert.match(workspace, /Decision notes required/);
  assert.match(workspace, /Approve limited access/);
  assert.match(workspace, /Revoke access/);
  assert.match(workspace, /Upload evidence/);
  assert.match(workspace, /getAllowedProbateActions/);
  assert.match(workspace, /Terminal status/);
  assert.match(workspace, /\/api\/internal\/admin\/probate-cases/);
  assert.doesNotMatch(workspace, /Static mock data|Prototype session/);
});

test("canonical probate detail opens evidence through signed links and shows case history", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminControlPlaneWorkspace.tsx"), "utf8");

  assert.match(workspace, /Evidence review/);
  assert.match(workspace, /Open evidence/);
  assert.match(workspace, /openProbateEvidence/);
  assert.match(workspace, /\/api\/internal\/admin\/probate-cases\/\$\{encodeURIComponent\(caseId\)\}\/evidence\/\$\{encodeURIComponent\(evidenceId\)\}\/signed-url/);
  assert.match(workspace, /Case history/);
  assert.match(workspace, /buildProbateHistory/);
  assert.match(workspace, /Terminal state/);
  assert.match(workspace, /Revoke access/);
  assert.match(workspace, /Evidence opened with a short-lived case-scoped link and audit recorded/);
  assert.doesNotMatch(workspace, /publicUrl|getPublicUrl|window\.location\.href = json\.signedUrl/);
});

test("access administration reuses the canonical probate case queue", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminControlPlaneWorkspace.tsx"), "utf8");

  assert.match(workspace, /section === "access" \|\| section === "probate"/);
  assert.match(workspace, /section === "access" \? "Access and estate cases"/);
  assert.match(workspace, /Identity, authority, evidence, quorum, estate state, and access remain separate decisions/);
  assert.doesNotMatch(workspace, /section === "support" \|\| section === "invitations" \|\| section === "access" \? renderSupport/);
});

test("Phase 2B action route returns stable conflict response for invalid transitions", () => {
  const actionRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/probate-cases/[caseId]/actions/route.ts"), "utf8");

  assert.match(actionRoute, /ProbateCaseTransitionError/);
  assert.match(actionRoute, /code: error\.code/);
  assert.match(actionRoute, /status: error\.status/);
});
