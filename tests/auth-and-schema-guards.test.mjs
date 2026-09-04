import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { toSafeInternalPath } from "../lib/auth/session.ts";
import { getServerSupabaseUrl } from "../lib/supabaseAdmin.ts";
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

test("server Supabase admin URL is resolved at runtime instead of build-inlined public env", () => {
  const previousServerUrl = process.env.SUPABASE_URL;
  const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    process.env.SUPABASE_URL = "http://127.0.0.1:55421";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
    assert.equal(getServerSupabaseUrl(), "http://127.0.0.1:55421");

    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55421";
    assert.equal(getServerSupabaseUrl(), "http://127.0.0.1:55421");
  } finally {
    if (previousServerUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousServerUrl;
    if (previousPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl;
  }
});

test("schema health endpoint exposes safe diagnostic categories only", () => {
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/health/schema/route.ts"), "utf8");
  assert.match(route, /authentication_failed/);
  assert.match(route, /supabase_unreachable/);
  assert.match(route, /migration_mismatch/);
  assert.match(route, /query_failed/);
  assert.doesNotMatch(route, /connection string|service role key|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Supabase local auth config keeps local site_url while allow-listing production redirects", () => {
  const config = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf8");
  assert.match(config, /site_url = "http:\/\/localhost:3012"/);
  assert.match(config, /"http:\/\/127\.0\.0\.1:3012\/auth\/callback"/);
  assert.match(config, /"http:\/\/127\.0\.0\.1:3012\/reset-password"/);
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

test("an existing personal session does not silently redirect from sign-in", () => {
  const entry = fs.readFileSync(path.join(process.cwd(), "components/auth/PublicAuthEntry.tsx"), "utf8");
  assert.match(entry, /existing personal session should not make \/sign-in silently jump/);
  assert.match(entry, /if \(!nextPath\)/);
  assert.match(entry, /if \(pendingDestination\) router\.replace\(pendingDestination\)/);
  assert.match(entry, /return;/);
});

test("passkey enrollment is explicitly non-production and does not claim passwordless sign-in", () => {
  const passkeys = fs.readFileSync(path.join(process.cwd(), "lib/auth/passkeys.ts"), "utf8");
  assert.match(passkeys, /NEXT_PUBLIC_PASSKEYS_ENABLED/);
  assert.match(passkeys, /NON_PRODUCTION_ENVS/);
  assert.match(passkeys, /passwordlessSignIn: false/);
  assert.match(passkeys, /auth\.mfa\.webauthn\.register/);
});
