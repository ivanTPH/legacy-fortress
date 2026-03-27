#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../lib/supabaseAdmin.ts";
import {
  DEMO_ACCOUNT_HOLDER_NAME,
  DEMO_OWNER_EMAIL,
  DEMO_REVIEWER_EMAIL,
} from "../lib/demo/config.ts";
import { ensureDemoEnvironment, ensureDemoUsers } from "../lib/demo/access.ts";

const admin = createSupabaseAdminClient();
if (!admin) {
  throw new Error(`Demo setup blocked: ${getSupabaseAdminConfigIssue() ?? "missing_admin_client"}`);
}

await ensureDemoUsers(admin);
await runSeedScript();
const summary = await ensureDemoEnvironment(admin);

console.log(JSON.stringify({
  ownerEmail: DEMO_OWNER_EMAIL,
  reviewerEmail: DEMO_REVIEWER_EMAIL,
  accountHolderName: DEMO_ACCOUNT_HOLDER_NAME,
  ...summary,
}, null, 2));

async function runSeedScript() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/seed-bill-smith-review-account.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SEED_TARGET_EMAIL: DEMO_OWNER_EMAIL,
        },
        stdio: "inherit",
      },
    );
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Seed script exited with code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}
