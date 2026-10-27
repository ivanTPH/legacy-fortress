#!/usr/bin/env node
// Read-only Coolify/TEST evidence. Never emit API bodies, credentials or SQL rows.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TARGET = Object.freeze({
  project: "My first project",
  environment: "staging_legacy_fortress",
  appUuid: "yka9huzmm56hjpz1gno448fb",
  appName: "Legacy Fortress Staging",
  serviceUuid: "wdf2fyo7hrewev6hnqypd2vc",
  serviceName: "Legacy Fortress Staging Supabase",
  dataVolume: "wdf2fyo7hrewev6hnqypd2vc_supabase-db-data",
  configVolume: "wdf2fyo7hrewev6hnqypd2vc_supabase-db-config",
  appUrl: "https://test.mylegacyfortress.com",
  branch: "hosted-uat-preparation-20260715",
  securityVersion: "20261027070000",
  titleVersion: "20261027071500",
});

const asArray = (value, key) => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
const requireOne = (values, predicate, label) => {
  const found = values.filter(predicate);
  if (found.length !== 1) throw new Error(`${label}: expected exactly one matching TEST resource`);
  return found[0];
};
const sameId = (a, b) => String(a ?? "") !== "" && String(a) === String(b ?? "");

export function apiOrigin(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Coolify read URL must be a bare HTTPS origin");
  }
  if (url.hostname === "app.coolify.io" || url.hostname === "legacy-fortress.vercel.app") {
    throw new Error("Coolify read URL is not the approved self-hosted TEST control plane");
  }
  return url.origin;
}

export async function inspectCoolify({ baseUrl, token, fetchImpl = fetch }) {
  const origin = apiOrigin(baseUrl);
  if (!token) throw new Error("COOLIFY_READ_TOKEN is required");
  async function get(path) {
    const response = await fetchImpl(`${origin}/api/v1${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Coolify GET ${path} returned HTTP ${response.status}`);
    return response.json();
  }
  const project = requireOne(asArray(await get("/projects"), "data"), (item) => item.name === TARGET.project, "project");
  const environment = await get(`/projects/${encodeURIComponent(project.uuid)}/${TARGET.environment}`);
  if (environment.name !== TARGET.environment || !environment.id) throw new Error("Coolify environment identity mismatch");
  const app = await get(`/applications/${TARGET.appUuid}`);
  if (app.uuid !== TARGET.appUuid || app.name !== TARGET.appName || !sameId(app.environment_id, environment.id)
      || app.git_branch !== TARGET.branch || !String(app.fqdn ?? "").includes(TARGET.appUrl)) {
    throw new Error("TEST application identity mismatch");
  }
  const service = await get(`/services/${TARGET.serviceUuid}`);
  if (service.uuid !== TARGET.serviceUuid || service.name !== TARGET.serviceName
      || !sameId(service.environment_id, environment.id) || !sameId(service.server_id, app.server_id)) {
    throw new Error("TEST Supabase service identity mismatch");
  }
  const components = asArray(await get(`/services/${TARGET.serviceUuid}/databases`), "data");
  const database = requireOne(components, (item) => item.name === "supabase-db" || item.human_name === "supabase-db", "PostgreSQL component");
  if (!database.uuid) throw new Error("PostgreSQL component UUID missing");
  if (!/^running/i.test(String(database.status ?? ""))) throw new Error("TEST PostgreSQL component is not confirmed running");
  const storage = await get(`/services/${TARGET.serviceUuid}/storages`);
  const volumes = asArray(storage?.persistent_storages, "data").map((item) => ({ name: item.name, mount: item.mount_path }));
  if (!volumes.some((item) => item.name === TARGET.dataVolume && item.mount === "/var/lib/postgresql/data")
      || !volumes.some((item) => item.name === TARGET.configVolume && item.mount === "/etc/postgresql-custom")) {
    throw new Error("TEST PostgreSQL persistent volume mapping mismatch");
  }
  const backupConfigs = asArray(await get(`/databases/${database.uuid}/backups`), "data");
  const enabled = backupConfigs.filter((item) => item.enabled === true);
  const backup = requireOne(enabled, () => true, "enabled PostgreSQL backup schedule");
  if (!backup.uuid) throw new Error("Backup schedule UUID missing");
  const executionResponse = await get(`/databases/${database.uuid}/backups/${backup.uuid}/executions`);
  const executions = asArray(executionResponse, "executions");
  const successful = executions.filter((item) => /success|completed/i.test(String(item.status ?? "")))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const deployments = asArray(await get(`/deployments/applications/${TARGET.appUuid}?take=1`), "data");
  const latest = deployments[0] ?? null;
  return {
    projectUuid: project.uuid,
    environment: environment.name,
    appUuid: app.uuid,
    appBranch: app.git_branch,
    appDeploySha: latest?.git_commit_sha ?? app.git_commit_sha ?? null,
    serviceUuid: service.uuid,
    databaseUuid: database.uuid,
    databaseStatus: database.status ?? null,
    containerName: database.container_name ?? null,
    containerVerified: database.container_name === `supabase-db-${TARGET.serviceUuid}`,
    volumes,
    backup: { enabled: true, scheduleUuid: backup.uuid, executions: executions.length,
      latestSuccessful: successful[0] ? { uuid: successful[0].uuid, at: successful[0].created_at, bytes: Number(successful[0].size ?? 0) } : null },
  };
}

