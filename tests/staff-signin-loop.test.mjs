import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("staff sign-in only skips the code when it's within the server's 12-hour window (no redirect loop)", () => {
  const signIn = read("components/auth/StaffSignIn.tsx");
  const server = read("lib/admin/access.ts");
  assert.match(signIn, /currentLevel === "aal2" && staffCodeIsFresh\(level\.data\.currentAuthenticationMethods\)/);
  assert.equal(signIn.match(/STAFF_CODE_HOURS = (\d+)/)?.[1], server.match(/STAFF_SESSION_HOURS = (\d+)/)?.[1], "client and server windows match");
  assert.doesNotMatch(signIn, /if \(level\.data\?\.currentLevel === "aal2"\) \{ finish\(\); return; \}/);
});
