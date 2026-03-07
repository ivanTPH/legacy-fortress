#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const recommended = ["STRIPE_SECRET", "GOOGLE_CLIENT_ID", "APPLE_CLIENT_ID"];

const missingRequired = required.filter((name) => !process.env[name]);
const missingRecommended = recommended.filter((name) => !process.env[name]);

if (missingRequired.length) {
  console.error("Missing required environment variables:");
  for (const name of missingRequired) console.error(`- ${name}`);
  process.exit(1);
}

console.log("Required environment variables are present.");

if (missingRecommended.length) {
  console.log("Missing recommended environment variables:");
  for (const name of missingRecommended) console.log(`- ${name}`);
}
