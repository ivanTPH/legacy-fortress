#!/usr/bin/env node

/* Staging-only hosted acceptance. Fixture writes are limited to synthetic setup and cleanup. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPROVED_BASE_URL = "https://test.mylegacyfortress.com";
const APPROVED_SUPABASE_URL = "https://supabase-test.mylegacyfortress.com";
const EXPECTED_SHA = process.env.EXPECTED_STAGING_SHA ?? "";

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function redactId(value) {
  const text = String(value ?? "");
  return text ? `${text.slice(0, 8)}…` : "missing";
}

function safeError(error) {
  const source = error && typeof error === "object" ? error : { message: String(error ?? "error") };
  const fields = ["code", "message", "details", "hint"]
    .map((field) => [field, source[field]])
    .filter(([, value]) => value != null && String(value).trim() !== "");
  const text = fields.length ? fields.map(([field, value]) => `${field}=${String(value)}`).join("; ") : "database_error";
  return text
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+/g, "[email]")
    .replace(/(token|secret|password|api[_-]?key|authorization)\s*[=:]\s*[^;\s]+/gi, "$1=[redacted]")
    .slice(0, 600);
}

function assertStagingUrl(name, value, expected) {
  if (value !== expected) throw new Error(`${name}_must_equal_approved_staging_target`);
  const lower = value.toLowerCase();
  if (/(production|prod|live|\.supabase\.co)/i.test(lower)) throw new Error(`${name}_looks_production`);
}

async function proveEnvironment() {
  if (process.env.LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE !== "true") throw new Error("staging_acceptance_not_authorised");
  if (process.env.APP_ENV !== "staging" || process.env.LEGACY_FORTRESS_ENV !== "staging") throw new Error("staging_environment_marker_missing");
  const baseUrl = required("BASE_URL").replace(/\/$/, "");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  assertStagingUrl("BASE_URL", baseUrl, APPROVED_BASE_URL);
  assertStagingUrl("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl, APPROVED_SUPABASE_URL);
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  if (!EXPECTED_SHA) throw new Error("missing_EXPECTED_STAGING_SHA");
  const versionResponse = await fetch(`${baseUrl}/api/version`, { cache: "no-store" });
  if (!versionResponse.ok) throw new Error(`staging_version_unreachable_${versionResponse.status}`);
  const version = await versionResponse.json();
  if (version.env !== "staging") throw new Error("staging_version_environment_mismatch");
  if (version.commitSha !== EXPECTED_SHA) throw new Error("staging_version_sha_mismatch");
  return { baseUrl, supabaseUrl, anonKey, serviceRoleKey, version };
}

function makeClient(url, key) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function createUser(admin, email, password, marker) {
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: marker, synthetic_run_marker: marker },
  });
  if (result.error || !result.data.user) throw result.error ?? new Error("synthetic_user_create_failed");
  return { id: result.data.user.id, email, password };
}

async function signIn(config, person) {
  const client = makeClient(config.supabaseUrl, config.anonKey);
  const result = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  if (result.error || !result.data.session) throw result.error ?? new Error("synthetic_sign_in_failed");
  return { client, user: result.data.user, token: result.data.session.access_token };
}

async function checkedInsert(query, label) {
  const result = await query;
  if (result.error) throw new Error(`${label}_insert_failed:${safeError(result.error)}`);
  return result.data;
}

async function hostedJson(config, token, path, body, expectedStatus) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (expectedStatus && response.status !== expectedStatus) {
    throw new Error(`${path}_expected_${expectedStatus}_got_${response.status}:${safeError(payload.error)}`);
  }
  return { response, payload };
}

async function expectedDenied(config, token, path, body, label) {
  const result = await hostedJson(config, token, path, body);
  if (result.response.ok) throw new Error(`${label}_unexpectedly_allowed`);
  return { label, status: result.response.status };
}

async function readSingle(admin, table, columns, idColumn, id) {
  const result = await admin.from(table).select(columns).eq(idColumn, id).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

const created = { users: [], contacts: [], invitations: [], requests: [], grants: [] };
let admin;
let config;
let recipientToken = "";

async function cleanup() {
  if (!admin) return [];
  const failures = [];
  for (const requestId of created.requests) {
    if (!recipientToken) continue;
    const response = await fetch(`${config.baseUrl}/api/identity-verification/${requestId}/cleanup`, {
      method: "POST",
      headers: { authorization: `Bearer ${recipientToken}` },
    });
    if (!response.ok) failures.push(`evidence_cleanup:${redactId(requestId)}`);
  }
  for (const grantId of created.grants) {
    const result = await admin.from("account_access_grants").update({ activation_status: "revoked", updated_at: new Date().toISOString() }).eq("id", grantId);
    if (result.error) failures.push(`grant:${redactId(grantId)}`);
  }
  for (const invitationId of created.invitations) {
    const result = await admin.from("role_assignments").update({ activation_status: "revoked", updated_at: new Date().toISOString() }).eq("invitation_id", invitationId);
    if (result.error) failures.push(`role:${redactId(invitationId)}`);
    const invitation = await admin.from("contact_invitations").update({ invitation_status: "revoked", activation_status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invitationId);
    if (invitation.error) failures.push(`invitation:${redactId(invitationId)}`);
  }
  return failures;
}

async function main() {
  config = await proveEnvironment();
  admin = makeClient(config.supabaseUrl, config.serviceRoleKey);
  const run = `phase3b-idv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const password = `Synthetic-${crypto.randomUUID()}-Only!`;
  const owner = await createUser(admin, `${run}-owner@example.test`, password, `${run}-owner`);
  const recipient = await createUser(admin, `${run}-recipient@example.test`, password, `${run}-recipient`);
  const attacker = await createUser(admin, `${run}-attacker@example.test`, password, `${run}-attacker`);
  created.users.push(owner.id, recipient.id, attacker.id);
  const recipientSession = await signIn(config, recipient);
  recipientToken = recipientSession.token;
  const attackerSession = await signIn(config, attacker);

  const now = new Date().toISOString();
  const contact = await checkedInsert(admin.from("contacts").insert({
    owner_user_id: owner.id,
    user_id: owner.id,
    full_name: `${run} recipient`,
    email: recipient.email,
    email_normalized: recipient.email,
    contact_role: "executor",
    invite_status: "invite_sent",
    verification_status: "not_verified",
    source_type: "invitation",
    linked_context: [],
    created_at: now,
    updated_at: now,
  }).select("id").single(), "contact");
  created.contacts.push(contact.id);

  const token = crypto.randomUUID().replaceAll("-", "");
  const invitation = await checkedInsert(admin.from("contact_invitations").insert({
    owner_user_id: owner.id,
    contact_id: contact.id,
    contact_name: `${run} recipient`,
    contact_email: recipient.email,
    assigned_role: "executor",
    invitation_status: "pending",
    invite_token_hash: crypto.createHash("sha256").update(token).digest("hex"),
    invited_at: now,
    sent_at: now,
    last_sent_at: now,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    permissions_override: { allowed_sections: ["property"], asset_ids: [] },
    updated_at: now,
  }).select("id").single(), "invitation");
  created.invitations.push(invitation.id);

  const accepted = await recipientSession.client.rpc("accept_contact_invitation", { p_invitation_id: invitation.id, p_token: token });
  if (accepted.error || !accepted.data?.[0]?.grant_id) throw accepted.error ?? new Error("invitation_acceptance_failed");
  const grantId = accepted.data[0].grant_id;
  created.grants.push(grantId);
  const initialGrant = await readSingle(admin, "account_access_grants", "id,linked_user_id,invitation_id,activation_status,required_identity_level", "id", grantId);
  assert.equal(initialGrant.linked_user_id, recipient.id);
  assert.equal(initialGrant.invitation_id, invitation.id);
  assert.equal(initialGrant.activation_status, "pending_verification");

  const missingConsent = await expectedDenied(config, recipientSession.token, "/api/identity-verification", { purpose: "linked_access", requestedIdentityLevel: 2, invitationId: invitation.id, accessGrantId: grantId, consentAcknowledged: false }, "missing_consent");
  const premature = { label: "premature_access", status: initialGrant.activation_status === "pending_verification" ? "denied_by_server_state" : "unexpected_active_state" };
  const wrongUser = await expectedDenied(config, attackerSession.token, "/api/identity-verification", { purpose: "linked_access", requestedIdentityLevel: 2, invitationId: invitation.id, accessGrantId: grantId, consentAcknowledged: true }, "cross_user_context");
  const wrongContext = await expectedDenied(config, recipientSession.token, "/api/identity-verification", { purpose: "linked_access", requestedIdentityLevel: 2, invitationId: invitation.id, accessGrantId: crypto.randomUUID(), consentAcknowledged: true }, "wrong_invitation_context");

  const started = await hostedJson(config, recipientSession.token, "/api/identity-verification", { purpose: "linked_access", requestedIdentityLevel: 2, invitationId: invitation.id, accessGrantId: grantId, simulatorScenario: "success", consentAcknowledged: true }, 201);
  const requestId = started.payload.verification?.id;
  if (!requestId) throw new Error("verification_request_id_missing");
  created.requests.push(requestId);
  const requestRow = await readSingle(admin, "identity_verification_requests", "id,user_id,related_invitation_id,related_access_grant_id,status,metadata", "id", requestId);
  assert.equal(requestRow.user_id, recipient.id);
  assert.equal(requestRow.related_invitation_id, invitation.id);
  assert.equal(requestRow.related_access_grant_id, grantId);
  assert.ok(requestRow.metadata?.consent_accepted_at);

  const wrongRequestOwner = await expectedDenied(config, attackerSession.token, `/api/identity-verification/${requestId}/document`, { synthetic: true, documentType: "passport" }, "wrong_request_owner");
  await hostedJson(config, recipientSession.token, `/api/identity-verification/${requestId}/document`, { synthetic: true, documentType: "passport" }, 200);
  const challenge = await hostedJson(config, recipientSession.token, `/api/identity-verification/${requestId}/challenge`, {}, 200);
  const challengeId = challenge.payload.challenge?.id;
  if (!challengeId) throw new Error("presence_challenge_id_missing");
  await hostedJson(config, recipientSession.token, `/api/identity-verification/${requestId}/camera`, { synthetic: true, challengeId }, 200);
  const replay = await expectedDenied(config, recipientSession.token, `/api/identity-verification/${requestId}/camera`, { synthetic: true, challengeId }, "challenge_replay");
  const completed = await hostedJson(config, recipientSession.token, `/api/identity-verification/${requestId}/complete`, {}, 200);
  assert.equal(completed.payload.decision?.status, "verified");
  const finalGrant = await readSingle(admin, "account_access_grants", "id,activation_status,linked_user_id,invitation_id", "id", grantId);
  assert.ok(["verified", "active"].includes(finalGrant.activation_status));
  const finalInvitation = await readSingle(admin, "contact_invitations", "id,invitation_status,activation_status,accepted_user_id", "id", invitation.id);
  assert.equal(finalInvitation.accepted_user_id, recipient.id);
  const assurance = await readSingle(admin, "identity_assurance_states", "user_id,identity_level,presence_reverified_at", "user_id", recipient.id);
  assert.ok(Number(assurance?.identity_level) >= 2);
  const decision = await readSingle(admin, "identity_verification_decisions", "request_id,decision,requested_identity_level,achieved_identity_level", "request_id", requestId);
  assert.equal(decision?.decision, "verified");
  assert.ok(Number(decision?.achieved_identity_level) >= 2);
  const events = await admin.from("identity_verification_events").select("event_type").eq("request_id", requestId);
  if (events.error) throw events.error;
  assert.ok((events.data ?? []).length > 0);

  const failedStart = await hostedJson(config, recipientSession.token, "/api/identity-verification", { purpose: "linked_access", requestedIdentityLevel: 2, invitationId: invitation.id, accessGrantId: grantId, simulatorScenario: "document-failed", consentAcknowledged: true }, 201);
  const failedRequestId = failedStart.payload.verification?.id;
  if (!failedRequestId) throw new Error("failed_verification_request_id_missing");
  created.requests.push(failedRequestId);
  await hostedJson(config, recipientSession.token, `/api/identity-verification/${failedRequestId}/document`, { synthetic: true, documentType: "passport" }, 200);
  const failedComplete = await hostedJson(config, recipientSession.token, `/api/identity-verification/${failedRequestId}/complete`, {}, 200);
  assert.equal(failedComplete.payload.decision?.status, "failed");
  const grantAfterFailure = await readSingle(admin, "account_access_grants", "activation_status", "id", grantId);
  assert.ok(["verified", "active"].includes(grantAfterFailure.activation_status));

  const staleUpdate = await admin.from("identity_assurance_states").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("user_id", recipient.id);
  if (staleUpdate.error) throw staleUpdate.error;
  const stalePresence = await expectedDenied(config, recipientSession.token, "/api/identity-verification/step-up", { action: "security_control_change", consentAcknowledged: true }, "stale_level_3_presence");

  console.log(JSON.stringify({
    hosted: true,
    sha: config.version.commitSha,
    environment: config.version.env,
    successfulJourney: { invitation: "accepted", consent: "recorded", document: "synthetic_provider", challenge: "consumed_once", decision: "verified", grant: finalGrant.activation_status, assurance: assurance.identity_level },
    negative: { missingConsent, premature, wrongUser, wrongContext, wrongRequestOwner, replay, failedVerification: "denied_without_grant_demotion", stalePresence, callbackReplay: "not_applicable_internal_provider_has_no_callback_event" },
    redactedIds: { owner: redactId(owner.id), recipient: redactId(recipient.id), invitation: redactId(invitation.id), request: redactId(requestId), grant: redactId(grantId) },
  }));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ hosted: false, error: safeError(error) }));
  process.exitCode = 1;
} finally {
  const failures = await cleanup();
  if (failures.length) {
    console.error(JSON.stringify({ cleanup: "FAILED", failures }));
    process.exitCode = 1;
  } else if (admin) {
    console.error(JSON.stringify({
      cleanup: "synthetic_fixture_cleanup_complete",
      evidence: "cleaned",
      grants_and_invitations: "revoked",
      auth_users_and_contact_rows: "retained_for_audit_integrity",
      audit_history: "retained",
    }));
  }
}
