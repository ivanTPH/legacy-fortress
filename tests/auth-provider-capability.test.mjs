import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getConfiguredAuthProviders } from "../lib/auth/authProviders.ts";

const root = process.cwd();

test("social auth providers are opt-in and unsupported providers are omitted", () => {
  assert.deepEqual(getConfiguredAuthProviders(""), []);
  assert.deepEqual(getConfiguredAuthProviders("google"), ["google"]);
  assert.deepEqual(getConfiguredAuthProviders("google,apple"), ["google", "apple"]);
  assert.deepEqual(getConfiguredAuthProviders("facebook,google"), ["google"]);
});

test("OAuth UI is capability-driven rather than advertising hard-coded providers", () => {
  const oauth = fs.readFileSync(path.join(root, "components/auth/OAuthButtons.tsx"), "utf8");
  assert.match(oauth, /getConfiguredAuthProviders/);
  assert.match(oauth, /providers\.map/);
  assert.doesNotMatch(oauth, /onClick=\{\(\) => void oauth\("google"\)\}/);
  assert.doesNotMatch(oauth, /onClick=\{\(\) => void oauth\("apple"\)\}/);
});

test("invitation signup carries and constrains the invited email", () => {
  const accept = fs.readFileSync(path.join(root, "app/invite/accept/InvitationAcceptPageClient.tsx"), "utf8");
  const entry = fs.readFileSync(path.join(root, "components/auth/PublicSignUpEntry.tsx"), "utf8");
  const form = fs.readFileSync(path.join(root, "components/auth/SignUpForm.tsx"), "utf8");
  assert.match(accept, /email=\$\{encodeURIComponent\(summary\.contact_email\)\}/);
  assert.match(entry, /expectedEmail=\{invitedEmail\}/);
  assert.match(form, /readOnly=\{Boolean\(invitedEmail\)\}/);
  assert.match(form, /Use the email address that received this invitation/);
});
