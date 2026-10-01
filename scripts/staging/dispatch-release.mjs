#!/usr/bin/env node

/* Dispatch the existing protected staging workflow; deployment remains in GitHub Actions. */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const OWNER = "ivanTPH";
const REPOSITORY = "legacy-fortress";
const WORKFLOW = "staging-release.yml";
const BRANCH = "hosted-uat-preparation-20260715";
const API = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
const pollMs = 10_000;
const timeoutMs = 30 * 60 * 1000;

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function validateReleaseState({ repositoryRoot, remoteUrl, currentBranch, head, worktree, originSha, expectedSha }) {
  if (repositoryRoot !== process.cwd()) throw new Error("repository_root_mismatch");
  if (remoteUrl !== `https://github.com/${OWNER}/${REPOSITORY}.git`) throw new Error("repository_remote_mismatch");
  if (currentBranch && currentBranch !== BRANCH) throw new Error("staging_branch_required");
  if (!/^[0-9a-f]{40}$/.test(expectedSha) || head !== expectedSha) throw new Error("expected_sha_must_equal_committed_head");
  if (worktree) throw new Error("clean_worktree_required");
  if (originSha !== expectedSha) throw new Error("expected_sha_must_be_pushed_to_origin");
}

function assertRepository(expectedSha) {
  validateReleaseState({
    repositoryRoot: git("rev-parse", "--show-toplevel"),
    remoteUrl: git("config", "--get", "remote.origin.url"),
    currentBranch: git("branch", "--show-current"),
    head: git("rev-parse", "HEAD"),
    worktree: git("status", "--porcelain"),
    originSha: git("rev-parse", `origin/${BRANCH}`),
    expectedSha,
  });
}

function token() {
  const value = String(process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "").trim();
  if (!value) throw new Error("missing_GITHUB_TOKEN_or_GH_TOKEN");
  return value;
}

async function github(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.text();
  let parsed = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = {}; }
  if (!response.ok) throw new Error(`github_${response.status}_${parsed.message ?? "request_failed"}`);
  return parsed;
}

async function dispatch(expectedSha) {
  await github(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: BRANCH, inputs: { expected_sha: expectedSha } }),
  });
  const startedAfter = new Date().toISOString();
  console.log(JSON.stringify({ workflow: WORKFLOW, branch: BRANCH, expectedSha, dispatched: true }));
  return startedAfter;
}

async function findRun(expectedSha, startedAfter) {
  const result = await github(`/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&branch=${encodeURIComponent(BRANCH)}&per_page=20`);
  return (result.workflow_runs ?? []).find((run) => run.head_sha === expectedSha && run.created_at >= startedAfter);
}

async function summarizeFailure(runId) {
  const result = await github(`/actions/runs/${runId}/jobs?per_page=100`);
  return (result.jobs ?? []).flatMap((job) => (job.steps ?? [])
    .filter((step) => step.conclusion === "failure")
    .map((step) => ({ job: job.name, step: step.name, conclusion: step.conclusion })));
}

async function waitForRun(expectedSha, startedAfter) {
  const deadline = Date.now() + timeoutMs;
  let run;
  while (Date.now() < deadline) {
    run = await findRun(expectedSha, startedAfter);
    if (run && run.status === "completed") {
      const failedSteps = run.conclusion === "success" ? [] : await summarizeFailure(run.id);
      console.log(JSON.stringify({ runId: run.id, runUrl: run.html_url, status: run.status, conclusion: run.conclusion, failedSteps }));
      if (run.conclusion !== "success") process.exitCode = 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`workflow_timeout:${run?.id ?? "not_found"}`);
}

async function main() {
  const expectedSha = required("EXPECTED_STAGING_SHA").toLowerCase();
  assertRepository(expectedSha);
  if (process.argv.includes("--validate")) {
    console.log(JSON.stringify({ valid: true, branch: BRANCH, expectedSha, workflow: WORKFLOW }));
    return;
  }
  const startedAfter = await dispatch(expectedSha);
  await waitForRun(expectedSha, startedAfter);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`staging_release_dispatch_failed:${error instanceof Error ? error.message : "unknown"}`);
    process.exitCode = 1;
  });
}
