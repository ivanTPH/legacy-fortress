import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync("components/admin/AdminControlPlaneWorkspace.tsx", "utf8");
const evidenceRoute = fs.readFileSync("app/api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url/route.ts", "utf8");

test("probate evidence uses dedicated loading state and clears it on failure", () => {
  assert.match(workspace, /useState\(""\).*probateEvidenceLoading|probateEvidenceLoading.*useState\(""\)/s);
  assert.match(workspace, /setProbateEvidenceLoading\(`\$\{caseId\}:\$\{evidenceId\}`\)/);
  assert.match(workspace, /finally \{[\s\S]*setProbateEvidenceLoading\(""\)/);
  assert.doesNotMatch(workspace, /setProbateEvidenceLoading\([^)]*probateActionLoading/);
});

test("probate evidence opens only through the signed, case-scoped endpoint", () => {
  assert.match(workspace, /encodeURIComponent\(caseId\)/);
  assert.match(workspace, /encodeURIComponent\(evidenceId\)/);
  assert.match(workspace, /signed-url/);
  assert.match(workspace, /short-lived case-scoped link/);
  assert.doesNotMatch(workspace, /document_path|rawProviderPayload|documentNumber/);
  assert.match(evidenceRoute, /signedUrl|createSignedUrl|createSignedURL/);
  assert.doesNotMatch(evidenceRoute, /service_role|raw_provider_payload|document_number/);
});
