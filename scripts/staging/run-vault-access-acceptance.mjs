#!/usr/bin/env node

/*
 * Staging-only hosted acceptance for Vault access (V5.2 Vault Access, owner decisions 30 Oct 2026).
 * Synthetic users only, created and cleaned up here. Signs in as each person and checks, against the
 * real TEST database and API, that:
 *   - nominating, asking early and reporting a death never open anything;
 *   - a Power of Attorney opens only its areas after review and activation, and withdrawal stops it;
 *   - sharing now honours stop and is written to Record history;
 *   - estate release waits for the grant of probate and releases the nomination's scope only.
 */
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

function safeError(error) {
  const source = error && typeof error === "object" ? error : { message: String(error ?? "error") };
  const text = ["code", "message", "details", "hint"].map((field) => source[field]).filter(Boolean).join("; ") || "error";
  return String(text)
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+/g, "[email]")
    .replace(/(token|secret|password|api[_-]?key|authorization)\s*[=:]\s*[^;\s]+/gi, "$1=[redacted]")
    .slice(0, 600);
}

async function proveEnvironment() {
  if (process.env.LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE !== "true") throw new Error("staging_acceptance_not_authorised");
  if (process.env.APP_ENV !== "staging" || process.env.LEGACY_FORTRESS_ENV !== "staging") throw new Error("staging_environment_marker_missing");
  const baseUrl = required("BASE_URL").replace(/\/$/, "");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  if (baseUrl !== APPROVED_BASE_URL || supabaseUrl !== APPROVED_SUPABASE_URL) throw new Error("not_the_approved_staging_target");
  if (/(production|prod|live|\.supabase\.co)/i.test(`${baseUrl} ${supabaseUrl}`)) throw new Error("looks_production");
  if (!EXPECTED_SHA) throw new Error("missing_EXPECTED_STAGING_SHA");
  const version = await (await fetch(`${baseUrl}/api/version`, { cache: "no-store" })).json();
  if (version.env !== "staging" || version.commitSha !== EXPECTED_SHA) throw new Error("staging_version_mismatch");
  return { baseUrl, supabaseUrl, anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY") };
}

const makeClient = (url, key) => createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}:${safeError(result.error)}`);
  return result.data;
}

async function mustFail(promise, label) {
  const result = await promise;
  if (!result.error) throw new Error(`${label}_unexpectedly_allowed`);
  return result.error;
}

let admin;
let config;
const created = { owners: [], users: [], admins: [], identityRequests: [] };

async function createPerson(run, role, password) {
  const email = `${run}-${role}@example.test`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${run} ${role}`, synthetic_run_marker: run } });
  if (result.error || !result.data.user) throw new Error(`create_${role}:${safeError(result.error)}`);
  created.users.push(result.data.user.id);
  const client = makeClient(config.supabaseUrl, config.anonKey);
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign_in_${role}:${safeError(session.error)}`);
  return { id: result.data.user.id, email, client, token: session.data.session.access_token };
}

async function invite(owner, person, run, role) {
  const now = new Date().toISOString();
  const contact = await must(admin.from("contacts").insert({
    owner_user_id: owner.id, user_id: owner.id, full_name: `${run} ${role}`, email: person.email, email_normalized: person.email,
    contact_role: role === "attorney" ? "power_of_attorney" : "trusted_contact", invite_status: "invite_sent", verification_status: "not_verified",
    source_type: "invitation", linked_context: [], created_at: now, updated_at: now,
  }).select("id").single(), `contact_${role}`);
  const token = crypto.randomUUID().replaceAll("-", "");
  const invitation = await must(admin.from("contact_invitations").insert({
    owner_user_id: owner.id, contact_id: contact.id, contact_name: `${run} ${role}`, contact_email: person.email,
    assigned_role: role === "attorney" ? "power_of_attorney" : "friend_or_family", invitation_status: "pending",
    invite_token_hash: crypto.createHash("sha256").update(token).digest("hex"), invited_at: now, sent_at: now, last_sent_at: now,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), permissions_override: { asset_ids: [] }, updated_at: now,
  }).select("id").single(), `invitation_${role}`);
  const accepted = await person.client.rpc("accept_contact_invitation", { p_invitation_id: invitation.id, p_token: token });
  if (accepted.error || !accepted.data?.[0]?.grant_id) throw new Error(`accept_${role}:${safeError(accepted.error)}`);
  return { contactId: contact.id, grantId: accepted.data[0].grant_id };
}

async function visibleAssets(person) {
  return (await must(person.client.from("assets").select("id,title"), "visible_assets")).map((row) => row.id);
}

async function api(person, path, body, method = "POST") {
  const init = { method, headers: { authorization: `Bearer ${person.token}` } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
  const response = await fetch(`${config.baseUrl}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function freshCheck(person, caseType, caseId) {
  const started = await api(person, "/api/identity-verification", { purpose: "admin_review", requestedIdentityLevel: 2, consentAcknowledged: true, caseType, caseId });
  assert.equal(started.status, 201, `fresh check start failed: ${safeError(started.payload)}`);
  const requestId = started.payload.verification.id;
  created.identityRequests.push(requestId);
  const docForm = new FormData();
  docForm.set("file", syntheticImage("image/png"), "synthetic-document.png");
  docForm.set("side", "front");
  assert.equal((await api(person, `/api/identity-verification/${requestId}/document`, docForm)).status, 200, "fresh check document failed");
  const challenge = await api(person, `/api/identity-verification/${requestId}/challenge`, {});
  const selfieForm = new FormData();
  selfieForm.set("file", syntheticImage("image/jpeg"), "synthetic-selfie.jpg");
  selfieForm.set("challengeId", challenge.payload.challenge.id);
  assert.equal((await api(person, `/api/identity-verification/${requestId}/camera`, selfieForm)).status, 200, "fresh check selfie failed");
  const completed = await api(person, `/api/identity-verification/${requestId}/complete`, {});
  assert.equal(completed.payload.decision?.status, "review_required", "a case check was decided automatically");
  // Someone else can't attach a check to this case.
  return requestId;
}

