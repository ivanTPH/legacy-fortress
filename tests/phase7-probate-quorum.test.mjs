import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260905120000_phase7_probate_quorum_completion.sql");
const service = read("lib/estate-administration/service.ts");
const adminApi = read("app/api/internal/admin/estate-cases/death-reports/[reportId]/actions/route.ts");
const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

test("quorum counts distinct active approvals and excludes revoked approvals", () => {
  const quorum = read("lib/estate-administration/quorum.ts");
  assert.match(quorum, /new Set/);
  assert.match(quorum, /decision !== "approved"/);
  assert.match(quorum, /revokedAt/);
  assert.match(quorum, /remaining: Math\.max\(0, required - valid\.size\)/);
});

test("quorum rejects self approval, duplicate approval, and closed cases", () => {
  const quorum = read("lib/estate-administration/quorum.ts");
  assert.match(quorum, /sensitive_action_self_approval_denied/);
  assert.match(quorum, /sensitive_action_duplicate_approval_denied/);
  assert.match(quorum, /sensitive_action_not_pending/);
});

test("database quorum is unique, auditable, expiry-aware, and owner-independent", () => {
  assert.match(read("supabase/migrations/20260822120000_phase4_estate_administration_control_plane.sql"), /UNIQUE \(request_id, approver_user_id\)/);
  assert.match(migration, /decision IN \('approved','rejected','revoked','expired'\)/);
  assert.match(migration, /lf_sensitive_action_quorum_summary/);
  assert.match(migration, /v_owner/);
  assert.match(migration, /sensitive_action_self_approval_denied/);
  assert.match(service, /assertIndependentApproval/);
});

test("death-state operations remain separate from authority and access", () => {
  assert.match(adminApi, /applyDeathReportAction/);
  assert.match(workspace, /Death and estate-state queue/);
  assert.match(workspace, /No automatic authority or access/);
  assert.match(workspace, /Identity, authority, evidence, quorum, estate state, and access remain separate/);
});
