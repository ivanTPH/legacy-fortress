#!/usr/bin/env node
// Dependency audit for the release gate.
// Fails on any moderate-or-worse advisory, with one narrow exception list: advisories that have NO fixed version yet,
// that reach only development tooling (never the app people use), each with a reason and an expiry date.
// Production dependencies must always be clean: `npm audit --omit=dev` has no exceptions.
import { execFileSync } from "node:child_process";

const DEV_ONLY_NO_FIX_YET = [
  {
    advisory: "GHSA-fc5q-39xc-vjpf",
    reason: "picomatch ReDoS (<=4.0.7, no fixed release yet). Reached only through ESLint tooling, which never ships.",
    expires: "2026-12-31",
  },
];

function audit(args) {
  try {
    return JSON.parse(execFileSync("npm", ["audit", "--json", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
    return JSON.parse(String(error.stdout || "{}"));
  }
}

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const advisoriesIn = (report) => {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === "object" && via && RANK[via.severity] >= RANK.moderate) found.set(String(via.url).split("/").pop(), via);
    }
  }
  return found;
};

const production = advisoriesIn(audit(["--omit=dev"]));
if (production.size) {
  console.error(`[audit] Production dependencies have advisories: ${[...production.keys()].join(", ")}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const all = advisoriesIn(audit([]));
const blocking = [...all.entries()].filter(([id]) => {
  const exception = DEV_ONLY_NO_FIX_YET.find((entry) => entry.advisory === id);
  return !exception || exception.expires < today;
});
for (const [id] of all) {
  const exception = DEV_ONLY_NO_FIX_YET.find((entry) => entry.advisory === id);
  if (exception && exception.expires >= today) console.log(`[audit] Allowed until ${exception.expires}: ${id} — ${exception.reason}`);
}
if (blocking.length) {
  console.error(`[audit] Advisories to fix: ${blocking.map(([id, via]) => `${id} (${via.severity}, ${via.name})`).join(", ")}`);
  process.exit(1);
}
console.log("[audit] Production dependencies clean; no unexpected advisories.");