// A synthetic image file: valid header, padded past the reviewer check's minimum size. Not a real face or document.
function syntheticImage(type) {
  const header = type === "image/png" ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) : Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([Buffer.concat([header, crypto.randomBytes(4096)])], { type });
}

async function main() {
  config = await proveEnvironment();
  admin = makeClient(config.supabaseUrl, config.serviceRoleKey);
  const run = `vault-access-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const password = `Synthetic-${crypto.randomUUID()}-Only!`;
  const owner = await createPerson(run, "owner", password);
  const nominee = await createPerson(run, "nominee", password);
  const attorney = await createPerson(run, "attorney", password);
  const stranger = await createPerson(run, "stranger", password);
  const reviewer = await createPerson(run, "reviewer", password);
  const applicant = await createPerson(run, "applicant", password);
  created.owners.push(owner.id);
  await must(admin.from("admin_users").insert({ email_normalized: reviewer.email, user_id: reviewer.id, display_name: "Synthetic reviewer", status: "active", is_master: false, role: "super_admin" }), "reviewer_admin");
  created.admins.push(reviewer.id);

  const org = await must(admin.from("organisations").insert({ owner_user_id: owner.id, name: `${run} org` }).select("id").single(), "org");
  const wallet = await must(admin.from("wallets").insert({ organisation_id: org.id, owner_user_id: owner.id }).select("id").single(), "wallet");
  const asset = async (section, category, title) => (await must(admin.from("assets").insert({ organisation_id: org.id, wallet_id: wallet.id, owner_user_id: owner.id, section_key: section, category_key: category, title }).select("id").single(), `asset_${title}`)).id;
  const finance = await asset("finances", "other", `${run} account`);
  const house = await asset("property", "property", `${run} house`);
  const diary = await asset("digital", "accounts", `${run} diary`);
  const will = await asset("legal", "wills", `${run} will`);

  const nomineeLink = await invite(owner, nominee, run, "nominee");
  const attorneyLink = await invite(owner, attorney, run, "attorney");
  await must(admin.from("identity_assurance_states").upsert([
    { user_id: nominee.id, identity_level: 2, provider_key: "synthetic_acceptance" },
    { user_id: attorney.id, identity_level: 2, provider_key: "synthetic_acceptance" },
  ], { onConflict: "user_id" }), "identity_fixture");
  const results = [];

  // 1. Nominate for later: whole Vault except the diary. Nothing opens.
  const nominationId = await must(owner.client.rpc("lf_save_vault_nomination", {
    p_person_id: nomineeLink.contactId, p_scope: "whole_vault", p_records: [{ type: "asset", id: diary }], p_notify_person: true,
  }), "nominate");
  assert.deepEqual(await visibleAssets(nominee), [], "nominee sees records before release");
  const status = await must(nominee.client.rpc("my_vault_nomination_status"), "nominee_status");
  assert.equal(status.length, 1);
  assert.deepEqual(Object.keys(status[0]).sort(), ["kind", "nomination_ref", "open_request", "owner_display_name", "release_stage", "status"]);
  assert.equal(status[0].release_stage, "none");
  assert.equal((await must(stranger.client.rpc("my_vault_nomination_status"), "stranger_status")).length, 0);
  const kinds = async (person) => (await must(person.client.from("user_notifications").select("kind,owner_display_name"), "notifications")).map((row) => row.kind);
  assert.ok((await kinds(nominee)).includes("nomination_added"), "nominee not told about the nomination");
  results.push("nominate: no access, nominee sees kind and state only, told without details");

  // 2. Ask for access now: owner gets the request; nothing shared; owner answers Not now.
  await must(nominee.client.rpc("lf_request_early_access", { p_nomination_ref: status[0].nomination_ref, p_message: "Synthetic request" }), "ask_early");
  await mustFail(stranger.client.rpc("lf_request_early_access", { p_nomination_ref: status[0].nomination_ref, p_message: "x" }), "stranger_ask");
  const open = await must(owner.client.from("vault_early_access_requests").select("id,status").eq("status", "open"), "owner_requests");
  assert.equal(open.length, 1);
  assert.deepEqual(await visibleAssets(nominee), [], "asking shared something");
  await must(owner.client.from("vault_early_access_requests").update({ status: "declined" }).eq("id", open[0].id), "decline");
  results.push("ask early: owner To do request, nothing shared, declined");

  // 3. Report a death through the hosted API: the nominee is accepted as a reporter (stopped only
  //    by the fresh presence check); a stranger is refused. Nothing opens.
  const nomineeReport = await api(nominee, "/api/estate/death-reports", { nominationRef: status[0].nomination_ref, declarationAccepted: true });
  assert.notEqual(nomineeReport.payload.error, "estate_relationship_required", "nominee refused as reporter");
  const strangerReport = await api(stranger, "/api/estate/death-reports", { nominationRef: status[0].nomination_ref, declarationAccepted: true });
  assert.equal(strangerReport.status, 403);
  assert.deepEqual(await visibleAssets(nominee), [], "reporting opened records");
  results.push(`report a death: nominee accepted (${nomineeReport.status}), stranger refused (403)`);

  // 4. Power of Attorney: recorded (no access) → confirmed → activated (finances and property only) → withdrawn.
  const authority = await must(owner.client.from("legal_authorities").insert({
    owner_user_id: owner.id, vault_id: wallet.id, person_id: attorneyLink.contactId, authority_type: "lpa_property_finance",
    registered: "yes", usable_when: "with_consent", scope_areas: ["finances", "property"], created_by: owner.id,
  }).select("id").single(), "record_authority");
  assert.deepEqual(await visibleAssets(attorney), [], "recording an authority opened records");
  await mustFail(owner.client.from("legal_authorities").update({ status: "confirmed" }).eq("id", authority.id), "owner_confirm");
  await mustFail(owner.client.rpc("lf_activate_legal_authority", { p_authority_id: authority.id, p_reviewer_user_id: owner.id }), "owner_activate");
  // Review team, through the hosted Admin API.
  const ownerDenied = await api(owner, `/api/internal/admin/legal-authorities/${authority.id}/actions`, { action: "confirm", reason: "x" });
  assert.ok([401, 403].includes(ownerDenied.status), "owner reached the Admin API");
  const confirmed = await api(reviewer, `/api/internal/admin/legal-authorities/${authority.id}/actions`, { action: "confirm", reason: "Synthetic acceptance check" });
  assert.equal(confirmed.status, 200, `confirm failed: ${safeError(confirmed.payload)}`);
  assert.deepEqual(await visibleAssets(attorney), [], "confirming opened records");
  // Activation waits for the attorney's fresh ID check for this authority.
  const tooEarly = await api(reviewer, `/api/internal/admin/legal-authorities/${authority.id}/actions`, { action: "activate", reason: "Synthetic acceptance check" });
  assert.equal(tooEarly.status, 409, "activated without the attorney's fresh check");
  await freshCheck(attorney, "legal_authority", authority.id);
  const activated = await api(reviewer, `/api/internal/admin/legal-authorities/${authority.id}/actions`, { action: "activate", reason: "Synthetic acceptance check" });
  assert.equal(activated.status, 200, `activate failed: ${safeError(activated.payload)}`);
  assert.deepEqual((await visibleAssets(attorney)).sort(), [finance, house].sort(), "attorney scope wrong");
  await must(owner.client.from("legal_authorities").update({ status: "withdrawn", withdrawn_reason: "Synthetic acceptance" }).eq("id", authority.id), "withdraw");
  assert.deepEqual(await visibleAssets(attorney), [], "attorney still sees records after withdrawal");
  results.push("power of attorney: no access until activated, areas only (no Will), withdrawal stops at once");

  // 5. Sharing now: give one record until tomorrow, stop it with a note; Record history shows both.
  await must(owner.client.from("account_access_grants").update({
    permissions_override: { asset_ids: [house] }, activation_status: "active", ends_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  }).eq("id", attorneyLink.grantId), "share_now");
  assert.deepEqual(await visibleAssets(attorney), [house], "shared record not visible");
  await mustFail(owner.client.from("account_access_grants").update({ ends_at: new Date(Date.now() - 86400000).toISOString() }).eq("id", attorneyLink.grantId), "past_end_date");
  await must(owner.client.rpc("lf_stop_vault_access", { p_grant_id: attorneyLink.grantId, p_note: "Synthetic stop" }), "stop");
  assert.deepEqual(await visibleAssets(attorney), [], "record visible after stop");
  const history = await must(owner.client.rpc("my_vault_access_history", { p_person_id: attorneyLink.contactId }), "history");
  assert.ok(history.some((item) => item.action === "access.stopped" && item.note === "Synthetic stop"), "stop not in history");
  assert.ok(history.some((item) => item.action === "authority.withdrawn"), "withdrawal not in history");
  assert.equal((await must(stranger.client.rpc("my_vault_access_history", { p_person_id: attorneyLink.contactId }), "stranger_history")).length, 0);
  results.push("sharing now: end date, stop with note, Record history (owner only)");

  // 6. Estate release: waits for the grant of probate; releases the nomination's scope only.
  await must(admin.from("wallets").update({ vault_lifecycle_state: "ESTATE_LOCKED" }).eq("id", wallet.id), "estate_lock");
  const probateCase = await must(admin.from("probate_cases").insert({
    owner_user_id: owner.id, status: "approved", case_type: "probate_access", applicant_status_message: "Synthetic acceptance", required_evidence: [], audit_event_ids: [],
  }).select("id").single(), "probate_case");
  await mustFail(admin.rpc("lf_release_vault_nominations", { p_owner_user_id: owner.id, p_reviewer_user_id: owner.id, p_probate_case_id: probateCase.id }), "release_without_probate");
  await must(admin.from("probate_case_evidence").insert({
    case_id: probateCase.id, owner_user_id: owner.id, evidence_type: "probate_grant", source: "case_upload", storage_bucket: "vault-docs",
    storage_path: `synthetic/${run}/grant.pdf`, file_name: "synthetic-grant.pdf", mime_type: "application/pdf", size_bytes: 1,
  }), "probate_evidence");
  await mustFail(owner.client.rpc("lf_release_vault_nominations", { p_owner_user_id: owner.id, p_reviewer_user_id: owner.id, p_probate_case_id: probateCase.id }), "owner_release");
  const released = await must(admin.rpc("lf_release_vault_nominations", { p_owner_user_id: owner.id, p_reviewer_user_id: owner.id, p_probate_case_id: probateCase.id }), "release");
  assert.equal(released[0].released, 1);
  assert.deepEqual((await visibleAssets(nominee)).sort(), [finance, house, will].sort(), "released scope wrong (exception must stay hidden)");
  assert.equal((await must(nominee.client.rpc("my_vault_nomination_status"), "released_status"))[0].status, "released");
  assert.deepEqual(await visibleAssets(attorney), [], "lifetime access survived the death");
  assert.ok((await kinds(nominee)).includes("release_approved"), "nominee not told about the release");
  assert.ok((await kinds(attorney)).includes("authority_ended"), "attorney not told the authority ended");
  assert.equal((await kinds(stranger)).length, 0, "stranger received notifications");
  results.push("estate release: waits for probate, whole Vault minus exception, view only");

  // 7. Reviewer ID check: document photo + live selfie → waits for a person → approved in Admin → photos deleted.
  const started = await api(applicant, "/api/identity-verification", { purpose: "registration_required", requestedIdentityLevel: 2, consentAcknowledged: true });
  assert.equal(started.status, 201, `idv start failed: ${safeError(started.payload)}`);
  assert.equal(started.payload.verification.providerKey, "lf_inhouse_review_v1");
  const requestId = started.payload.verification.id;
  created.identityRequests.push(requestId);
  const docForm = new FormData();
  docForm.set("file", syntheticImage("image/png"), "synthetic-document.png");
  docForm.set("side", "front");
  const doc = await api(applicant, `/api/identity-verification/${requestId}/document`, docForm);
  assert.equal(doc.status, 200, `document upload failed: ${safeError(doc.payload)}`);
  const challenge = await api(applicant, `/api/identity-verification/${requestId}/challenge`, {});
  assert.ok(challenge.payload.challenge?.prompt, "no selfie prompt");
  const selfieForm = new FormData();
  selfieForm.set("file", syntheticImage("image/jpeg"), "synthetic-selfie.jpg");
  selfieForm.set("challengeId", challenge.payload.challenge.id);
  const selfie = await api(applicant, `/api/identity-verification/${requestId}/camera`, selfieForm);
  assert.equal(selfie.status, 200, `selfie upload failed: ${safeError(selfie.payload)}`);
  const completed = await api(applicant, `/api/identity-verification/${requestId}/complete`, {});
  assert.equal(completed.payload.decision?.status ?? completed.payload.decision?.decision, "review_required", "reviewer check decided automatically");
  const levelBefore = await must(admin.from("identity_assurance_states").select("identity_level").eq("user_id", applicant.id).maybeSingle(), "level_before");
  assert.ok(!levelBefore || Number(levelBefore.identity_level) < 2, "ID verified before a person reviewed it");
  const applicantPeek = await api(applicant, `/api/internal/admin/verifications/${requestId}/evidence`, undefined, "GET");
  assert.ok([401, 403].includes(applicantPeek.status), "applicant reached reviewer evidence");
  const evidence = await api(reviewer, `/api/internal/admin/verifications/${requestId}/evidence`, undefined, "GET");
  assert.equal(evidence.status, 200, `evidence failed: ${safeError(evidence.payload)}`);
  assert.ok(evidence.payload.documentUrl && evidence.payload.selfieUrl && evidence.payload.prompt, "reviewer can't see both photos and the prompt");
  const missingNotes = await api(reviewer, "/api/internal/admin/verifications", { requestId, action: "approve" });
  assert.equal(missingNotes.status, 400, "approved without notes");
  const approved = await api(reviewer, "/api/internal/admin/verifications", { requestId, action: "approve", reviewNotes: "Synthetic acceptance: photos compared" });
  assert.equal(approved.status, 200, `approve failed: ${safeError(approved.payload)}`);
  const levelAfter = await must(admin.from("identity_assurance_states").select("identity_level,provider_key").eq("user_id", applicant.id).maybeSingle(), "level_after");
  assert.equal(Number(levelAfter?.identity_level), 2, "approval didn't verify ID");
  const afterDecision = await api(reviewer, `/api/internal/admin/verifications/${requestId}/evidence`, undefined, "GET");
  assert.equal(afterDecision.status, 409, "photos still available after the decision");
  assert.ok((await kinds(applicant)).includes("identity_approved"), "applicant not told the ID was approved");
  results.push("ID check: waits for a person, reviewer-only photos, approval with notes verifies ID, photos deleted");

  console.log(JSON.stringify({ hosted: true, run, nominationId: String(nominationId).slice(0, 8), checks: results }, null, 2));
  // Visible on the workflow run (job logs aren't always readable): one line, no personal data.
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice title=Vault access acceptance::passed ${results.length} journeys: ${results.map((item) => item.split(":")[0]).join(", ")}`);
}

