#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, finish, marker } from "./phase6-hosted-fixtures.mjs";

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
  const ownerSession = await (await import("./phase6-hosted-fixtures.mjs")).signIn(null, owner);
  const otherSession = await (await import("./phase6-hosted-fixtures.mjs")).signIn(null, other);
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
  const grant = await admin.from("account_access_grants").insert({ owner_user_id: owner.id, linked_user_id: recipient.id, assigned_role: "executor", activation_status: "active", required_identity_level: 2, vault_lifecycle_state: "OWNER_ACTIVE", permissions_override: { allowed_sections: ["financial"] } }).select("id,linked_user_id,assigned_role").single();
  assertion(assertions, "Synthetic linked grant exists for revocation test", !grant.error && Boolean(grant.data?.id));
  if (grant.data?.id) {
    const revoked = await admin.from("account_access_grants").update({ activation_status: "revoked", revoked_at: new Date().toISOString() }).eq("id", grant.data.id).select("activation_status").single();
    assertion(assertions, "Revocation persists on linked grant", !revoked.error && revoked.data?.activation_status === "revoked");
    const recipientClient = await (await import("./phase6-hosted-fixtures.mjs")).signIn(null, recipient);
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
