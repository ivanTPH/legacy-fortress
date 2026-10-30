#!/usr/bin/env node
/* Apply owner-approved migration files to the Coolify TEST database only.
 * Reads ops/test-migration-request.json: { mode: "verify" | "apply", files: [{ file, sha256 }] }.
 * Refuses unless the API host is TEST and the PostgreSQL cluster is not the production cluster.
 * Each file runs as one implicit transaction via the TEST Supabase pg-meta endpoint, then is
 * recorded in supabase_migrations.schema_migrations. Output never includes keys or row data. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const TEST_URL = "https://supabase-test.mylegacyfortress.com";
const PRODUCTION_CLUSTER_ID = String(process.env.PRODUCTION_DB_CLUSTER_ID ?? "").trim();

const fail = (message) => { console.error(JSON.stringify({ ok: false, error: message })); process.exit(1); };
const url = String(process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (url !== TEST_URL) fail("target_is_not_test");
if (!key) fail("missing_key");
if (!/^\d+$/.test(PRODUCTION_CLUSTER_ID)) fail("missing_production_cluster_id");

const request = JSON.parse(readFileSync("ops/test-migration-request.json", "utf8"));
if (!["verify", "apply"].includes(request.mode)) fail("invalid_mode");

async function query(sql) {
  const response = await fetch(`${TEST_URL}/pg/query`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = "query_failed";
    try { message = JSON.parse(text).error || JSON.parse(text).message || message; } catch { /* keep generic */ }
    throw new Error(`pg_${response.status}: ${String(message).slice(0, 300)}`);
  }
  return JSON.parse(text);
}

const [identity] = await query("select (select system_identifier::text from pg_control_system()) as cluster, current_database() as db, current_user as role, (select count(*) from information_schema.tables where table_schema = 'supabase_migrations' and table_name = 'schema_migrations')::int as has_history");
if (identity.cluster === PRODUCTION_CLUSTER_ID) fail("refusing_production_cluster");
if (!/^\d+$/.test(String(identity.cluster))) fail("cluster_identity_unavailable");
const applied = identity.has_history ? new Set((await query("select version from supabase_migrations.schema_migrations")).map((row) => row.version)) : new Set();

const report = { ok: true, mode: request.mode, cluster: `TEST ${identity.cluster}`, role: identity.role, database: identity.db, history: Boolean(identity.has_history), files: [] };
for (const item of request.files ?? []) {
  const file = String(item.file);
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)) fail(`invalid_file_${file}`);
  const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
  const sha = createHash("sha256").update(sql).digest("hex");
  if (sha !== item.sha256) fail(`sha256_mismatch_${file}`);
  const version = file.slice(0, 14);
  if (applied.has(version)) { report.files.push({ file, status: "already_applied" }); continue; }
  if (request.mode === "verify") { report.files.push({ file, status: "ready" }); continue; }
  const record = identity.has_history
    ? `\ninsert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${file.slice(15, -4)}') on conflict do nothing;`
    : "";
  try {
    // No BEGIN/COMMIT: a multi-statement simple query runs as one transaction and rolls back on error.
    // Same owner as earlier migrations: run as postgres for this transaction only.
    await query(`set local role postgres;\n${sql}\n${record}`);
    report.files.push({ file, status: "applied" });
  } catch (error) {
    report.ok = false;
    report.files.push({ file, status: "failed_rolled_back", error: error instanceof Error ? error.message : "failed" });
    break;
  }
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
