#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, finish, ownerContext, marker } from "./phase6-hosted-fixtures.mjs";

const assertions = [];
const users = [];
try {
  const { admin, anon } = clients();
  const owner = await createSyntheticUser(admin, "death-estate-owner");
  const executor = await createSyntheticUser(admin, "death-estate-executor");
  const coExecutor = await createSyntheticUser(admin, "death-estate-coexecutor");
  const adviser = await createSyntheticUser(admin, "death-estate-adviser");
  users.push(owner.id, executor.id, coExecutor.id, adviser.id);
  const context = await ownerContext(admin, owner.id, "Death estate");
  const created = await admin.from("records").insert({ owner_user_id: owner.id, section_key: "legal", category_key: "will", title: `${marker} historic record` }).select("id").single();
  const report = await admin.from("death_reports").insert({ owner_user_id: owner.id, claimant_user_id: executor.id, claimant_role: "executor", relationship: "executor", status: "submitted", declaration_accepted: true, claimant_identity_level: 1, vault_state_at_report: "OWNER_ACTIVE", metadata: { synthetic_run_marker: marker } }).select("id,status,vault_state_at_report").single();
  assertion(assertions, "Death report fixture persists without granting executor access", !report.error && report.data?.status === "submitted");
  const noGrant = await admin.from("account_access_grants").select("id").eq("owner_user_id", owner.id).eq("linked_user_id", executor.id);
  assertion(assertions, "Death report alone creates no executor grant", !noGrant.error && noGrant.data.length === 0);

  for (const state of ["DEATH_REPORTED", "PROTECTIVE_LOCK", "ESTATE_LOCKED"]) {
    const transition = await admin.rpc("lf_transition_vault_lifecycle", { p_owner_user_id: owner.id, p_to_state: state, p_actor_user_id: owner.id, p_reason: `${marker} ${state}`, p_death_report_id: report.data.id, p_context: { actor_type: "system", synthetic_run_marker: marker } });
    assertion(assertions, `Vault transition to ${state} succeeds through canonical RPC`, !transition.error && transition.data === state, { error: transition.error?.message || null });
  }
  const wallet = await admin.from("wallets").select("vault_lifecycle_state").eq("id", context.walletId).single();
  assertion(assertions, "Vault reaches ESTATE_LOCKED", !wallet.error && wallet.data?.vault_lifecycle_state === "ESTATE_LOCKED");
  const ownerClient = (await import("./phase6-hosted-fixtures.mjs")).signIn;
  const ownerSession = await ownerClient(anon, owner);
  const ownerMutation = await ownerSession.client.from("records").update({ title: `${marker} prohibited` }).eq("id", created.data.id).select("id").maybeSingle();
  assertion(assertions, "Historic owner record mutation is denied after estate lock", ownerMutation.error || !ownerMutation.data);

  const audit = await admin.from("estate_security_actions").select("action_type,previous_vault_state,new_vault_state").eq("owner_user_id", owner.id).eq("metadata->>synthetic_run_marker", marker);
  assertion(assertions, "Lifecycle transitions leave append-only estate security history", !audit.error && audit.data.length >= 3);
  const events = await admin.from("death_report_events").select("event_type").eq("death_report_id", report.data.id);
  assertion(assertions, "Death report transition events remain available", !events.error && events.data.length >= 3);

  const estate = await admin.from("estate_cases").insert({ owner_user_id: owner.id, death_report_id: report.data.id, case_reference: `EST-${marker.slice(-12).toUpperCase()}`, status: "open", vault_state_at_open: "ESTATE_LOCKED", opened_by_user_id: executor.id, metadata: { synthetic_run_marker: marker } }).select("id,status").single();
  assertion(assertions, "Estate case opens against locked vault", !estate.error && estate.data?.status === "open");
  const participants = await admin.from("estate_participants").insert([
    { estate_case_id: estate.data.id, user_id: executor.id, participant_role: "executor", status: "identity_required", required_identity_level: 2, added_by_user_id: owner.id },
    { estate_case_id: estate.data.id, user_id: coExecutor.id, participant_role: "co_executor", status: "identity_required", required_identity_level: 2, added_by_user_id: owner.id },
    { estate_case_id: estate.data.id, user_id: adviser.id, participant_role: "accountant", status: "invited", required_identity_level: 2, added_by_user_id: owner.id },
  ]).select("id,participant_role");
  assertion(assertions, "Executor, co-executor and adviser participants persist", !participants.error && participants.data.length === 3);
  const task = await admin.from("estate_tasks").insert({ estate_case_id: estate.data.id, title: `${marker} task`, created_by_user_id: owner.id }).select("id").single();
  const valuation = await admin.from("estate_valuations").insert({ estate_case_id: estate.data.id, owner_user_id: owner.id, valuation_amount_minor: 100, uploaded_by_user_id: executor.id, provenance: { synthetic_run_marker: marker } }).select("id").single();
  const liability = await admin.from("estate_liabilities").insert({ estate_case_id: estate.data.id, owner_user_id: owner.id, creditor_name: `${marker} creditor`, recorded_by_user_id: executor.id, provenance: { synthetic_run_marker: marker } }).select("id").single();
  const beneficiary = await admin.from("estate_beneficiary_records").insert({ estate_case_id: estate.data.id, owner_user_id: owner.id, beneficiary_label: `${marker} beneficiary`, recorded_by_user_id: executor.id, provenance: { synthetic_run_marker: marker } }).select("id").single();
  const distribution = await admin.from("estate_distributions").insert({ estate_case_id: estate.data.id, owner_user_id: owner.id, beneficiary_record_id: beneficiary.data?.id || null, asset_or_cash_description: `${marker} distribution`, recorded_by_user_id: executor.id, provenance: { synthetic_run_marker: marker } }).select("id,status").single();
  assertion(assertions, "Implemented estate working records persist", !task.error && !valuation.error && !liability.error && !beneficiary.error && !distribution.error);
  const selfApproval = await admin.from("sensitive_action_requests").insert({ estate_case_id: estate.data.id, owner_user_id: owner.id, requester_user_id: executor.id, action_type: "distribution_approve", target_type: "estate_case", target_id: estate.data.id, justification: `${marker} self approval test`, required_approvals: 2, metadata: { synthetic_run_marker: marker } }).select("id").single();
  const approval = await admin.from("sensitive_action_approvals").insert({ request_id: selfApproval.data?.id, approver_user_id: executor.id, decision: "approved", reason: `${marker} self approval` });
  assertion(assertions, "Self-approval is rejected by sensitive-action constraints", Boolean(approval.error));
  const suspended = await admin.from("estate_participants").update({ status: "suspended", suspended_at: new Date().toISOString() }).eq("estate_case_id", estate.data.id).eq("user_id", adviser.id).select("id").maybeSingle();
  const revoked = await admin.from("estate_participants").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("estate_case_id", estate.data.id).eq("user_id", adviser.id).select("id").maybeSingle();
  assertion(assertions, "Estate participant suspension and revocation are represented", !suspended.error && !revoked.error);
  const closed = await admin.from("estate_cases").update({ status: "closed", closed_at: new Date().toISOString(), closure_reason: `${marker} close` }).eq("id", estate.data.id).select("status").single();
  const reopened = await admin.from("estate_cases").update({ status: "open", closed_at: null }).eq("id", estate.data.id).select("status").single();
  assertion(assertions, "Estate case close and reopen are supported", !closed.error && closed.data?.status === "closed" && !reopened.error && reopened.data?.status === "open");
} finally {
  const { admin } = clients();
  const failures = await cleanup(admin, users);
  finish("phase6-hosted-death-estate", assertions, failures.length ? `FAIL: ${failures.join("; ")}` : "PASS (immutable audit rows retained)");
}
