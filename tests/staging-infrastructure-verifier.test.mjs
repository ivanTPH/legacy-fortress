import assert from "node:assert/strict";
import test from "node:test";
import { inspectCoolify, inspectDatabase, summarize, verifiedRestore, TARGET } from "../scripts/staging/verify-test-infrastructure.mjs";

const responses = {
  "/projects": [{ uuid: "project-test", name: TARGET.project }],
  "/projects/project-test/staging_legacy_fortress": { id: 41, name: TARGET.environment },
  [`/applications/${TARGET.appUuid}`]: { uuid: TARGET.appUuid, name: TARGET.appName,
    environment_id: 41, server_id: 7, git_branch: TARGET.branch, fqdn: TARGET.appUrl },
  [`/services/${TARGET.serviceUuid}`]: { uuid: TARGET.serviceUuid, name: TARGET.serviceName,
    environment_id: 41, server_id: 7, docker_compose_raw: "SECRET-DO-NOT-REPORT" },
  [`/services/${TARGET.serviceUuid}/databases`]: [{ uuid: "test-db-component", name: "supabase-db", status: "running", container_name: `supabase-db-${TARGET.serviceUuid}` }],
  [`/services/${TARGET.serviceUuid}/storages`]: { persistent_storages: [
    { name: TARGET.dataVolume, mount_path: "/var/lib/postgresql/data" },
    { name: TARGET.configVolume, mount_path: "/etc/postgresql-custom" },
  ] },
  "/databases/test-db-component/backups": [{ uuid: "backup-schedule", enabled: true }],
  "/databases/test-db-component/backups/backup-schedule/executions": { executions: [
    { uuid: "backup-execution", status: "success", created_at: "2026-10-27T00:01:00Z", size: 1530000, filename: "PRIVATE-PATH" },
  ] },
  [`/deployments/applications/${TARGET.appUuid}?take=1`]: [{ git_commit_sha: "9db40543d01e54f211f17cb850b6112cf71cf318" }],
};
const mockFetch = (table) => async (url, options) => {
  assert.equal(options.method, "GET");
  const path = new URL(url).pathname.replace("/api/v1", "") + new URL(url).search;
  return { ok: Boolean(table[path]), status: table[path] ? 200 : 404, json: async () => table[path] };
};

test("Coolify verifier checks exact TEST resources and emits no compose or backup filename", async () => {
  const result = await inspectCoolify({ baseUrl: "https://coolify.example.test", token: "test-token", fetchImpl: mockFetch(responses) });
  assert.equal(result.databaseUuid, "test-db-component");
  assert.equal(result.backup.latestSuccessful.uuid, "backup-execution");
  assert.doesNotMatch(JSON.stringify(result), /SECRET-DO-NOT-REPORT|PRIVATE-PATH|test-token/);
});

test("Coolify verifier fails closed on wrong environment and volume", async () => {
  const wrongEnvironment = { ...responses, [`/applications/${TARGET.appUuid}`]: { ...responses[`/applications/${TARGET.appUuid}`], environment_id: 99 } };
  await assert.rejects(inspectCoolify({ baseUrl: "https://coolify.example.test", token: "test-token", fetchImpl: mockFetch(wrongEnvironment) }), /identity mismatch/);
  const wrongVolume = { ...responses, [`/services/${TARGET.serviceUuid}/storages`]: { persistent_storages: [] } };
  await assert.rejects(inspectCoolify({ baseUrl: "https://coolify.example.test", token: "test-token", fetchImpl: mockFetch(wrongVolume) }), /volume mapping mismatch/);
});

test("database probe forces read-only mode and reports migration state", () => {
  const env = { TEST_DB_RO_HOST: "test-db.internal", TEST_DB_RO_PORT: "5432", TEST_DB_RO_NAME: "postgres",
    TEST_DB_RO_USER: "reader", TEST_DB_RO_PASSWORD: "secret" };
  let calls = 0;
  const run = (binary, args, options) => {
    assert.equal(binary, "psql");
    assert.match(options.env.PGOPTIONS, /default_transaction_read_only=on/);
    assert.equal(options.env.PGUSER, "reader");
    assert.doesNotMatch(args.join(" "), /secret/);
    calls++;
    return calls === 1 ? JSON.stringify({ database: "postgres", migrations: [TARGET.securityVersion],
      asset_legacy_fallback: false, record_legacy_fallback: false, asset_explicit_scope: true,
      record_explicit_scope: true, display_title: false, title_guard: false, title_audit: false }) : "123456789";
  };
  const result = inspectDatabase(env, run);
  assert.equal(result.clusterId, "123456789");
  assert.equal(calls, 2);
});

test("readiness stays blocked without production separation and a proven restore", async () => {
  const coolify = await inspectCoolify({ baseUrl: "https://coolify.example.test", token: "test-token", fetchImpl: mockFetch(responses) });
  const database = { database: "postgres", clusterId: "123456789", migrations: [TARGET.securityVersion],
    asset_legacy_fallback: false, record_legacy_fallback: false, asset_explicit_scope: true,
    record_explicit_scope: true, display_title: false, title_guard: false, title_audit: false };
  const blocked = summarize({ coolify, database, githubSha: "a".repeat(40), liveSha: "b".repeat(40) });
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.database.migrations.documentTitles, "pending");
  const ready = summarize({ coolify, database, githubSha: "a".repeat(40), liveSha: "b".repeat(40),
    productionClusterId: "987654321", restoreVerified: true });
  assert.equal(ready.status, "READ_ONLY_PRECHECK_PASSED_WRITES_STILL_REQUIRE_APPROVAL");
  const drifted = summarize({ coolify, database: { ...database, asset_legacy_fallback: true },
    githubSha: "a".repeat(40), liveSha: "b".repeat(40), productionClusterId: "987654321", restoreVerified: true });
  assert.equal(drifted.status, "BLOCKED");
});

test("restore evidence must match the latest backup and a distinct disposable cluster", () => {
  const evidence = { backupExecutionUuid: "backup-execution", targetClusterId: "987654321",
    restoredAt: new Date().toISOString(), operator: "TEST database operator", result: "passed" };
  assert.equal(verifiedRestore(JSON.stringify(evidence), "backup-execution", "123456789"), true);
  assert.equal(verifiedRestore(JSON.stringify(evidence), "other-backup", "123456789"), false);
  assert.equal(verifiedRestore(JSON.stringify({ ...evidence, targetClusterId: "123456789" }), "backup-execution", "123456789"), false);
});
