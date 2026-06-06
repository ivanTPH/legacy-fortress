#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const isCi = args.has("--ci") || process.env.CI === "true";
const skipBuild = args.has("--skip-build");
const hasLocalEnv = fs.existsSync(path.join(process.cwd(), ".env.local"));

const focusedStabilisationTests = [
  "tests/backend-foundations.test.mjs",
  "tests/platform-architecture-stabilisation.test.mjs",
  "tests/admin-role-api-routes.test.mjs",
  "tests/dashboard-ui-consistency.test.mjs",
  "tests/access-requests-owner-flow.test.mjs",
  "tests/workspace-switcher.test.mjs",
];

const nextDevTypesDir = path.join(process.cwd(), ".next", "dev", "types");
if (fs.existsSync(nextDevTypesDir)) {
  fs.rmSync(nextDevTypesDir, { recursive: true, force: true });
  console.log("[release-gate] Cleared generated .next/dev/types cache before TypeScript.");
}

const checks = [
  ["npm", ["audit", "--audit-level=moderate"], "Dependency vulnerability audit"],
  ...(hasLocalEnv && !isCi
    ? [["npm", ["run", "validate:env"], "Local environment validation"]]
    : []),
  ["npm", ["run", "lint"], "Lint"],
  ["npx", ["tsc", "--noEmit"], "TypeScript"],
  ["npm", ["run", "test:core"], "Core regression tests"],
  ["node", ["--test", ...focusedStabilisationTests], "Platform stabilisation tests"],
  ["npm", ["run", "audit:routes"], "Route audit"],
  ["npm", ["run", "crawl:links"], "Internal link crawl"],
  ...(skipBuild ? [] : [["npm", ["run", "build"], "Production build"]]),
];

for (const [command, commandArgs, label] of checks) {
  console.log(`\n[release-gate] ${label}`);
  await run(command, commandArgs);
}

console.log("\n[release-gate] All checks passed.");

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} exited with code ${code}`));
    });
  });
}
