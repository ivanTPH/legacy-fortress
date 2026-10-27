#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REPO = "ivanTPH/legacy-fortress";
export const STAGING = "hosted-uat-preparation-20260715";
const SHA = /^[0-9a-f]{40}$/;
const run = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000 }).trim();
export function repoIdentity(url) {
  return /^https:\/\/github\.com\/ivanTPH\/legacy-fortress(?:\.git)?$/.test(url)
    || /^git@github\.com:ivanTPH\/legacy-fortress(?:\.git)?$/.test(url);
}
export function remoteHeads(output) {
  return Object.fromEntries(output.split("\n").filter(Boolean).map((line) => {
    const [sha, ref] = line.split(/\s+/);
    if (!SHA.test(sha) || !ref?.startsWith("refs/heads/")) throw new Error("Invalid remote branch response");
    return [ref.slice(11), sha];
  }));
}
export async function collectBootstrap({ git = run, fetchImpl = fetch } = {}) {
  if (!repoIdentity(git("remote", "get-url", "origin"))) throw new Error("Origin is not the approved Legacy Fortress repository");
  const backlog = JSON.parse(readFileSync(resolve("docs/CAPABILITY_BACKLOG.json"), "utf8"));
  const refs = [STAGING, ...new Set(backlog.workstreams.map((item) => item.branch).filter(Boolean))];
  const heads = remoteHeads(git("ls-remote", "--heads", "origin", ...refs));
  if (!SHA.test(heads[STAGING] ?? "")) throw new Error("Remote staging SHA unavailable");
  const response = await fetchImpl("https://test.mylegacyfortress.com/api/version", { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`TEST version returned HTTP ${response.status}`);
  const live = await response.json();
  if (live.env !== "staging" || !SHA.test(String(live.commitSha ?? ""))) throw new Error("TEST version identity mismatch");
  const features = backlog.workstreams.filter((item) => item.branch).map((item) => ({
    id: item.id, branch: item.branch, expectedSha: item.sha, remoteSha: heads[item.branch] ?? null,
    remoteMatchesTracker: heads[item.branch] === item.sha,
  }));
  return { repository: REPO, branch: git("branch", "--show-current"), head: git("rev-parse", "HEAD"),
    dirty: git("status", "--porcelain").length > 0, stagingSha: heads[STAGING], liveTestSha: live.commitSha,
    pendingFeatureBranches: features, securityBlockers: backlog.securityBlockers, nextAuthorisedTask: backlog.nextAuthorisedTask };
}
export function humanBootstrap(state) {
  return [`Repository: ${state.repository}`, `Current: ${state.branch} ${state.head}${state.dirty ? " (dirty)" : ""}`,
    `Staging: ${state.stagingSha}`, `Live TEST: ${state.liveTestSha}`,
    ...state.pendingFeatureBranches.map((item) => `${item.id}: ${item.branch} ${item.remoteSha ?? "missing"}${item.remoteMatchesTracker ? "" : " (tracker review needed)"}`),
    `Security blockers: ${state.securityBlockers.join("; ")}`, `Next authorised task: ${state.nextAuthorisedTask}`].join("\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  collectBootstrap().then((state) => process.stdout.write(`${process.argv.includes("--json") ? JSON.stringify(state, null, 2) : humanBootstrap(state)}\n`))
    .catch((error) => { process.stderr.write(`Bootstrap blocked: ${error.message}\n`); process.exitCode = 2; });
}
