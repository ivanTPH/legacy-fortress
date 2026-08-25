import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const STAGING_BASE_URL = "https://test.mylegacyfortress.com";
export const STAGING_SUPABASE_URL = "https://supabase-test.mylegacyfortress.com";
export const marker = `phase6-hosted-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

export function requireStaging() {
  if (process.env.BASE_URL !== STAGING_BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_SUPABASE_URL) throw new Error("TEST-ENVIRONMENT DEFECT: exact staging targets are required");
  if (/production|\.supabase\.co|legacy-fortress\.vercel\.app/i.test(`${process.env.BASE_URL} ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)) throw new Error("Refusing production or Supabase Cloud target");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("TEST-ENVIRONMENT DEFECT: staging Supabase credentials are missing");
}

export function clients() {
  requireStaging();
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  return {
    admin: createClient(STAGING_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options),
    anon: createClient(STAGING_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options),
  };
}

export async function createSyntheticUser(admin, role) {
  const email = `${marker}-${role}@example.test`;
  const password = `Phase6-${crypto.randomUUID()}-Aa9!`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Phase 6 ${role}` } });
  if (result.error || !result.data.user) throw new Error(`synthetic user creation failed: ${result.error?.message || "no user"}`);
  return { id: result.data.user.id, email, password };
}

export async function signIn(anon, user) {
  const client = createClient(STAGING_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (result.error || !result.data.user) throw new Error(`synthetic sign-in failed: ${result.error?.message || "no session"}`);
  return { client, user: result.data.user };
}

export async function ownerContext(admin, ownerId, label = "Phase 6 wallet") {
  const organisation = await admin.from("organisations").insert({ owner_user_id: ownerId, name: `${label} organisation` }).select("id").single();
  if (organisation.error || !organisation.data) throw new Error(`organisation fixture failed: ${organisation.error?.message}`);
  const wallet = await admin.from("wallets").insert({ organisation_id: organisation.data.id, owner_user_id: ownerId, label, status: "active" }).select("id").single();
  if (wallet.error || !wallet.data) throw new Error(`wallet fixture failed: ${wallet.error?.message}`);
  return { organisationId: organisation.data.id, walletId: wallet.data.id };
}

export function assertion(assertions, name, pass, details = {}) {
  assertions.push({ assertion: name, result: pass ? "PASS" : "FAIL", classification: pass ? "" : "APPLICATION DEFECT", ...details });
}

export function denied(result) {
  return Boolean(result?.error) || result?.data == null || (Array.isArray(result.data) && result.data.length === 0);
}

export async function cleanup(admin, userIds, storage = []) {
  const failures = [];
  for (const item of storage) {
    const result = await admin.storage.from(item.bucket).remove([item.path]);
    if (result.error && !/not found|does not exist/i.test(result.error.message)) failures.push(`storage:${result.error.message}`);
  }
  for (const userId of [...new Set(userIds.filter(Boolean))]) {
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) failures.push(`auth:${result.error.message}`);
  }
  return failures;
}

export function classify(error) {
  const text = String(error?.message || error).toLowerCase();
  if (/staging|missing|econn|enotfound|timeout|network|playwright|browser/.test(text)) return "TEST-ENVIRONMENT DEFECT";
  if (/smtp|commercial idv|production idv|kms|hsm/.test(text)) return "PRE-PRODUCTION BLOCKER";
  return "APPLICATION DEFECT";
}

export function finish(name, assertions, cleanupStatus = "not-run") {
  const failures = assertions.filter((item) => item.result === "FAIL");
  const cleanupFailed = /^FAIL:/i.test(cleanupStatus);
  const classification = failures[0]?.classification || (cleanupFailed ? "TEST-ENVIRONMENT DEFECT" : "");
  console.log(JSON.stringify({ script: name, marker, assertions, cleanupStatus, classification, ok: failures.length === 0 && !cleanupFailed }, null, 2));
  if (failures.length || cleanupFailed) process.exitCode = 1;
}
