import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSessionClaims, trustedBySignIn, deviceLabel, hashDeviceToken } from "../lib/auth/deviceTrust.ts";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;

test("a password-only session isn't trusted; emailed code, two-step and OAuth are", () => {
  assert.equal(trustedBySignIn(readSessionClaims(jwt({ aal: "aal1", amr: [{ method: "password" }], session_id: "s1" }))), false);
  assert.equal(trustedBySignIn(readSessionClaims(jwt({ aal: "aal1", amr: [{ method: "otp" }] }))), true);
  assert.equal(trustedBySignIn(readSessionClaims(jwt({ aal: "aal2", amr: [{ method: "password" }, { method: "totp" }] }))), true);
  assert.equal(trustedBySignIn(readSessionClaims(jwt({ aal: "aal1", amr: [{ method: "oauth" }] }))), true);
  assert.equal(readSessionClaims(jwt({ session_id: "abc" })).sessionId, "abc");
  assert.equal(trustedBySignIn(readSessionClaims("not-a-token")), false);
});

test("the app's rule matches the database rule", () => {
  const sql = read("supabase/migrations/20261104120000_new_device_check.sql");
  for (const method of ["otp", "magiclink", "email/signup", "oauth", "totp", "passkey"]) assert.match(sql, new RegExp(`'${method.replace("/", "\\/")}'`));
  assert.match(sql, /new_device_check boolean NOT NULL DEFAULT false/, "the switch starts off");
  assert.match(sql, /AS RESTRICTIVE FOR ALL TO authenticated/);
  assert.match(sql, /storage\.objects/);
});

test("device tokens are stored as keyed hashes tied to the person; labels say nothing personal", () => {
  assert.notEqual(hashDeviceToken("user-a", "token"), hashDeviceToken("user-b", "token"));
  assert.equal(hashDeviceToken("user-a", "token").length, 64);
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1"), "iPhone · Safari");
});

test("sign-in and the app send an untrusted session to the code page; it can be remembered and forgotten", () => {
  assert.match(read("components/auth/SignInForm.tsx"), /device\.enforced && !device\.trusted/);
  assert.match(read("app/(app)/layout.tsx"), /verifyDeviceHref\(/);
  const page = read("components/auth/VerifyDevice.tsx");
  assert.match(page, /signInWithOtp\(\{ email: address, options: \{ shouldCreateUser: false/);
  assert.match(page, /verifyOtp\(\{ email, token: code\.replace\(\/\\D\/g, ""\), type: "email" \}\)/);
  assert.match(page, /Remember this device/);
  assert.match(read("app/api/auth/device/route.ts"), /Confirm it's you first\./, "only a just-checked session can remember a device");
  assert.match(read("app/(app)/account/security/page.tsx"), /forgetRememberedDevices/);
});
