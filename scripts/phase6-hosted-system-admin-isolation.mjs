#!/usr/bin/env node
import { assertion, clients, cleanup, createSyntheticUser, finish, marker } from "./phase6-hosted-fixtures.mjs";

const assertions = [];
const users = [];
const adminRows = [];
async function bearer(client) {
  const session = await client.auth.getSession();
  return session.data.session?.access_token || "";
}
async function api(pathname, token) {
  return fetch(`${process.env.BASE_URL}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
}

try {
  const { admin } = clients();
  const consumer = await createSyntheticUser(admin, "system-admin-consumer");
  const systemAdmin = await createSyntheticUser(admin, "system-admin");
  const enterpriseAdmin = await createSyntheticUser(admin, "enterprise-boundary-admin");
  users.push(consumer.id, systemAdmin.id, enterpriseAdmin.id);
  for (const [user, role] of [[systemAdmin, "super_admin"], [enterpriseAdmin, "enterprise_admin"]]) {
    const row = await admin.from("admin_users").insert({ email_normalized: user.email, user_id: user.id, display_name: `${marker} ${role}`, status: "active", is_master: false, role }).select("id").single();
    if (row.error || !row.data) throw new Error(`admin fixture failed: ${row.error?.message}`);
    adminRows.push(row.data.id);
  }
  const consumerSession = await (await import("./phase6-hosted-fixtures.mjs")).signIn((await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }), consumer);
  const systemSession = await (await import("./phase6-hosted-fixtures.mjs")).signIn((await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }), systemAdmin);
  const enterpriseSession = await (await import("./phase6-hosted-fixtures.mjs")).signIn((await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }), enterpriseAdmin);
  const consumerResponse = await api("/api/internal/admin/session", await bearer(consumerSession.client));
  assertion(assertions, "Normal consumer cannot access System Admin session", consumerResponse.status === 401 || consumerResponse.status === 403);
  const enterpriseResponse = await api("/api/internal/admin/admin-users", await bearer(enterpriseSession.client));
  assertion(assertions, "Enterprise administrator cannot access LF System Admin user-management API", enterpriseResponse.status === 401 || enterpriseResponse.status === 403);
  const systemResponse = await api("/api/internal/admin/session", await bearer(systemSession.client));
  const systemBody = await systemResponse.json().catch(() => ({}));
  assertion(assertions, "System Admin session remains authenticated as the same principal", systemResponse.ok && systemBody.admin?.role === "super_admin" && systemBody.admin?.email === systemAdmin.email);
  assertion(assertions, "System Admin remains in unscoped platform context while enterprise metadata is reviewable", systemResponse.ok && systemBody.admin?.enterpriseScope?.organisationScoped === false && Array.isArray(systemBody.admin?.enterpriseScope?.organisationIds) && systemBody.admin.enterpriseScope.organisationIds.length === 0);
} finally {
  const { admin } = clients();
  for (const id of adminRows) await admin.from("admin_users").delete().eq("id", id);
  const failures = await cleanup(admin, users);
  finish("phase6-hosted-system-admin-isolation", assertions, failures.length ? `FAIL: ${failures.join("; ")}` : "PASS");
}
