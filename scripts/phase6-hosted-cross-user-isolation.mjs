#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, denied, finish, ownerContext, signIn, marker } from "./phase6-hosted-fixtures.mjs";

const assertions = [];
const users = [];
const storage = [];
let cleanupStatus = "not-run";

try {
  const { admin, anon } = clients();
  const ownerA = await createSyntheticUser(admin, "cross-owner-a");
  const ownerB = await createSyntheticUser(admin, "cross-owner-b");
  users.push(ownerA.id, ownerB.id);
  await ownerContext(admin, ownerA.id, "Cross-user A");
  const contextB = await ownerContext(admin, ownerB.id, "Cross-user B");

  const recordB = await admin.from("records").insert({ owner_user_id: ownerB.id, section_key: "financial", category_key: "bank", title: `${marker} B record` }).select("id").single();
  const assetB = await admin.from("assets").insert({ organisation_id: contextB.organisationId, wallet_id: contextB.walletId, owner_user_id: ownerB.id, section_key: "property", category_key: "property", title: `${marker} B asset` }).select("id").single();
  const documentPath = `${ownerB.id}/${marker}-document.png`;
  const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0wAAAABJRU5ErkJggg==", "base64");
  const documentUpload = await admin.storage.from("vault-docs").upload(documentPath, tinyPng, { contentType: "image/png", upsert: false });
  if (documentUpload.error) throw new Error(`document fixture failed: ${documentUpload.error.message}`);
  storage.push({ bucket: "vault-docs", path: documentPath });
  const documentB = await admin.from("documents").insert({ organisation_id: contextB.organisationId, wallet_id: contextB.walletId, asset_id: assetB.data.id, owner_user_id: ownerB.id, storage_bucket: "vault-docs", storage_path: documentPath, file_name: `${marker}.png`, mime_type: "image/png", size_bytes: tinyPng.length }).select("id").single();
  const contactB = await admin.from("contacts").insert({ owner_user_id: ownerB.id, full_name: `${marker} B contact`, email: `${marker}-b@example.test`, email_normalized: `${marker}-b@example.test`, contact_role: "executor" }).select("id").single();
  if (recordB.error || assetB.error || documentB.error || contactB.error) throw new Error("cross-user fixture creation failed");

  const sessionA = await signIn(anon, ownerA);
  const sessionB = await signIn(anon, ownerB);
  const foreignRecordFromA = await sessionA.client.from("records").select("id").eq("id", recordB.data.id).maybeSingle();
  const foreignRecordFromB = await sessionB.client.from("records").select("id").eq("id", recordB.data.id).maybeSingle();
  assertion(assertions, "Owner A cannot read Owner B record by UUID", denied(foreignRecordFromA));
  assertion(assertions, "Owner B can read its own record", !foreignRecordFromB.error && foreignRecordFromB.data?.id === recordB.data.id);

  const contactsFromA = await sessionA.client.from("contacts").select("id").eq("owner_user_id", ownerB.id);
  assertion(assertions, "Owner A cannot enumerate Owner B contacts", denied(contactsFromA));
  const documentFromA = await sessionA.client.from("documents").select("id").eq("id", documentB.data.id).maybeSingle();
  assertion(assertions, "Owner A cannot read Owner B document metadata", denied(documentFromA));
  const signedFromA = await sessionA.client.storage.from("vault-docs").createSignedUrl(documentPath, 60);
  assertion(assertions, "Owner A cannot generate Owner B signed URL", denied(signedFromA));
  const updateForeign = await sessionA.client.from("records").update({ title: `${marker} illicit update` }).eq("id", recordB.data.id).select("id").maybeSingle();
  assertion(assertions, "Owner A cannot update Owner B record", denied(updateForeign));
  const deleteForeign = await sessionA.client.from("records").delete().eq("id", recordB.data.id).select("id").maybeSingle();
  assertion(assertions, "Owner A cannot delete Owner B record", denied(deleteForeign));
  const insertForeign = await sessionA.client.from("records").insert({ owner_user_id: ownerB.id, section_key: "financial", category_key: "bank", title: `${marker} forged` }).select("id").maybeSingle();
  assertion(assertions, "Owner A cannot insert a record owned by Owner B", denied(insertForeign));
  assertion(assertions, "Owner A cannot expose Owner B asset through UUID substitution", denied(await sessionA.client.from("assets").select("id").eq("id", assetB.data.id).maybeSingle()));
  assertion(assertions, "Owner B contact fixture persisted canonically", !contactB.error && Boolean(contactB.data?.id));
} finally {
  const { admin } = clients();
  const failures = await cleanup(admin, users, storage);
  cleanupStatus = failures.length ? `FAIL: ${failures.join("; ")}` : "PASS";
  finish("phase6-hosted-cross-user-isolation", assertions, cleanupStatus);
}
