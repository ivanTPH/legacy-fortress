#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectPreflight } from "../dev/preflight.mjs";

export const APPROVED_ORDER = [
  "20261027070000_restrict_linked_grants_to_explicit_scope.sql",
  "20261027071500_document_display_titles.sql",
];
const hex = /^[0-9a-f]{64}$/;
export function validateRequest({ filename, checksum, approvalChecksum, currentVersions, localVersions, preflight }) {
  if (!APPROVED_ORDER.includes(filename)) throw new Error("Migration is not in the separately reviewed TEST allowlist");
  if (!hex.test(checksum ?? "") || approvalChecksum !== checksum) throw new Error("Exact owner-approved SHA-256 is missing or mismatched");
  if (preflight.status !== "READ_ONLY_READY_APPROVAL_REQUIRED") throw new Error(preflight.blocker || "Fresh TEST preflight required");
  const version = filename.slice(0, 14);
  const pending = localVersions.filter((v) => !currentVersions.includes(v));
  const allowed = APPROVED_ORDER.map((name) => name.slice(0, 14));
  if (currentVersions.includes(version)) throw new Error("Migration already recorded; no repeat apply");
  if (pending.some((v) => !allowed.includes(v))) throw new Error("Unexpected pending migration; stop for drift review");
  if (pending[0] !== version) throw new Error("Migration ordering mismatch; security correction must precede document titles");
  if (currentVersions.some((v) => !localVersions.includes(v))) throw new Error("Hosted migration history contains an unknown version");
  return { version, pending };
}
export function migrationFiles(directory = resolve("supabase/migrations")) {
  return readdirSync(directory).filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
}
const psql = (sqlOrFile, env, file = false) => execFileSync("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", file ? "-f" : "-c", sqlOrFile],
  { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }).trim();
function migrationEnvironment(env) {
  const keys = ["TEST_DB_MIGRATE_HOST", "TEST_DB_MIGRATE_PORT", "TEST_DB_MIGRATE_NAME", "TEST_DB_MIGRATE_USER", "TEST_DB_MIGRATE_PASSWORD"];
  if (keys.some((key) => !env[key])) throw new Error("Protected TEST migration operator connection is incomplete");
  if (env.TEST_DB_MIGRATE_HOST !== env.TEST_DB_RO_HOST || env.TEST_DB_MIGRATE_PORT !== env.TEST_DB_RO_PORT || env.TEST_DB_MIGRATE_NAME !== "postgres")
    throw new Error("Migration operator target differs from the read-only verified TEST database");
  return { ...env, PGHOST: env.TEST_DB_MIGRATE_HOST, PGPORT: env.TEST_DB_MIGRATE_PORT,
    PGDATABASE: env.TEST_DB_MIGRATE_NAME, PGUSER: env.TEST_DB_MIGRATE_USER, PGPASSWORD: env.TEST_DB_MIGRATE_PASSWORD };
}
async function main() {
  const env = process.env;
  if (env.GITHUB_ACTIONS !== "true" || env.STAGING_DB_MIGRATIONS_ENABLED !== "true" || env.GITHUB_REF_NAME !== "hosted-uat-preparation-20260715")
    throw new Error("Protected staging migration workflow is disabled or on the wrong branch");
  if (!env.MIGRATION_APPROVED_OPERATOR || !env.MIGRATION_APPROVED_TARGET_DB || !env.MIGRATION_APPROVED_TEST_CLUSTER_ID)
    throw new Error("Named operator and exact TEST database approval are required");
  const filename = env.MIGRATION_FILENAME;
  const checksum = env.MIGRATION_SHA256;
  const path = resolve("supabase/migrations", filename ?? "");
  if (!APPROVED_ORDER.includes(filename)) throw new Error("Migration is not allowlisted");
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== checksum) throw new Error("SQL file SHA-256 differs from reviewed artifact");
  const preflight = await collectPreflight(); // Always fresh. Its local cache is never consulted.
  const files = migrationFiles();
  const versions = files.map((name) => name.slice(0, 14));
  const state = validateRequest({ filename, checksum, approvalChecksum: env.MIGRATION_APPROVED_SHA256,
    currentVersions: preflight.migrationHistory || [], localVersions: versions, preflight });
  if (preflight.stagingSha !== preflight.liveTestSha) throw new Error("Stage application code only after the matching database migration");
  if (env.MIGRATION_APPROVED_TARGET_DB !== preflight.testDatabase || env.MIGRATION_APPROVED_TEST_CLUSTER_ID !== preflight.testClusterId)
    throw new Error("Owner-approved TEST database and cluster do not match fresh evidence");
  const pgEnv = migrationEnvironment(env);
  const cluster = psql("SELECT system_identifier::text FROM pg_control_system();", pgEnv);
  if (cluster !== preflight.testClusterId || cluster === env.PRODUCTION_DB_CLUSTER_ID) throw new Error("Migration operator reached the wrong PostgreSQL cluster");
  const requiredColumns = psql("SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' AND is_nullable='NO' AND column_default IS NULL;", pgEnv);
  if (!requiredColumns.split(",").every((v) => ["version", "name", "statements"].includes(v))) throw new Error("Unknown migration-history schema");
  const hasName = psql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' AND column_name='name');", pgEnv) === "t";
  const hasStatements = psql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' AND column_name='statements');", pgEnv) === "t";
  const columns = ["version", ...(hasName ? ["name"] : []), ...(hasStatements ? ["statements"] : [])];
  const values = [`'${state.version}'`, ...(hasName ? [`'${filename.slice(15, -4)}'`] : []), ...(hasStatements ? ["ARRAY[]::text[]"] : [])];
  // One transaction covers the reviewed SQL and its history entry. Never logs SQL or connection values.
  execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", path,
    "-c", `INSERT INTO supabase_migrations.schema_migrations(${columns.join(",")}) VALUES (${values.join(",")});`],
    { env: pgEnv, stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
  const count = psql(`SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='${state.version}';`, pgEnv);
  if (count !== "1") throw new Error("Migration history verification failed; stop before application release");
  if (state.version === "20261027070000") {
    const security = psql(`SELECT (position('asset_ids' in pg_get_functiondef('public.linked_grant_allows_asset(uuid,uuid)'::regprocedure)) > 0
      AND position('contact_links' in pg_get_functiondef('public.linked_grant_allows_asset(uuid,uuid)'::regprocedure)) = 0
      AND position('record_ids' in pg_get_functiondef('public.linked_grant_allows_record(uuid,uuid)'::regprocedure)) > 0
      AND position('record_contacts' in pg_get_functiondef('public.linked_grant_allows_record(uuid,uuid)'::regprocedure)) = 0)::text;`, pgEnv);
    if (security !== "true") throw new Error("Post-migration explicit grant-scope verification failed");
  } else {
    const title = psql(`SELECT (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='display_title')
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.documents'::regclass AND tgname='documents_protect_original' AND NOT tgisinternal)
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.documents'::regclass AND tgname='documents_display_title_audit' AND NOT tgisinternal))::text;`, pgEnv);
    if (title !== "true") throw new Error("Post-migration title guard/audit verification failed");
  }
  process.stdout.write(JSON.stringify({ result: "applied_history_verified", filename, sha256: checksum,
    databaseResource: preflight.testDatabase, testClusterId: cluster, operator: env.MIGRATION_APPROVED_OPERATOR, stagingSha: preflight.stagingSha,
    at: new Date().toISOString(), hostedSecurityChecks: "required_before_application_release" }) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write("Protected TEST migration blocked; review exact target, SQL, history and recovery evidence. No application release authorised.\n"); process.exitCode = 2; });
}
