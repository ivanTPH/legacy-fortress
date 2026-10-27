#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectPreflight } from "../dev/preflight.mjs";
import { STAGING } from "../dev/bootstrap.mjs";

export function assessRelease({ report, expectedSha, requiredMigration }) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha ?? "")) return "Provide an exact 40-character approved expected_sha.";
  if (report.status !== "READ_ONLY_READY_APPROVAL_REQUIRED") return report.blocker || "Fresh TEST preflight failed.";
  if (report.branch !== STAGING || report.head !== expectedSha || report.stagingSha !== expectedSha)
    return "The clean checked-out staging HEAD must equal the approved pushed expected_sha.";
  if (requiredMigration && !report.migrationHistory?.includes(requiredMigration))
    return `Required migration ${requiredMigration} is not recorded on verified TEST PostgreSQL.`;
  return null;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const expectedSha = process.argv[2];
  const requiredMigration = process.argv[3] || null;
  collectPreflight().then((report) => {
    const blocker = assessRelease({ report, expectedSha, requiredMigration });
    if (blocker) { process.stderr.write(`Protected application release blocked: ${blocker}\n`); process.exitCode = 2; return; }
    process.stdout.write(JSON.stringify({ status: "READY_FOR_EXISTING_PROTECTED_APP_WORKFLOW", expected_sha: expectedSha,
      requiredMigration, gate: "Run npm run release:check -- --ci once on this commit",
      dispatch: `npm run staging:release with EXPECTED_STAGING_SHA=${expectedSha} after owner approval`,
      acceptance: "Confirm GitHub hosted IDV/Admin gates and live /api/version; update handover/backlog" }, null, 2) + "\n");
  }).catch(() => { process.stderr.write("Protected application release blocked: fresh preflight unavailable\n"); process.exitCode = 2; });
}
