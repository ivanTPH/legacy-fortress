#!/usr/bin/env node
import fs from "node:fs";
import { chromium } from "@playwright/test";

const executablePath = chromium.executablePath();
if (!fs.existsSync(executablePath)) {
  console.error(JSON.stringify({
    script: "phase6-hosted-playwright-preflight",
    classification: "TEST-ENVIRONMENT DEFECT",
    error: "Chromium executable does not exist in the staging container",
    remediation: "npx playwright install --with-deps chromium",
  }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ script: "phase6-hosted-playwright-preflight", chromium: "available" }));
}
