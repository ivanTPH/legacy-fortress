#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, finish, marker, signIn } from "./phase6-hosted-fixtures.mjs";

const assertions = [];
const users = [];
const storage = [];
async function token(client) { return (await client.auth.getSession()).data.session?.access_token || ""; }
async function postExport(client, caseId) {
  return fetch(`${process.env.BASE_URL}/api/privacy/exports`, { method: "POST", headers: { Authorization: `Bearer ${await token(client)}`, "Content-Type": "application/json" }, body: JSON.stringify({ caseId, exportType: "portability", syntheticRunMarker: marker }) });
}
async function getExport(client, id) {
  return fetch(`${process.env.BASE_URL}/api/privacy/exports/${id}`, { headers: { Authorization: `Bearer ${await token(client)}` } });
}

try {
  const { admin } = clients();
  const owner = await createSyntheticUser(admin, "privacy-owner");
  const other = await createSyntheticUser(admin, "privacy-other");
  const recipient = await createSyntheticUser(admin, "privacy-recipient");
  users.push(owner.id, other.id, recipient.id);
  const ownerSession = await signIn(null, owner);
  const otherSession = await signIn(null, other);
  const privacyCase = await admin.from("privacy_data_rights_cases").insert({ requester_user_id: owner.id, subject_user_id: owner.id, request_type: "portability", status: "received", identity_verification_status: "not_required", synthetic_run_marker: marker }).select("id").single();
  const ownResponse = await postExport(ownerSession.client, privacyCase.data?.id);
  const ownBody = await ownResponse.json().catch(() => ({}));
  assertion(assertions, "Owner can request own privacy export", ownResponse.status === 201 && Boolean(ownBody.export?.id));
  const exportId = ownBody.export?.id;
  if (exportId) {
    const exportRow = await admin.from("privacy_data_exports").select("id,subject_user_id,storage_bucket,storage_path").eq("id", exportId).single();
    if (!exportRow.error) storage.push({ bucket: exportRow.data.storage_bucket, path: exportRow.data.storage_path });
    const wrongUser = await getExport(otherSession.client, exportId);
    assertion(assertions, "Wrong user cannot download Owner export", wrongUser.status === 404 || wrongUser.status === 410);
  }
  const directForeign = await otherSession.client.from("privacy_data_exports").select("id").eq("subject_user_id", owner.id);
  assertion(assertions, "Wrong user cannot enumerate Owner exports", !directForeign.error && directForeign.data.length === 0);
  const grant = await admin.from("account_access_grants").insert({ owner_user_id: owner.id, linked_user_id: recipient.id, assigned_role: "executor", activation_status: "active", required_identity_level: 2, vault_lifecycle_state: "OWNER_ACTIVE", permissions_override: { allowed_sections: ["financial"] } }).select("id,owner_user_id,linked_user_id,assigned_role,activation_status,permissions_override,updated_at").single();
  assertion(assertions, "Active synthetic linked grant exists for revocation test", !grant.error && grant.data?.owner_user_id === owner.id && grant.data?.linked_user_id === recipient.id && grant.data?.assigned_role === "executor" && grant.data?.activation_status === "active");
  const unrelatedGrant = await admin.from("account_access_grants").insert({ owner_user_id: other.id, linked_user_id: recipient.id, assigned_role: "executor", activation_status: "active", required_identity_level: 2, vault_lifecycle_state: "OWNER_ACTIVE", permissions_override: { allowed_sections: ["financial"] } }).select("id,activation_status").single();
  assertion(assertions, "Unrelated active grant exists before revocation", !unrelatedGrant.error && unrelatedGrant.data?.activation_status === "active");
  if (grant.data?.id) {
    const recipientClient = await signIn(null, recipient);
    const activeAccess = await recipientClient.client.rpc("has_linked_account_access", { p_owner_user_id: owner.id, p_allowed_statuses: ["accepted", "verified", "active"] });
    assertion(assertions, "Active grant is effective before revocation", !activeAccess.error && activeAccess.data === true);
    const revoked = await admin.from("account_access_grants").update({ activation_status: "revoked", updated_at: new Date().toISOString() }).eq("id", grant.data.id).select("id,owner_user_id,linked_user_id,assigned_role,activation_status,permissions_override,updated_at").single();
    assertion(assertions, "Canonical revocation persists on linked grant", !revoked.error && revoked.data?.id === grant.data.id && revoked.data?.activation_status === "revoked" && revoked.data?.owner_user_id === owner.id && revoked.data?.linked_user_id === recipient.id);
    const persisted = await admin.from("account_access_grants").select("id,activation_status,updated_at").eq("id", grant.data.id).single();
    assertion(assertions, "Revoked grant remains auditable", !persisted.error && persisted.data?.id === grant.data.id && persisted.data?.activation_status === "revoked" && Boolean(persisted.data?.updated_at));
    const unrelatedAfter = await admin.from("account_access_grants").select("id,activation_status").eq("id", unrelatedGrant.data?.id).single();
    assertion(assertions, "Unrelated grant remains active", !unrelatedAfter.error && unrelatedAfter.data?.activation_status === "active");
    const revokedAccess = await recipientClient.client.rpc("has_linked_account_access", { p_owner_user_id: owner.id, p_allowed_statuses: ["accepted", "verified", "active"] });
    assertion(assertions, "Revoked recipient cannot regain linked access", !revokedAccess.error && revokedAccess.data === false);
    const unrelatedAccess = await recipientClient.client.rpc("has_linked_account_access", { p_owner_user_id: other.id, p_allowed_statuses: ["accepted", "verified", "active"] });
    assertion(assertions, "Unrelated active grant remains effective", !unrelatedAccess.error && unrelatedAccess.data === true);
    const afterRevoke = await recipientClient.client.from("records").select("id").eq("owner_user_id", owner.id);
    assertion(assertions, "Revoked recipient cannot read Owner records", !afterRevoke.error && afterRevoke.data.length === 0);
  }
  const audit = await admin.from("privacy_case_events").select("id").eq("case_id", privacyCase.data?.id).eq("event_type", "data_export_created");
  assertion(assertions, "Privacy export audit evidence is written", !audit.error && audit.data.length >= 1);
} finally {
  const { admin } = clients();
  const failures = await cleanup(admin, users, storage);
  finish("phase6-hosted-privacy-isolation", assertions, failures.length ? `FAIL: ${failures.join("; ")}` : "PASS");
}
