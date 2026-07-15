import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

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

test("Phase 2B workspace exposes live cases without adding prototype-only controls", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminOpsWorkspace.tsx"), "utf8");

  assert.match(workspace, /Probate and executor cases/);
  assert.match(workspace, /Decision notes required/);
  assert.match(workspace, /Approve limited access/);
  assert.match(workspace, /Revoke access/);
  assert.match(workspace, /Upload evidence/);
  assert.match(workspace, /\/api\/internal\/admin\/probate-cases/);
  assert.doesNotMatch(workspace, /Static mock data|Prototype session/);
});
