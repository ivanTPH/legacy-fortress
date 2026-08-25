#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, finish, ownerContext, signIn, marker } from "./phase6-hosted-fixtures.mjs";

const assertions = [];
const users = [];
try {
  const { admin } = clients();
  const owner = await createSyntheticUser(admin, "identity-owner");
  const recipient = await createSyntheticUser(admin, "identity-recipient");
  const unrelated = await createSyntheticUser(admin, "identity-unrelated");
  users.push(owner.id, recipient.id, unrelated.id);
  const ownerContextValue = await ownerContext(admin, owner.id, "Identity assurance");
  const unrelatedContext = await ownerContext(admin, unrelated.id, "Identity unrelated");
  const ownerAsset = await admin.from("assets").insert({ organisation_id: ownerContextValue.organisationId, wallet_id: ownerContextValue.walletId, owner_user_id: owner.id, section_key: "property", category_key: "property", title: `${marker} permitted asset` }).select("id").single();
  const unrelatedAsset = await admin.from("assets").insert({ organisation_id: unrelatedContext.organisationId, wallet_id: unrelatedContext.walletId, owner_user_id: unrelated.id, section_key: "property", category_key: "property", title: `${marker} unrelated asset` }).select("id").single();
  const grant = await admin.from("account_access_grants").insert({ owner_user_id: owner.id, linked_user_id: recipient.id, activation_status: "active", required_identity_level: 2, vault_lifecycle_state: "OWNER_ACTIVE", permissions: { allowed_sections: ["property"], asset_ids: [ownerAsset.data.id] }, synthetic_run_marker: marker }).select("id").single();
  assertion(assertions, "Identity assurance fixture links the intended recipient to the intended grant", !grant.error && Boolean(grant.data?.id));
  const recipientSession = await signIn(null, recipient);
  const levelOne = await recipientSession.client.from("identity_assurance_states").select("identity_level").eq("user_id", recipient.id);
  assertion(assertions, "Authenticated recipient starts at Level 1", !levelOne.error && (levelOne.data.length === 0 || levelOne.data[0].identity_level === 1));
  const levelOneAsset = await recipientSession.client.from("assets").select("id").eq("id", ownerAsset.data.id).maybeSingle();
  assertion(assertions, "Level 1 alone cannot read linked protected asset", !levelOneAsset.error && !levelOneAsset.data);

  const wrongUserState = await admin.from("identity_assurance_states").insert({ user_id: unrelated.id, identity_level: 2, provider_key: "lf_staging_internal", provider_assurance_class: "staging_uat_only", verified_at: new Date().toISOString(), metadata: { synthetic_run_marker: marker } });
  assertion(assertions, "Verification state is stored against the verified user, not another grant", !wrongUserState.error);
  const wrongUserAsset = await recipientSession.client.from("identity_verification_requests").select("id").eq("user_id", unrelated.id);
  assertion(assertions, "Recipient cannot read another user's verification state", !wrongUserAsset.error && wrongUserAsset.data.length === 0);

  const verified = await admin.from("identity_assurance_states").upsert({ user_id: recipient.id, identity_level: 2, provider_key: "lf_staging_internal", provider_assurance_class: "staging_uat_only", verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), metadata: { synthetic_run_marker: marker } }, { onConflict: "user_id" }).select("identity_level").single();
  assertion(assertions, "Staging Level 2 verification transitions the intended user", !verified.error && verified.data?.identity_level === 2);
  const verifiedAsset = await recipientSession.client.from("assets").select("id").eq("id", ownerAsset.data.id).maybeSingle();
  assertion(assertions, "Level 2 verification does not bypass explicit grant scope", !verifiedAsset.error && verifiedAsset.data?.id === ownerAsset.data.id);
  const noPermissionAsset = await recipientSession.client.from("assets").select("id").eq("id", unrelatedAsset.data.id).maybeSingle();
  assertion(assertions, "Fresh verification without permission remains denied", !noPermissionAsset.error && !noPermissionAsset.data);

  const stale = await admin.from("identity_assurance_states").update({ identity_level: 3, presence_reverified_at: new Date(Date.now() - 3600000).toISOString(), expires_at: new Date(Date.now() - 1000).toISOString() }).eq("user_id", recipient.id);
  assertion(assertions, "Stale Level 3 state is represented as expired", !stale.error);
  const stalePresence = await recipientSession.client.rpc("lf_identity_presence_level", { p_user_id: recipient.id });
  assertion(assertions, "Stale Level 3 presence is denied", !stalePresence.error && Number(stalePresence.data || 0) < 3);
  const fresh = await admin.from("identity_assurance_states").update({ identity_level: 3, presence_reverified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), metadata: { synthetic_run_marker: marker, presence_expires_at: new Date(Date.now() + 600000).toISOString() } }).eq("user_id", recipient.id);
  assertion(assertions, "Fresh Level 3 presence is accepted by staging assurance state", !fresh.error);
  const freshPresence = await recipientSession.client.rpc("lf_identity_presence_level", { p_user_id: recipient.id });
  assertion(assertions, "Fresh Level 3 presence reaches sensitive-operation assurance", !freshPresence.error && Number(freshPresence.data || 0) === 3);
  console.log(JSON.stringify({ providerClassification: "staging/UAT-only; not production-certified commercial IDV" }));
} finally {
  const { admin } = clients();
  const failures = await cleanup(admin, users);
  finish("phase6-hosted-identity-assurance", assertions, failures.length ? `FAIL: ${failures.join("; ")}` : "PASS");
}
