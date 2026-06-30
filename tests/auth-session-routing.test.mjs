import test from "node:test";
import assert from "node:assert/strict";

const {
  buildProtectedSignInRedirect,
  isFinalSignedOutAuthEvent,
  toSafeInternalPath,
} = await import("../lib/auth/session.ts");

test("protected sign-in redirects preserve the originally requested route and query", () => {
  assert.equal(
    buildProtectedSignInRedirect("/finances/bank", "?search=ISA&sort=updated"),
    "/sign-in?next=%2Ffinances%2Fbank%3Fsearch%3DISA%26sort%3Dupdated",
  );
});

test("protected sign-in redirects fall back safely for unsafe paths", () => {
  assert.equal(buildProtectedSignInRedirect("https://evil.example/path"), "/sign-in?next=%2Fdashboard");
  assert.equal(buildProtectedSignInRedirect("//evil.example/path"), "/sign-in?next=%2Fdashboard");
});

test("initial null auth events are not treated as final sign-out events", () => {
  assert.equal(isFinalSignedOutAuthEvent("INITIAL_SESSION"), false);
  assert.equal(isFinalSignedOutAuthEvent("TOKEN_REFRESHED"), false);
  assert.equal(isFinalSignedOutAuthEvent("SIGNED_OUT"), true);
});

test("safe internal paths continue to reject external destinations", () => {
  assert.equal(toSafeInternalPath("/dashboard", "/fallback"), "/dashboard");
  assert.equal(toSafeInternalPath("//evil.example", "/fallback"), "/fallback");
  assert.equal(toSafeInternalPath("https://evil.example", "/fallback"), "/fallback");
});
