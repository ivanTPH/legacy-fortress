import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { toSafeInternalPath } from "../lib/auth/session.ts";
import { isMissingRelationError, isMissingColumnError } from "../lib/supabaseErrors.ts";

test("toSafeInternalPath only allows app-internal paths", () => {
  assert.equal(toSafeInternalPath("/dashboard", "/sign-in"), "/dashboard");
  assert.equal(toSafeInternalPath("/onboarding?step=1", "/sign-in"), "/onboarding?step=1");
  assert.equal(toSafeInternalPath("https://evil.test", "/sign-in"), "/sign-in");
  assert.equal(toSafeInternalPath("//evil.test", "/sign-in"), "/sign-in");
  assert.equal(toSafeInternalPath("dashboard", "/sign-in"), "/sign-in");
  assert.equal(toSafeInternalPath(null, "/sign-in"), "/sign-in");
});

test("isMissingRelationError detects schema-cache and relation drift", () => {
  assert.equal(
    isMissingRelationError({ message: "Could not find the table 'section_entries' in the schema cache" }, "section_entries"),
    true,
  );
  assert.equal(
    isMissingRelationError({ message: "relation \"public.section_entries\" does not exist" }, "section_entries"),
    true,
  );
  assert.equal(
    isMissingRelationError({ message: "permission denied for table section_entries" }, "section_entries"),
    false,
  );
});

test("isMissingColumnError detects missing column schema-cache drift", () => {
  assert.equal(
    isMissingColumnError({ message: "Could not find the 'avatar_path' column of 'user_profiles' in the schema cache" }, "avatar_path"),
    true,
  );
  assert.equal(
    isMissingColumnError({ message: "column user_profiles.avatar_path does not exist" }, "avatar_path"),
    true,
  );
  assert.equal(
    isMissingColumnError({ message: "invalid input syntax for type uuid" }, "avatar_path"),
    false,
  );
});

test("Supabase auth config uses the live production origin for email redirects", () => {
  const config = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf8");
  assert.match(config, /site_url = "https:\/\/legacy-fortress\.vercel\.app"/);
  assert.match(config, /"https:\/\/legacy-fortress\.vercel\.app\/auth\/callback"/);
  assert.match(config, /"https:\/\/legacy-fortress\.vercel\.app\/reset-password"/);
  assert.match(config, /"https:\/\/legacy-fortress\.vercel\.app\/sign-in"/);
  assert.doesNotMatch(config, /site_url = "https:\/\/legacy-fortress-web\.vercel\.app"/);
});

test("auth callback supports direct Supabase email token verification links", () => {
  const callback = fs.readFileSync(path.join(process.cwd(), "app/auth/callback/page.tsx"), "utf8");
  assert.match(callback, /token_hash/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /type: otpType/);
  assert.match(callback, /auth\.callback\.verify_otp\.success/);
  assert.match(callback, /No active session found after authentication/);
  assert.match(callback, /Go to sign in/);
});
