#!/usr/bin/env node

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const STAGING_APP = "https://test.mylegacyfortress.com";
const STAGING_SUPABASE = "https://supabase-test.mylegacyfortress.com";
const KEEP_FIXTURE = process.env.KEEP_STAGING_ACCEPTANCE_FIXTURE === "true";
const marker = `phase7-quorum-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const ids = {
  users: [],
  adminRows: [],
  organisationId: null,
  walletId: null,
  recordId: null,
  deathReportId: null,
  estateCaseId: null,
  requestIds: [],
  approvalIds: [],
};

const results = [];
let activeAdmin = null;

function pass(name, details = {}) {
  results.push({ name, result: "PASS", ...details });
}

function fail(name, message, classification = "APPLICATION DEFECT") {
  results.push({ name, result: "FAIL", classification, message });
  throw new Error(`${name}: ${message}`);
}

function requireStaging() {
  const appEnv = process.env.APP_ENV;
  const legacyEnv = process.env.LEGACY_FORTRESS_ENV;
  const appUrl = process.env.BASE_URL || STAGING_APP;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || STAGING_SUPABASE;
  const target = `${appEnv} ${legacyEnv} ${appUrl} ${supabaseUrl}`;

  if (process.env.LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE !== "true") {
    throw new Error("Refusing to run: LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE=true is required.");
  }
  if (appEnv !== "staging" || legacyEnv !== "staging") {
    throw new Error("Refusing to run: APP_ENV and LEGACY_FORTRESS_ENV must both equal staging.");
  }
  if (appUrl !== STAGING_APP || supabaseUrl !== STAGING_SUPABASE) {
    throw new Error("Refusing to run: exact verified staging app and Supabase URLs are required.");
  }
  if (/production|(^|[^a-z])prod([^a-z]|$)|live|legacy-fortress\.vercel\.app|\.supabase\.co/i.test(target)) {
    throw new Error("Refusing to run: production-like target detected.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Refusing to run: staging Supabase credentials are missing.");
  }
  console.log(JSON.stringify({ environment: "staging", app: appUrl, supabase: supabaseUrl, marker }, null, 2));
  return { appUrl, supabaseUrl };
}

function clients(supabaseUrl) {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  return {
    admin: createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, options),
    anon: createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options),
  };
}

async function createUser(admin, label) {
  const email = `${marker}-${label}@example.test`;
  const password = `Phase7-${crypto.randomUUID()}-Aa9!`;
  const response = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Phase 7 Quorum ${label}` },
  });
  if (response.error || !response.data.user) throw response.error || new Error(`Could not create ${label}`);
  ids.users.push(response.data.user.id);
  return { id: response.data.user.id, email, password };
}

async function insertOrThrow(builder, label) {
  const response = await builder;
  if (response.error || !response.data) throw response.error || new Error(`${label} fixture failed`);
  return response.data;
}

async function addAdminRow(admin, user) {
  const row = await insertOrThrow(admin.from("admin_users").insert({
    email_normalized: user.email,
    user_id: user.id,
    display_name: `Phase 7 ${user.email}`,
    status: "active",
    is_master: false,
    role: "super_admin",
  }).select("id").single(), "admin row");
  ids.adminRows.push(row.id);
}

async function bearer(anon, user) {
  const response = await anon.auth.signInWithPassword({ email: user.email, password: user.password });
  if (response.error || !response.data.session) throw response.error || new Error(`Could not sign in ${user.email}`);
  return response.data.session.access_token;
}

async function api(appUrl, path, token, body) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function assertQuorum(admin, requestId, expected, label) {
  const summary = await admin.rpc("lf_sensitive_action_quorum_summary", { p_request_id: requestId });
  if (summary.error) throw summary.error;
  const value = summary.data;
  if (!value || value.required !== expected.required || value.approved !== expected.approved || value.remaining !== expected.remaining || Boolean(value.expired) !== Boolean(expected.expired)) {
    fail(label, `Unexpected quorum summary: ${JSON.stringify(value)}`);
  }
  pass(label, { summary: value });
  return value;
}

async function countApprovals(admin, requestId, approverId) {
  const response = await admin.from("sensitive_action_approvals").select("id,decision,revoked_at,revoked_by_user_id,revoked_reason").eq("request_id", requestId).eq("approver_user_id", approverId);
  if (response.error) throw response.error;
  return response.data || [];
}

