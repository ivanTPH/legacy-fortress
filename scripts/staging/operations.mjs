#!/usr/bin/env node

/* Allowlisted staging operations. Secrets stay in the process environment. */
import { spawn } from "node:child_process";

const STAGING = Object.freeze({
  appUuid: "yka9huzmm56hjpz1gno448fb",
  branch: "hosted-uat-preparation-20260715",
  baseUrl: "https://test.mylegacyfortress.com",
  supabaseUrl: "https://supabase-test.mylegacyfortress.com",
});

const COOLIFY_API_PREFIX = "/api/v1";
const command = process.argv[2] ?? "status";

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function assertExact(name, actual, expected) {
  if (actual !== expected) throw new Error(`${name}_must_equal_approved_staging_value`);
}

function assertStagingEnvironment() {
  assertExact("BASE_URL", required("BASE_URL").replace(/\/$/, ""), STAGING.baseUrl);
  assertExact("NEXT_PUBLIC_SUPABASE_URL", required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""), STAGING.supabaseUrl);
  assertExact("APP_ENV", required("APP_ENV"), "staging");
  assertExact("LEGACY_FORTRESS_ENV", required("LEGACY_FORTRESS_ENV"), "staging");
  assertExact("LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE", required("LEGACY_FORTRESS_ALLOW_STAGING_ACCEPTANCE"), "true");
}

function assertCoolifyTarget() {
  const base = required("COOLIFY_BASE_URL").replace(/\/$/, "");
  if (!/^https:\/\//i.test(base) || /production|prod|live/i.test(base)) {
    throw new Error("coolify_target_is_not_an_approved_control_plane");
  }
  required("COOLIFY_API_TOKEN");
  return base;
}

async function coolify(path, options = {}) {
  const base = assertCoolifyTarget();
  const response = await fetch(`${base}${COOLIFY_API_PREFIX}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.COOLIFY_API_TOKEN}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) throw new Error(`coolify_${response.status}_${body.message ?? body.error ?? "request_failed"}`);
  return body;
}

async function liveVersion() {
  const response = await fetch(`${STAGING.baseUrl}/api/version`, { cache: "no-store" });
  if (!response.ok) throw new Error(`staging_version_http_${response.status}`);
  const version = await response.json();
  if (version.env !== "staging") throw new Error("staging_version_environment_mismatch");
  return version;
}

function reportVersion(version) {
  console.log(JSON.stringify({ env: version.env, commitSha: version.commitSha, buildId: version.buildId }, null, 2));
}

async function status() {
  const app = await coolify(`/applications/${STAGING.appUuid}`);
  assertExact("coolify_application_uuid", app.uuid, STAGING.appUuid);
  assertExact("coolify_application_branch", app.git_branch, STAGING.branch);
  const version = await liveVersion();
  console.log(JSON.stringify({
    application: STAGING.appUuid,
    branch: app.git_branch,
    coolifyStatus: app.status ?? "unknown",
    staging: { env: version.env, commitSha: version.commitSha },
  }, null, 2));
}

async function deploy(expectedSha) {
  if (process.env.STAGING_DEPLOY_APPROVED !== "true") throw new Error("staging_deploy_approval_missing");
  const app = await coolify(`/applications/${STAGING.appUuid}`);
  assertExact("coolify_application_uuid", app.uuid, STAGING.appUuid);
  assertExact("coolify_application_branch", app.git_branch, STAGING.branch);
  await coolify(`/deploy?uuid=${encodeURIComponent(STAGING.appUuid)}`, { method: "POST" });
  console.log(JSON.stringify({ deployment: "requested", application: STAGING.appUuid, expectedSha }, null, 2));
}

async function waitForSha(expectedSha) {
  const deadline = Date.now() + 20 * 60 * 1000;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await liveVersion();
      if (last.commitSha === expectedSha) {
        reportVersion(last);
        return;
      }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : "unreachable" };
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`staging_sha_not_live:${last?.commitSha ?? last?.error ?? "unknown"}`);
}

async function ensureDeployment(expectedSha) {
  try {
    const current = await liveVersion();
    if (current.commitSha === expectedSha) {
      reportVersion(current);
      return;
    }
  } catch {
    // A deployment may still be starting; the guarded Coolify request below is the recovery path.
  }
  await deploy(expectedSha);
  await waitForSha(expectedSha);
}

function runAcceptance(expectedSha) {
  assertStagingEnvironment();
  assertExact("EXPECTED_STAGING_SHA", required("EXPECTED_STAGING_SHA"), expectedSha);
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  required("SUPABASE_SERVICE_ROLE_KEY");
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "staging:acceptance:idv"], { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`staging_acceptance_failed:${code ?? signal}`));
    });
  });
}

async function main() {
  if (!["status", "deploy", "verify", "acceptance", "release"].includes(command)) throw new Error("unsupported_staging_operation");
  const expectedSha = required("EXPECTED_STAGING_SHA");
  if (command === "status") return status();
  if (command === "deploy") await deploy(expectedSha);
  if (command === "deploy") return;
  if (command === "release") await ensureDeployment(expectedSha);
  if (command === "verify") await waitForSha(expectedSha);
  if (command === "acceptance" || command === "release") return runAcceptance(expectedSha);
}

main().catch((error) => {
  console.error(`staging_operations_failed:${error instanceof Error ? error.message : "unknown"}`);
  process.exitCode = 1;
});
