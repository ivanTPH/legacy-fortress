import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("ephemeral auth clients use purpose-specific storage keys instead of duplicating the main session client", () => {
  const helper = fs.readFileSync(path.join(root, "lib/auth/browserAuthClient.ts"), "utf8");
  const signUp = fs.readFileSync(path.join(root, "components/auth/SignUpForm.tsx"), "utf8");
  const forgotPassword = fs.readFileSync(path.join(root, "app/forgot-password/page.tsx"), "utf8");

  assert.match(helper, /storageKey: `legacy-fortress-\$\{purpose\}-ephemeral-auth`/);
  assert.match(helper, /persistSession: false/);
  assert.match(helper, /detectSessionInUrl: false/);
  assert.match(signUp, /createEphemeralBrowserAuthClient\("signup"\)/);
  assert.doesNotMatch(signUp, /isLocalSupabaseUrl/);
  assert.doesNotMatch(signUp, /publicEnv/);
  assert.match(forgotPassword, /createEphemeralBrowserAuthClient\("password-reset"\)/);
  assert.doesNotMatch(signUp, /createClient\(publicEnv\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(forgotPassword, /createClient\(publicEnv\.NEXT_PUBLIC_SUPABASE_URL/);
});