async function cleanup(admin) {
  if (KEEP_FIXTURE) return "retained for inspection";
  for (const requestId of ids.requestIds) await admin.from("sensitive_action_approvals").delete().eq("request_id", requestId);
  if (ids.requestIds.length) await admin.from("sensitive_action_requests").delete().in("id", ids.requestIds);
  if (ids.estateCaseId) await admin.from("estate_participants").delete().eq("estate_case_id", ids.estateCaseId);
  if (ids.estateCaseId) await admin.from("estate_cases").delete().eq("id", ids.estateCaseId);
  if (ids.deathReportId) await admin.from("death_reports").delete().eq("id", ids.deathReportId);
  if (ids.recordId) await admin.from("records").delete().eq("id", ids.recordId);
  if (ids.walletId) await admin.from("wallets").delete().eq("id", ids.walletId);
  if (ids.organisationId) await admin.from("organisations").delete().eq("id", ids.organisationId);
  for (const id of ids.adminRows) await admin.from("admin_users").delete().eq("id", id);
  for (const id of ids.users) await admin.auth.admin.deleteUser(id);
  return "mutable fixtures removed; append-only audit history retained where policy permits";
}

async function main() {
  const { appUrl, supabaseUrl } = requireStaging();
  const { admin, anon } = clients(supabaseUrl);
  activeAdmin = admin;
  const owner = await createUser(admin, "owner");
  const requester = await createUser(admin, "requester");
  const approver1 = await createUser(admin, "approver1");
  const approver2 = await createUser(admin, "approver2");
  const platformAdmin = await createUser(admin, "platform-admin");
  await addAdminRow(admin, platformAdmin);

  const organisation = await insertOrThrow(admin.from("organisations").insert({ owner_user_id: owner.id, name: `${marker} organisation` }).select("id").single(), "organisation");
  ids.organisationId = organisation.id;
  const wallet = await insertOrThrow(admin.from("wallets").insert({ organisation_id: organisation.id, owner_user_id: owner.id, label: `${marker} wallet`, status: "active" }).select("id").single(), "wallet");
  ids.walletId = wallet.id;
  const record = await insertOrThrow(admin.from("records").insert({ owner_user_id: owner.id, section_key: "legal", category_key: "will", title: `${marker} historic record` }).select("id").single(), "historic record");
  ids.recordId = record.id;

  const death = await insertOrThrow(admin.from("death_reports").insert({
    owner_user_id: owner.id,
    claimant_user_id: requester.id,
    claimant_role: "executor",
    relationship: "executor",
    status: "submitted",
    declaration_accepted: true,
    claimant_identity_level: 1,
    vault_state_at_report: "OWNER_ACTIVE",
    metadata: { synthetic_run_marker: marker },
  }).select("id").single(), "death report");
  ids.deathReportId = death.id;
  const grantsBefore = await admin.from("account_access_grants").select("id").eq("owner_user_id", owner.id).eq("linked_user_id", requester.id);
  if (grantsBefore.error) throw grantsBefore.error;
  if (grantsBefore.data.length !== 0) fail("death report has no grant", "A grant was created by death-report insertion.");
  pass("death report has no authority or access grant");

  for (const state of ["DEATH_REPORTED", "PROTECTIVE_LOCK", "ESTATE_LOCKED"]) {
    const transition = await admin.rpc("lf_transition_vault_lifecycle", {
      p_owner_user_id: owner.id,
      p_to_state: state,
      p_actor_user_id: platformAdmin.id,
      p_reason: `${marker} ${state}`,
      p_death_report_id: death.id,
      p_context: { actor_type: "admin", synthetic_run_marker: marker },
    });
    if (transition.error || transition.data !== state) throw transition.error || new Error(`Could not reach ${state}`);
  }
  pass("death state progresses through OWNER_ACTIVE to ESTATE_LOCKED");
  const walletState = await admin.from("wallets").select("vault_lifecycle_state").eq("id", wallet.id).single();
  if (walletState.error || walletState.data.vault_lifecycle_state !== "ESTATE_LOCKED") throw walletState.error || new Error("Estate lock state mismatch");
  const ownerSession = await anon.auth.signInWithPassword({ email: owner.email, password: owner.password });
  const historicMutation = await ownerSession.data.session ? anon.from("records").update({ title: `${marker} should be denied` }).eq("id", record.id).select("id").maybeSingle() : { error: new Error("owner sign-in failed"), data: null };
  if (!historicMutation.error && historicMutation.data) fail("estate lock protects historic data", "Mutation unexpectedly succeeded.");
  pass("estate lock protects historic data");

  const estate = await insertOrThrow(admin.from("estate_cases").insert({ owner_user_id: owner.id, death_report_id: death.id, case_reference: `EST-${marker.slice(-12).toUpperCase()}`, status: "open", vault_state_at_open: "ESTATE_LOCKED", opened_by_user_id: requester.id, metadata: { synthetic_run_marker: marker } }).select("id").single(), "estate case");
  ids.estateCaseId = estate.id;
  for (const [user, role, permissions] of [[requester, "executor", ["request_sensitive_action"]], [approver1, "administrator", ["approve_sensitive_action"]], [approver2, "co_executor", ["approve_sensitive_action"]], [owner, "executor", []]]) {
    await insertOrThrow(admin.from("estate_participants").insert({ estate_case_id: estate.id, user_id: user.id, participant_role: role, status: "active", required_identity_level: 2, permissions, added_by_user_id: owner.id, metadata: { synthetic_run_marker: marker } }).select("id").single(), "estate participant");
    await insertOrThrow(admin.from("identity_assurance_states").upsert({ user_id: user.id, identity_level: 3, verified_at: new Date().toISOString(), presence_reverified_at: new Date().toISOString(), provider_key: "lf_internal_experimental_v1", metadata: { synthetic_run_marker: marker } }, { onConflict: "user_id" }).select("user_id").single(), "identity fixture");
  }

  const requesterToken = await bearer(anon, requester);
  const requestResult = await api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions`, requesterToken, { actionType: "distribution_approve", targetType: "estate_case", targetId: estate.id, justification: `${marker} controlled quorum request`, requiredApprovals: 2 });
  if (requestResult.response.status !== 201 || !requestResult.json.request?.id) throw new Error(`Request creation failed: ${JSON.stringify(requestResult.json)}`);
  const requestId = requestResult.json.request.id;
  ids.requestIds.push(requestId);
  pass("sensitive-action request created", { requestId, requiredApprovals: requestResult.json.request.required_approvals, requesterId: requester.id, ownerId: owner.id, expiresAtPresent: Boolean(requestResult.json.request.expires_at) });

  const approver1Token = await bearer(anon, approver1);
  const approver2Token = await bearer(anon, approver2);
  const approve1 = await api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions/${requestId}/approve`, approver1Token, { reason: `${marker} first approval` });
  if (approve1.response.status !== 200) throw new Error(`Approver 1 failed: ${JSON.stringify(approve1.json)}`);
  pass("first distinct eligible approver accepted");
  await assertQuorum(admin, requestId, { required: 2, approved: 1, remaining: 1, expired: false }, "first approval leaves one remaining");

  const approve2 = await api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions/${requestId}/approve`, approver2Token, { reason: `${marker} second approval` });
  if (approve2.response.status !== 200) throw new Error(`Approver 2 failed: ${JSON.stringify(approve2.json)}`);
  pass("second distinct eligible approver accepted");
  await assertQuorum(admin, requestId, { required: 2, approved: 2, remaining: 0, expired: false }, "second approval completes quorum");
  if (!approve2.json.result?.quorumMet) fail("quorum_met", "Application did not report quorum completion.");
  pass("quorum_met is true");

  const duplicate = await api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions/${requestId}/approve`, approver1Token, { reason: `${marker} duplicate approval` });
  if (duplicate.response.ok) fail("duplicate approval denied", "Duplicate approval unexpectedly succeeded.");
  if ((await countApprovals(admin, requestId, approver1.id)).length !== 1) fail("duplicate approval count", "Approver 1 has more than one row.");
  pass("duplicate approval is rejected without count inflation", { status: duplicate.response.status });

  const raceRequest = await insertOrThrow(admin.from("sensitive_action_requests").insert({ estate_case_id: estate.id, owner_user_id: owner.id, requester_user_id: requester.id, action_type: "race_test", target_type: "estate_case", target_id: estate.id, status: "pending_approval", justification: `${marker} concurrency`, required_approvals: 2, expires_at: new Date(Date.now() + 3600000).toISOString(), metadata: { synthetic_run_marker: marker } }).select("id").single(), "race request");
  ids.requestIds.push(raceRequest.id);
  const race = await Promise.all([api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions/${raceRequest.id}/approve`, approver1Token, { reason: `${marker} race A` }), api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions/${raceRequest.id}/approve`, approver1Token, { reason: `${marker} race B` })]);
  const raceRows = await countApprovals(admin, raceRequest.id, approver1.id);
  if (raceRows.length !== 1 || race.filter((item) => item.response.ok).length !== 1) fail("concurrent duplicate race", "Concurrent submissions did not resolve to exactly one persisted approval.");
  pass("concurrent duplicate race persists one approval");

  for (const [label, user, expected] of [["requester self-approval", requester, "requester"], ["owner self-approval", owner, "owner"]]) {
    const token = await bearer(anon, user);
    const attempt = await api(appUrl, `/api/estate/cases/${estate.id}/sensitive-actions/${requestId}/approve`, token, { reason: `${marker} ${expected} self approval` });
    if (attempt.response.ok) fail(label, "Self-approval unexpectedly succeeded.");
    pass(`${label} denied`, { status: attempt.response.status });
  }
  for (const [label, user] of [["requester self-approval trigger", requester], ["owner self-approval trigger", owner]]) {
    const triggerAttempt = await admin.from("sensitive_action_approvals").insert({ request_id: requestId, approver_user_id: user.id, decision: "approved", reason: `${marker} ${label}` });
    if (!triggerAttempt.error || !/self_approval_denied/i.test(triggerAttempt.error.message)) fail(label, "Database self-approval trigger did not reject the insert.");
    pass(`${label} denied by database trigger`);
  }

  const rejectRequest = await insertOrThrow(admin.from("sensitive_action_requests").insert({ estate_case_id: estate.id, owner_user_id: owner.id, requester_user_id: requester.id, action_type: "rejection_test", target_type: "estate_case", status: "pending_approval", justification: `${marker} rejection`, required_approvals: 2, expires_at: new Date(Date.now() + 3600000).toISOString(), metadata: { synthetic_run_marker: marker } }).select("id").single(), "rejection request");
  ids.requestIds.push(rejectRequest.id);
  const rejected = await insertOrThrow(admin.from("sensitive_action_approvals").insert({ request_id: rejectRequest.id, approver_user_id: approver1.id, decision: "rejected", reason: `${marker} rejected` }).select("id").single(), "rejected approval");
  ids.approvalIds.push(rejected.id);
  await assertQuorum(admin, rejectRequest.id, { required: 2, approved: 0, remaining: 2, expired: false }, "rejected approval excluded");

  const revokeRequest = await insertOrThrow(admin.from("sensitive_action_requests").insert({ estate_case_id: estate.id, owner_user_id: owner.id, requester_user_id: requester.id, action_type: "revocation_test", target_type: "estate_case", status: "pending_approval", justification: `${marker} revocation`, required_approvals: 2, expires_at: new Date(Date.now() + 3600000).toISOString(), metadata: { synthetic_run_marker: marker } }).select("id").single(), "revocation request");
  ids.requestIds.push(revokeRequest.id);
  const approvalToRevoke = await insertOrThrow(admin.from("sensitive_action_approvals").insert({ request_id: revokeRequest.id, approver_user_id: approver1.id, decision: "approved", reason: `${marker} revoke me` }).select("id").single(), "approval to revoke");
  ids.approvalIds.push(approvalToRevoke.id);
  await assertQuorum(admin, revokeRequest.id, { required: 2, approved: 1, remaining: 1, expired: false }, "revocation starts with one approval");
  const platformAdminToken = await bearer(anon, platformAdmin);
  const revoke = await api(appUrl, `/api/internal/admin/estate-cases/sensitive-actions/approvals/${approvalToRevoke.id}/revoke`, platformAdminToken, { reason: `${marker} revoke approval` });
  if (!revoke.response.ok) throw new Error(`Revocation failed: ${JSON.stringify(revoke.json)}`);
  const revoked = await admin.from("sensitive_action_approvals").select("decision,revoked_at,revoked_by_user_id,revoked_reason").eq("id", approvalToRevoke.id).single();
  if (revoked.error || revoked.data.decision !== "revoked" || !revoked.data.revoked_at || revoked.data.revoked_by_user_id !== approver2.id || !revoked.data.revoked_reason) throw revoked.error || new Error("Revocation metadata incomplete");
  await assertQuorum(admin, revokeRequest.id, { required: 2, approved: 0, remaining: 2, expired: false }, "revocation reduces quorum");
  pass("approval revocation is recorded and reduces quorum");

  const expiredRequest = await insertOrThrow(admin.from("sensitive_action_requests").insert({ estate_case_id: estate.id, owner_user_id: owner.id, requester_user_id: requester.id, action_type: "expiry_test", target_type: "estate_case", status: "pending_approval", justification: `${marker} expiry`, required_approvals: 2, expires_at: new Date(Date.now() - 3600000).toISOString(), metadata: { synthetic_run_marker: marker } }).select("id").single(), "expired request");
  ids.requestIds.push(expiredRequest.id);
  await insertOrThrow(admin.from("sensitive_action_approvals").insert({ request_id: expiredRequest.id, approver_user_id: approver1.id, decision: "approved", reason: `${marker} historical approval`, created_at: new Date(Date.now() - 7200000).toISOString() }).select("id").single(), "historical approval");
  await insertOrThrow(admin.from("sensitive_action_approvals").insert({ request_id: expiredRequest.id, approver_user_id: approver2.id, decision: "approved", reason: `${marker} historical approval 2`, created_at: new Date(Date.now() - 7200000).toISOString() }).select("id").single(), "historical approval 2");
  await assertQuorum(admin, expiredRequest.id, { required: 2, approved: 2, remaining: 0, expired: true }, "expired request reports expiry");
  const expiredMet = await admin.rpc("lf_sensitive_action_quorum_met", { p_request_id: expiredRequest.id });
  if (expiredMet.error || expiredMet.data !== false) fail("expired request cannot complete quorum", "Expired request returned quorum_met=true.");
  pass("expired request cannot execute despite historical approvals");

  const access = await admin.from("account_access_grants").select("id").eq("owner_user_id", owner.id).in("linked_user_id", [requester.id, approver1.id, approver2.id]);
  const claims = await admin.from("estate_access_claims").select("id,status,authority_evidence_status").eq("owner_user_id", owner.id);
  if (access.error || claims.error) throw access.error || claims.error;
  if (access.data.length || claims.data.length) fail("quorum does not grant access", "Synthetic quorum flow created an access/claim record unexpectedly.");
  pass("quorum completion remains separate from identity, authority, and access");

  const events = await admin.from("estate_security_actions").select("action_type,actor_user_id,actor_type").eq("owner_user_id", owner.id).eq("metadata->>synthetic_run_marker", marker);
  const deathEvents = await admin.from("death_report_events").select("event_type").eq("death_report_id", death.id);
  if (events.error || deathEvents.error) throw events.error || deathEvents.error;
  if (deathEvents.data.length < 3) fail("estate audit evidence", "Expected death-state audit events were not found.");
  if (events.data.some((event) => event.actor_user_id !== platformAdmin.id || event.actor_type !== "admin")) fail("audit actor integrity", "A lifecycle event actor did not match the authenticated administrative operation.");
  pass("estate/death audit events collected", { estateSecurityEvents: events.data.length, deathEvents: deathEvents.data.length });

  console.log(JSON.stringify({
    ok: true,
    marker,
    ids,
    results,
    cleanup: KEEP_FIXTURE ? "retained; inspect /admin/access and /admin/probate using the printed estateCaseId" : await cleanup(admin),
  }, null, 2));
}

main().catch(async (error) => {
  let cleanupStatus = "not attempted";
  if (activeAdmin) {
    try {
      cleanupStatus = await cleanup(activeAdmin);
    } catch (cleanupError) {
      cleanupStatus = `cleanup failed: ${String(cleanupError?.message || cleanupError)}`;
    }
  }
  console.error(JSON.stringify({ ok: false, marker, ids, results, error: String(error?.message || error), cleanup: cleanupStatus }, null, 2));
  process.exitCode = 1;
});
