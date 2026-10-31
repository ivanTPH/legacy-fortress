import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the reviewer check never decides automatically and never gives access", () => {
  const provider = read("lib/identity-verification/inhouseReviewProvider.ts");
  assert.match(provider, /decision: usable \? "review_required" : "failed"/);
  assert.match(provider, /identityLevel: null/);
  assert.match(provider, /inhouse_review_level_2_only/);
  const ui = read("components/identity/ReviewerIdentityCheck.tsx");
  assert.match(ui, /Checking your ID doesn’t give you access to anything/);
});

test("only reviewer checks can be approved by hand, by a different person, with notes", () => {
  const service = read("lib/identity-verification/service.ts");
  const decide = service.slice(service.indexOf("export async function recordReviewerDecision"));
  assert.match(decide, /request\.provider_key !== INHOUSE_REVIEW_PROVIDER_KEY\) throw new Error\("identity_manual_decision_not_supported"\)/);
  assert.match(decide, /request\.status !== "review_required"/);
  assert.match(decide, /identity_self_review_not_permitted/);
  assert.match(decide, /cleanupExpiredIdentityEvidence/);
  const ops = read("lib/admin/operations.ts");
  assert.match(ops, /throw new Error\("identity_manual_decision_not_supported"\)/);
  const adminRoute = read("app/api/internal/admin/verifications/route.ts");
  assert.match(adminRoute, /identityRequest\.data\.provider_key === INHOUSE_REVIEW_PROVIDER_KEY/);
  assert.match(read("lib/identity-verification/inhouseReviewProvider.ts"), /INHOUSE_REVIEW_PROVIDER_KEY = "lf_inhouse_review_v1"/);
  const route = read("app/api/internal/admin/verifications/route.ts");
  assert.match(route, /Decision notes are required before approving or rejecting verification/);
});

test("reviewers see photos only through short-lived, audited links while a check is waiting", () => {
  const route = read("app/api/internal/admin/verifications/[requestId]/evidence/route.ts");
  assert.match(route, /verification:decide/);
  assert.match(route, /Identity evidence viewed/);
  // Audit records only whether photos existed, never the links.
  assert.match(route, /metadata: \{ document_present: Boolean\(links\.documentUrl\), selfie_present: Boolean\(links\.selfieUrl\), expires_in_seconds: links\.expiresInSeconds \}/);
  const service = read("lib/identity-verification/service.ts");
  assert.match(service, /const expiresInSeconds = 60;/);
  assert.match(service, /identity_evidence_not_reviewable/);
});

test("the email code is hashed, short-lived and limited", () => {
  const code = read("lib/identity-verification/presenceCode.ts");
  assert.match(code, /createHmac\("sha256"/);
  assert.match(code, /const CODE_MINUTES = 10;/);
  assert.match(code, /const MAX_ATTEMPTS = 5;/);
  assert.match(code, /timingSafeEqual/);
  assert.match(code, /presence_code_requires_verified_id/);
  assert.doesNotMatch(code, /presence_code: code|console\.log/);
});

test("every identity event the service writes is allowed by the database", () => {
  const service = read("lib/identity-verification/service.ts");
  const migrations = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  const definitions = migrations.map((name) => read(`supabase/migrations/${name}`)).join("\n");
  const lastCheck = definitions.lastIndexOf("CHECK (event_type IN (");
  assert.ok(lastCheck > 0, "event type constraint not found");
  const allowed = new Set([...definitions.slice(lastCheck, lastCheck + 4000).matchAll(/'([a-z_]+)'/g)].map((match) => match[1]));
  const used = [...service.matchAll(/recordIdentityEvent\([^;]*?"([a-z_]+)"(?: : "([a-z_]+)")?, "(?:user|admin|system|provider)"/g)].flatMap((match) => [match[1], match[2]]).filter(Boolean);
  assert.ok(used.length > 5);
  for (const name of used) assert.ok(allowed.has(name), `identity event not allowed by the database: ${name}`);
});

test("the identity queue stays bounded and looks rows up in small batches", () => {
  const ops = read("lib/admin/operations.ts");
  const queue = ops.slice(ops.indexOf('.from("identity_verification_requests")\n    .select("id,user_id,verification_purpose'));
  assert.match(queue, /\.limit\(200\)/);
  assert.match(queue, /index \+= 50/);
  assert.doesNotMatch(queue.slice(0, 3000), /\.in\("request_id", identityRequestIds\)/);
});
