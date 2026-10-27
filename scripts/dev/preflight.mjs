#!/usr/bin/env node
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectBootstrap } from "./bootstrap.mjs";
import { inspectCoolify, inspectDatabase, summarize, verifiedRestore } from "../staging/verify-test-infrastructure.mjs";

const CACHE = resolve(".local-state/staging-preflight.json");
const safeError = (error) => String(error?.message ?? "unavailable").replace(/https?:\/\/[^\s]+/g, "[redacted URL]");
export function firstBlocker(state) {
  if (state.bootstrapError) return `Repository, staging or live TEST identity: ${state.bootstrapError}`;
  if (state.bootstrap.dirty) return "Working tree is dirty; use an isolated clean release worktree.";
  if (state.bootstrap.pendingFeatureBranches.some((item) => !item.remoteMatchesTracker)) return "Feature branch SHA differs from capability tracker; reconcile before release.";
  if (!state.coolify) return "Map an existing read-only Coolify token and TEST control-plane URL in the protected diagnostic environment.";
  if (!state.coolify.containerVerified) return "TEST PostgreSQL container identity does not match the approved Supabase service.";
  if (state.coolify.appDeploySha && state.coolify.appDeploySha !== state.bootstrap.liveTestSha) return "Coolify deployment SHA and live TEST /api/version differ.";
  if (!state.database) return "Provide a separate read-only TEST PostgreSQL connection to verify migration history and RLS schema.";
  if (!state.database.clusterId || !state.productionClusterId || state.database.clusterId === state.productionClusterId)
    return "Prove TEST and production have distinct PostgreSQL cluster identities.";
  if (!state.coolify.backup.latestSuccessful) return "Verify a successful TEST database backup.";
  if (!state.restoreVerified) return "Demonstrate an isolated restore of the latest TEST backup and record evidence.";
  if (!state.summary.database?.schemaMatchesHistory) return "Migration history and current RLS/title schema drift; inspect privately before any write.";
  if (state.historyDrift) return "Repository SQL versions and hosted migration history drift; reconcile privately before any write.";
  return null;
}
export async function collectPreflight({ bootstrap = collectBootstrap, coolify = inspectCoolify, database = inspectDatabase, env = process.env } = {}) {
  const state = { checkedAt: new Date().toISOString(), bootstrap: null, coolify: null, database: null,
    productionClusterId: env.PRODUCTION_DB_CLUSTER_ID || null, restoreVerified: false, summary: null };
  try { state.bootstrap = await bootstrap(); } catch (error) { state.bootstrapError = safeError(error); }
  if (state.bootstrap && env.COOLIFY_READ_URL && env.COOLIFY_READ_TOKEN) {
    try { state.coolify = await coolify({ baseUrl: env.COOLIFY_READ_URL, token: env.COOLIFY_READ_TOKEN }); }
    catch (error) { state.coolifyError = safeError(error); }
  }
  if (state.coolify) {
    try { state.database = database(env); } catch { state.databaseError = "Read-only PostgreSQL inspection unavailable"; }
    state.restoreVerified = verifiedRestore(env.TEST_RESTORE_EVIDENCE_JSON || env.TEST_RESTORE_EVIDENCE_PATH,
      state.coolify.backup.latestSuccessful?.uuid, state.database?.clusterId);
    state.summary = summarize({ coolify: state.coolify, database: state.database,
      githubSha: state.bootstrap.stagingSha, liveSha: state.bootstrap.liveTestSha,
      productionClusterId: state.productionClusterId, restoreVerified: state.restoreVerified });
    if (state.database) {
      const local = readdirSync(resolve("supabase/migrations")).filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).map((name) => name.slice(0, 14));
      const hosted = state.database.migrations;
      const allowedPending = ["20261027070000", "20261027071500"];
      state.pendingMigrations = local.filter((version) => !hosted.includes(version));
      state.historyDrift = hosted.some((version) => !local.includes(version)) || state.pendingMigrations.some((version) => !allowedPending.includes(version));
    }
  }
  const blocker = firstBlocker(state);
  const result = { checkedAt: state.checkedAt, status: blocker ? "BLOCKED" : "READ_ONLY_READY_APPROVAL_REQUIRED",
    blocker, repository: state.bootstrap?.repository ?? null, branch: state.bootstrap?.branch ?? null,
    head: state.bootstrap?.head ?? null, stagingSha: state.bootstrap?.stagingSha ?? null,
    liveTestSha: state.bootstrap?.liveTestSha ?? null, testApplication: state.coolify?.appUuid ?? null,
    testService: state.coolify?.serviceUuid ?? null, testDatabase: state.coolify?.databaseUuid ?? null,
    testClusterId: state.database?.clusterId ?? null,
    productionSeparated: Boolean(state.database?.clusterId && state.productionClusterId && state.database.clusterId !== state.productionClusterId),
    migrationHistory: state.database?.migrations ?? null,
    pendingMigrations: state.pendingMigrations ?? null,
    historyDrift: state.historyDrift ?? null,
    schemaMatchesHistory: state.summary?.database?.schemaMatchesHistory ?? null,
    backup: state.coolify?.backup ?? null, isolatedRestoreVerified: state.restoreVerified,
    securityGateRequirements: ["exact SQL checksum and owner approval", "focused hosted RLS checks", "protected application release IDV and Admin checks"],
    cacheUse: "report only; revalidate all identity and recovery evidence before writes" };
  mkdirSync(resolve(".local-state"), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  collectPreflight().then((result) => {
    process.stdout.write(`${process.argv.includes("--json") ? JSON.stringify(result, null, 2) : `${result.status}\n${result.blocker ?? "Read-only evidence complete; exact migration approval still required."}\nStaging: ${result.stagingSha}\nLive TEST: ${result.liveTestSha}`}\n`);
    if (result.status === "BLOCKED") process.exitCode = 2;
  }).catch(() => { process.stderr.write("Preflight blocked: inspection failed safely\n"); process.exitCode = 2; });
}