const SQL = `SELECT jsonb_build_object(
  'database', current_database(),
  'migrations', COALESCE((SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations), '[]'::jsonb),
  'asset_legacy_fallback', position('contact_links' in pg_get_functiondef('public.linked_grant_allows_asset(uuid,uuid)'::regprocedure)) > 0,
  'record_legacy_fallback', position('record_contacts' in pg_get_functiondef('public.linked_grant_allows_record(uuid,uuid)'::regprocedure)) > 0,
  'asset_explicit_scope', position('asset_ids' in pg_get_functiondef('public.linked_grant_allows_asset(uuid,uuid)'::regprocedure)) > 0,
  'record_explicit_scope', position('record_ids' in pg_get_functiondef('public.linked_grant_allows_record(uuid,uuid)'::regprocedure)) > 0,
  'linked_policies', (SELECT jsonb_object_agg(schemaname || '.' || tablename || '.' || policyname, qual) FROM pg_policies
    WHERE policyname IN ('assets_linked_select','records_linked_select','documents_linked_select','attachments_linked_select','vault_docs_linked_select')),
  'display_title', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='display_title'),
  'title_guard', EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.documents'::regclass AND tgname='documents_protect_original' AND NOT tgisinternal),
  'title_audit', EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.documents'::regclass AND tgname='documents_display_title_audit' AND NOT tgisinternal)
)::text;`;

