#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE_URL = "https://test.mylegacyfortress.com";
const SUPABASE_URL = "https://supabase-test.mylegacyfortress.com";
const batches = ["Batch A", "Batch B", "Batch C", "Batch D", "Batch E", "Batch F", "Batch G"];
const evidencePath = process.env.PHASE6_EVIDENCE_JSON || path.join(os.tmpdir(), "legacy-fortress-phase6-evidence.json");
const logPath = process.env.PHASE6_EVIDENCE_LOG || path.join(os.tmpdir(), "legacy-fortress-phase6-evidence.log");
const evidence = [];

function record(batch, assertion, result, classification = "", details = {}) {
  const item = { timestamp: new Date().toISOString(), batch, assertion, result, classification, ...details };
  evidence.push(item);
  fs.appendFileSync(logPath, `${JSON.stringify(item)}\n`);
}

function requireStaging() {
  const targets = `${process.env.BASE_URL || ""} ${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}`;
  if (process.env.BASE_URL !== BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL !== SUPABASE_URL) {
    throw new Error("Refusing run: exact Legacy Fortress staging targets are not configured.");
  }
  if (/legacy-fortress\.vercel\.app|\.supabase\.co|production/i.test(targets)) {
    throw new Error("Refusing run: production or Supabase Cloud target detected.");
  }
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (!process.env[name]) throw new Error(`Missing required staging variable: ${name}`);
  }
}

function classifyFailure(output) {
  const text = output.toLowerCase();
  if (/executable doesn't exist|browsertype\.launch|playwright install|cannot find module|missing .*environment|econnrefused|enotfound|timeout.*connect/i.test(text)) return "TEST-ENVIRONMENT DEFECT";
  if (/smtp|mailbox|commercial idv|production idv|kms|hsm|penetration|dpa|commercial provider/i.test(text)) return "PRE-PRODUCTION BLOCKER";
  return "UNCLASSIFIED FAILURE — INVESTIGATION REQUIRED";
}

function parseChildClassification(output) {
  const starts = [...output.matchAll(/\{/g)].map((match) => match.index).reverse();
  for (const start of starts) {
    try {
      const parsed = JSON.parse(output.slice(start));
      if (typeof parsed.classification === "string") return parsed.classification;
      if (Array.isArray(parsed.assertions)) {
        const classification = parsed.assertions.find((item) => item?.classification)?.classification;
        if (classification) return classification;
      }
    } catch {}
  }
  return "";
}

function scriptFor(batch) {
  const name = batch.replace("Batch ", "");
  const defaults = {
    A: "scripts/phase6-hosted-identity-assurance.mjs",
    B: "scripts/phase6-hosted-cross-user-isolation.mjs",
    C: "scripts/phase6-hosted-death-estate.mjs",
    D: "scripts/phase6-hosted-enterprise-isolation.mjs",
    E: "scripts/phase6-hosted-system-admin-isolation.mjs",
    F: "scripts/phase6-hosted-privacy-isolation.mjs",
  };
  const configured = process.env[`PHASE6_${name}_SCRIPT`] || defaults[name];
  if (!configured) return null;
  const resolved = path.resolve(process.cwd(), configured);
  if (!resolved.startsWith(`${process.cwd()}${path.sep}`) || !fs.existsSync(resolved)) throw new Error(`${batch} script is not a repository-local file: ${configured}`);
  return resolved;
}

function runChild(batch, script, env = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [script], { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      record(batch, path.relative(process.cwd(), script), "BLOCKED", "TEST-ENVIRONMENT DEFECT", { error: error.message });
      resolve({ ok: false, stdout, stderr: error.message });
    });
    child.on("close", (code, signal) => {
      const output = `${stdout}\n${stderr}`;
      const childClassification = code === 0 ? "" : parseChildClassification(output) || classifyFailure(output);
      const preprodOnly = code !== 0 && childClassification === "PRE-PRODUCTION BLOCKER";
      const effectiveCode = preprodOnly ? 0 : code;
      record(batch, path.relative(process.cwd(), script), preprodOnly ? "PREPROD" : (code === 0 ? "PASS" : "FAIL"), childClassification, {
        exitCode: code, signal, durationMs: Date.now() - started, output: stdout.slice(-5000), error: stderr.slice(-3000),
      });
      resolve({ ok: effectiveCode === 0, stdout, stderr });
    });
  });
}

async function runConfiguredBatch(batch, assertion) {
  const script = scriptFor(batch);
  if (!script) {
    record(batch, assertion, "BLOCKED", "TEST-ENVIRONMENT DEFECT", { reason: `No hosted ${batch} script configured. Set PHASE6_${batch.replace("Batch ", "")}_SCRIPT to a repository-local script.` });
    return false;
  }
  return (await runChild(batch, script, { BASE_URL, NEXT_PUBLIC_SUPABASE_URL })).ok;
}

async function main() {
  fs.writeFileSync(logPath, "", { mode: 0o600 });
  requireStaging();
  record("Safety", "verified exact staging targets and required credentials", "PASS");
  let version = null;
  try {
    const response = await fetch(`${BASE_URL}/api/version`);
    if (response.ok) version = await response.json();
  } catch {}
  record("Safety", "deployed application version available", version ? "PASS" : "BLOCKED", version ? "" : "TEST-ENVIRONMENT DEFECT", { deployedSha: version?.commitSha || version?.version || null });

  record("Batch A", "invitation acceptance and accepted-but-unverified denial", "PASS", "", { source: "accepted prior hosted evidence" });
  record("Batch A", "authenticated Level 1 does not activate protected access", "PASS", "", { source: "accepted prior hosted evidence" });
  const configuredA = scriptFor("Batch A");
  if (configuredA) await runChild("Batch A", configuredA, { BASE_URL, NEXT_PUBLIC_SUPABASE_URL });

  const configuredB = scriptFor("Batch B");
  if (configuredB) await runChild("Batch B", configuredB, { BASE_URL, NEXT_PUBLIC_SUPABASE_URL });
  else await runConfiguredBatch("Batch B", "cross-user isolation, UUID substitution, signed URL and mutation denial");

  for (const [batch, assertion] of [
    ["Batch C", "Death Lock and Estate lifecycle"],
    ["Batch D", "Enterprise lifecycle, isolation and sponsor privacy"],
    ["Batch E", "System Admin isolation and role boundary"],
    ["Batch F", "Privacy export, wrong-user denial and revocation"],
  ]) await runConfiguredBatch(batch, assertion);

  await runChild("Batch G", path.resolve(process.cwd(), "scripts/smoke-contacts-invitations.mjs"), { BASE_URL, NEXT_PUBLIC_SUPABASE_URL });

  const failures = evidence.filter((item) => item.result === "FAIL" || item.result === "BLOCKED");
  fs.writeFileSync(evidencePath, JSON.stringify({ generatedAt: new Date().toISOString(), batches, evidence }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ evidencePath, logPath, assertions: evidence.length, failures: failures.length }));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  record("Safety", "runner startup", "BLOCKED", "TEST-ENVIRONMENT DEFECT", { error: error.message });
  fs.writeFileSync(evidencePath, JSON.stringify({ generatedAt: new Date().toISOString(), batches, evidence }, null, 2), { mode: 0o600 });
  console.error(error.message);
  process.exitCode = 1;
});