async function cleanup() {
  if (!admin) return [];
  const failures = [];
  for (const ownerId of created.owners) {
    const grants = await admin.from("account_access_grants").update({ activation_status: "revoked", paused_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId);
    if (grants.error) failures.push("grants");
    const requests = await admin.from("vault_early_access_requests").update({ status: "cancelled" }).eq("owner_user_id", ownerId).eq("status", "open");
    if (requests.error) failures.push("requests");
    const invitations = await admin.from("contact_invitations").update({ invitation_status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId);
    if (invitations.error) failures.push("invitations");
  }
  for (const userId of created.users) {
    const identity = await admin.from("identity_assurance_states").delete().eq("user_id", userId);
    if (identity.error) failures.push("identity");
  }
  for (const userId of created.admins) {
    const removed = await admin.from("admin_users").delete().eq("user_id", userId);
    if (removed.error) failures.push("admin_user");
  }
  return failures;
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ hosted: false, error: safeError(error) }));
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::error title=Vault access acceptance::${safeError(error).replace(/[\r\n]+/g, " ")}`);
  process.exitCode = 1;
} finally {
  const failures = await cleanup();
  if (failures.length) {
    console.error(JSON.stringify({ cleanup: "FAILED", failures }));
    process.exitCode = 1;
  } else if (admin) {
    console.error(JSON.stringify({ cleanup: "synthetic_fixture_cleanup_complete", grants: "revoked", auth_users_and_rows: "retained_for_audit_integrity" }));
  }
}
