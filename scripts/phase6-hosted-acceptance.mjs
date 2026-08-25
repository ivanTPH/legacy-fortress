#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REQUIRED_BASE = "https://test.mylegacyfortress.com";
const REQUIRED_SUPABASE = "https://supabase-test.mylegacyfortress.com";
const evidencePath = process.env.PHASE6_EVIDENCE_JSON || path.join(os.tmpdir(), "legacy-fortress-phase6-evidence.json");
const logPath = process.env.PHASE6_EVIDENCE_LOG || path.join(os.tmpdir(), "legacy-fortress-phase6-evidence.log");
const evidence = [];

function record(batch, assertion, result, classification, details = {}) {
  const item = {
    timestamp: new Date().toISOString(),
    batch,
    assertion,
    result,
    classification,
    ...details,
  };
  evidence.push(item);
  fs.appendFileSync(logPath, `${JSON.stringify(item)}\n`);
}

function requireStaging() {
  const base = process.env.BASE_URL || "";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const forbidden = /legacy-fortress\.vercel\.app|\.supabase\.co/i;
  if (base !== REQUIRED_BASE || supabase !== REQUIRED_SUPABASE || forbidden.test(`${base} ${supabase}`)) {
    throw new Error("Refusing Phase 6 run: staging targets are not proven.");
  }
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (!process.env[key]) throw new Error(`Missing required staging variable: ${key}`);
  }
}

function runChild(batch, script, extraEnv = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code, signal) => {
      const ok = code === 0;
      record(batch, script, ok ? "PASS" : "FAIL", ok ? "" : "HARNESS DEFECT", {
        exitCode: code,
        signal,
        durationMs: Date.now() - started,
        output: stdout.slice(-4000),
        error: stderr.slice(-2000),
      });
      resolve(ok);
    });
    child.on("error", (error) => {
      record(batch, script, "BLOCKED", "TEST-ENVIRONMENT DEFECT", { error: error.message });
      resolve(false);
    });
  });
}

async function main() {
  fs.writeFileSync(logPath, "", { mode: 0o600 });
  requireStaging();
  record("Safety", "staging target and required credentials", "PASS", "");

  const version = await fetch(`${REQUIRED_BASE}/api/version`).then((response) => response.json()).catch(() => null);
  record("Safety", "deployed application version", version ? "PASS" : "BLOCKED", version ? "" : "TEST-ENVIRONMENT DEFECT", {
    deployedSha: version?.commitSha || version?.version || null,
  });

  const jobs = [
    ["Batch G", "scripts/smoke-contacts-invitations.mjs", { SMOKE_CLEANUP_ON_EXIT: "1" }],
  ];
  if (process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD) {
    jobs.push(["Batch A/B", "scripts/smoke-invitation-linked-access.mjs", {}]);
    jobs.push(["Batch E", "scripts/smoke-admin-ops.mjs", {}]);
  } else {
    record("Batch A/B/E", "authenticated owner/admin credentials", "BLOCKED", "TEST-ENVIRONMENT DEFECT", {
      reason: "E2E_USER_EMAIL/E2E_USER_PASSWORD are not present in the staging execution context",
    });
  }

  for (const [batch, script, env] of jobs) await runChild(batch, script, env);

  for (const batch of ["Batch A", "Batch B", "Batch C", "Batch D", "Batch E", "Batch F", "Batch G"]) {
    if (!evidence.some((item) => item.batch === batch || item.batch.startsWith(`${batch}/`))) {
      record(batch, "independent hosted acceptance coverage", "BLOCKED", "TEST-ENVIRONMENT DEFECT", {
        reason: "No canonical executable child smoke is configured for this batch",
      });
    }
  }

  fs.writeFileSync(evidencePath, JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2), { mode: 0o600 });
  const failures = evidence.filter((item) => item.result === "FAIL" || item.result === "BLOCKED");
  console.log(JSON.stringify({ evidencePath, logPath, assertions: evidence.length, failures: failures.length }));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  record("Safety", "runner startup", "BLOCKED", "TEST-ENVIRONMENT DEFECT", { error: error.message });
  fs.writeFileSync(evidencePath, JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2), { mode: 0o600 });
  console.error(error.message);
  process.exitCode = 1;
});
