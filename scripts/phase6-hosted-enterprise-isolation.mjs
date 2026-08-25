#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, finish, ownerContext, marker } from "./phase6-hosted-fixtures.mjs";

const assertions = [];
const users = [];
try {
  const { admin, anon } = clients();
  const adminA = await createSyntheticUser(admin, "enterprise-admin-a");
  const adminB = await createSyntheticUser(admin, "enterprise-admin-b");
  const consumer = await createSyntheticUser(admin, "enterprise-consumer");
  users.push(adminA.id, adminB.id, consumer.id);
  const orgA = await admin.from("enterprise_organisations").insert({ legal_name: `${marker} Organisation A`, trading_name: `${marker} A`, organisation_type: "employer", status: "active", created_by_user_id: adminA.id }).select("id").single();
  const orgB = await admin.from("enterprise_organisations").insert({ legal_name: `${marker} Organisation B`, trading_name: `${marker} B`, organisation_type: "employer", status: "active", created_by_user_id: adminB.id }).select("id").single();
  const licenceA = await admin.from("enterprise_licences").insert({ organisation_id: orgA.data.id, licence_plan: "starter", contract_reference: marker, start_date: "2026-01-01", renewal_date: "2027-01-01", purchased_seats: 2, licence_status: "active", billing_status: "current", created_by_user_id: adminA.id }).select("id").single();
  const licenceB = await admin.from("enterprise_licences").insert({ organisation_id: orgB.data.id, licence_plan: "starter", contract_reference: `${marker}-b`, start_date: "2026-01-01", renewal_date: "2027-01-01", purchased_seats: 2, licence_status: "active", billing_status: "current", created_by_user_id: adminB.id }).select("id").single();
  const membershipA = await admin.from("enterprise_memberships").insert({ organisation_id: orgA.data.id, licence_id: licenceA.data.id, user_id: adminA.id, email_normalized: adminA.email, organisation_role: "organisation_admin", membership_status: "active", onboarding_status: "complete", consent_status: "accepted", synthetic_run_marker: marker }).select("id").single();
  const membershipB = await admin.from("enterprise_memberships").insert({ organisation_id: orgB.data.id, licence_id: licenceB.data.id, user_id: adminB.id, email_normalized: adminB.email, organisation_role: "organisation_admin", membership_status: "active", onboarding_status: "complete", consent_status: "accepted", synthetic_run_marker: marker }).select("id").single();
  assertion(assertions, "Organisation A/B and active licence memberships persist", !orgA.error && !orgB.error && !licenceA.error && !licenceB.error && !membershipA.error && !membershipB.error);
  const sessionA = await (await import("./phase6-hosted-fixtures.mjs")).signIn(anon, adminA);
  const sessionB = await (await import("./phase6-hosted-fixtures.mjs")).signIn(anon, adminB);
  const bReadsA = await sessionB.client.from("enterprise_memberships").select("id").eq("organisation_id", orgA.data.id);
  const aReadsB = await sessionA.client.from("enterprise_memberships").select("id").eq("organisation_id", orgB.data.id);
  assertion(assertions, "Organisation B administrator cannot read Organisation A membership", !bReadsA.error && bReadsA.data.length === 0);
  assertion(assertions, "Organisation A administrator cannot read Organisation B membership", !aReadsB.error && aReadsB.data.length === 0);
  const context = await ownerContext(admin, consumer.id, "Enterprise consumer vault");
  const asset = await admin.from("assets").insert({ organisation_id: context.organisationId, wallet_id: context.walletId, owner_user_id: consumer.id, section_key: "financial", category_key: "bank", title: `${marker} private vault` }).select("id").single();
  const vaultFromEnterprise = await sessionA.client.from("assets").select("id").eq("id", asset.data.id).maybeSingle();
  const recordFromEnterprise = await sessionA.client.from("records").select("id").eq("owner_user_id", consumer.id);
  assertion(assertions, "Enterprise user cannot read consumer Personal Vault asset", !vaultFromEnterprise.error && !vaultFromEnterprise.data);
  assertion(assertions, "Enterprise user cannot enumerate consumer financial records", !recordFromEnterprise.error && recordFromEnterprise.data.length === 0);
  const privateEstate = await admin.from("estate_cases").select("id").eq("owner_user_id", consumer.id);
  assertion(assertions, "Enterprise user has no private estate access", !privateEstate.error && privateEstate.data.length === 0);
  const rawIdv = await sessionA.client.from("identity_verification_requests").select("id").eq("user_id", consumer.id);
  assertion(assertions, "Enterprise user has no raw IDV access", !rawIdv.error && rawIdv.data.length === 0);
} finally {
  const { admin } = clients();
  await admin.from("enterprise_organisations").delete().ilike("legal_name", `${marker}%`);
  const failures = await cleanup(admin, users);
  finish("phase6-hosted-enterprise-isolation", assertions, failures.length ? `FAIL: ${failures.join("; ")}` : "PASS");
}
