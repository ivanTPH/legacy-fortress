import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

// Three clear states on the website and sign-in page (owner decision 9 Nov 2026).
const client = fs.readFileSync("lib/auth/deviceTrustClient.ts", "utf8");
const entry = fs.readFileSync("components/auth/PublicAuthEntry.tsx", "utf8");
const site = fs.readFileSync("public/site/site.js", "utf8");

test("the greeting is kept only on a remembered device, and holds only a first name and email", () => {
  assert.match(client, /saveReturningVisitor\(session\.user\);\n  return true;/, "saved when the person ticks Remember this device");
  assert.match(client, /JSON\.stringify\(\{ firstName: first \|\| null, email: user\.email \}\)/);
  assert.match(client, /clearReturningVisitor\(\);\n  return Boolean\(response\?\.ok\);/, "Forget all remembered devices clears it");
});

test("sign-in page: signed in shows Continue to my Vault; returning says Welcome back with the email filled in", () => {
  assert.match(entry, /Continue to my Vault/);
  assert.match(entry, /Not you\?\{" "\}\n\s*<button[^>]*onClick=\{\(\) => void signOutHere\(\)\}>Sign out<\/button>/);
  assert.match(entry, /Welcome back\$\{returning\.firstName \? `, \$\{returning\.firstName\}` : ""\}/);
  assert.match(entry, /initialEmail=\{invitedEmail \|\| returning\?\.email \|\| ""\}/);
  assert.match(entry, /Use a different account/);
});

test("website: returning visitors are invited to sign in, signed-in visitors to open their Vault", () => {
  assert.match(site, /localStorage\.getItem\('lf:returning'\)/);
  assert.match(site, /a\.textContent = 'Sign in to your Vault'/);
  assert.match(site, /'\/dashboard'/);
});