export function inspectDatabase(env = process.env, run = execFileSync) {
  const required = ["TEST_DB_RO_HOST", "TEST_DB_RO_PORT", "TEST_DB_RO_NAME", "TEST_DB_RO_USER", "TEST_DB_RO_PASSWORD"];
  if (required.some((key) => !env[key])) throw new Error(`Read-only TEST database connection unavailable (${required.join(", ")})`);
  const pgEnv = { ...env, PGHOST: env.TEST_DB_RO_HOST, PGPORT: env.TEST_DB_RO_PORT,
    PGDATABASE: env.TEST_DB_RO_NAME, PGUSER: env.TEST_DB_RO_USER,
    PGPASSWORD: env.TEST_DB_RO_PASSWORD, PGOPTIONS: "-c default_transaction_read_only=on" };
  const call = (sql) => String(run("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: pgEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000 })).trim();
  const details = JSON.parse(call(SQL));
  let clusterId = null;
  try { clusterId = call("SELECT system_identifier::text FROM pg_control_system();"); } catch { /* A restricted role may not have this catalogue privilege. */ }
  if (details.database !== "postgres" || (clusterId && !/^\d+$/.test(clusterId))) throw new Error("TEST database or cluster identity mismatch");
  return { ...details, clusterId };
}

export function verifiedRestore(source, latestBackupUuid, testClusterId) {
  if (!source || !latestBackupUuid || !testClusterId) return false;
  let evidence;
  try { evidence = JSON.parse(source.startsWith("{") ? source : readFileSync(source, "utf8")); } catch { return false; }
  const age = Date.now() - Date.parse(evidence.restoredAt ?? "");
  return evidence.backupExecutionUuid === latestBackupUuid && evidence.result === "passed"
    && typeof evidence.operator === "string" && evidence.operator.length > 1
    && /^\d+$/.test(String(evidence.targetClusterId ?? ""))
    && String(evidence.targetClusterId) !== String(testClusterId)
    && Number.isFinite(age) && age >= 0 && age < 30 * 24 * 60 * 60 * 1000;
}

export function summarize({ coolify, database, githubSha, liveSha, productionClusterId = null, restoreVerified = false, databaseInspection = "unavailable" }) {
  const versions = database?.migrations ?? [];
  const separated = Boolean(database?.clusterId && productionClusterId && database.clusterId !== productionClusterId);
  const securityState = versions.includes(TARGET.securityVersion) ? "recorded" : "pending";
  const titleState = versions.includes(TARGET.titleVersion) ? "recorded" : "pending";
  const legacyPresent = Boolean(database?.asset_legacy_fallback && database?.record_legacy_fallback);
  const explicitPresent = Boolean(database?.asset_explicit_scope && database?.record_explicit_scope);
  const securitySecure = explicitPresent && !database?.asset_legacy_fallback && !database?.record_legacy_fallback;
  const titleObjects = Boolean(database?.display_title && database?.title_guard && database?.title_audit);
  const titleAbsent = Boolean(database && !database.display_title && !database.title_guard && !database.title_audit);
  const schemaMatchesHistory = Boolean(database && explicitPresent
    && (securityState === "recorded" ? securitySecure : legacyPresent)
    && (titleState === "recorded" ? titleObjects : titleAbsent));
  const ready = Boolean(coolify?.containerVerified && database && separated && restoreVerified
    && coolify.backup.latestSuccessful && schemaMatchesHistory);
  return {
    status: ready ? "READ_ONLY_PRECHECK_PASSED_WRITES_STILL_REQUIRE_APPROVAL" : "BLOCKED",
    environment: coolify ? { projectUuid: coolify.projectUuid, name: coolify.environment,
      appUuid: coolify.appUuid, serviceUuid: coolify.serviceUuid, databaseUuid: coolify.databaseUuid,
      containerName: coolify.containerName, containerVerified: coolify.containerVerified, volumes: coolify.volumes } : null,
    sha: { githubStaging: githubSha, coolifyDeployment: coolify?.appDeploySha ?? null, live: liveSha },
    database: database ? { name: database.database, clusterId: database.clusterId, productionSeparated: separated,
      migrations: { security: securityState, documentTitles: titleState }, schemaMatchesHistory } : null,
    databaseInspection,
    backup: coolify?.backup ?? null,
    recovery: { isolatedRestoreVerified: restoreVerified },
    security: { hostedSyntheticVerification: "not_run" },
  };
}

async function main() {
  const token = process.env.COOLIFY_READ_TOKEN;
  const baseUrl = process.env.COOLIFY_READ_URL;
  if (!token || !baseUrl) throw new Error("Approved Coolify read-only URL/token unavailable");
  const coolify = await inspectCoolify({ baseUrl, token });
  const version = await (await fetch(`${TARGET.appUrl}/api/version`, { signal: AbortSignal.timeout(10000) })).json();
  if (version.env !== "staging" || !/^[0-9a-f]{40}$/.test(String(version.commitSha ?? ""))) throw new Error("Live TEST version identity mismatch");
  const githubSha = String(execFileSync("git", ["ls-remote", "origin", `refs/heads/${TARGET.branch}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000 })).split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(githubSha)) throw new Error("GitHub staging SHA unavailable");
  let database = null;
  let databaseInspection = "unavailable";
  try { database = inspectDatabase(); databaseInspection = database.clusterId ? "read_only_complete" : "cluster_id_unavailable"; }
  catch { /* Report unavailable; never emit psql errors or credentials. */ }
  const restoreVerified = verifiedRestore(process.env.TEST_RESTORE_EVIDENCE_JSON || process.env.TEST_RESTORE_EVIDENCE_PATH,
    coolify.backup.latestSuccessful?.uuid, database?.clusterId);
  const report = summarize({ coolify, database, githubSha, liveSha: version.commitSha,
    productionClusterId: process.env.PRODUCTION_DB_CLUSTER_ID ?? null,
    restoreVerified, databaseInspection });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status === "BLOCKED") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`TEST infrastructure verification blocked: ${error.message}\n`);
    process.exitCode = 2;
  });
}
