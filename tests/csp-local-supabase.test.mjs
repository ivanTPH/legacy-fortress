import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const nextConfig = fs.readFileSync("next.config.ts", "utf8");

test("local Supabase CSP allowance is exact-origin and production-gated", () => {
  assert.match(nextConfig, /localDevelopmentConnectSrc = isProduction \? \[\] : \["http:\/\/127\.0\.0\.1:55421"\]/);
  assert.match(nextConfig, /localDevelopmentImgSrc = isProduction \? \[\] : \["http:\/\/127\.0\.0\.1:55421"\]/);
  assert.match(nextConfig, /connect-src 'self' https:/);
  assert.match(nextConfig, /img-src 'self' data: blob: https:/);
  assert.doesNotMatch(nextConfig, /connect-src[^`"']*http:/);
  assert.doesNotMatch(nextConfig, /img-src[^`"']*http:/);
  assert.doesNotMatch(nextConfig, /connect-src[^`"']*\*/);
  assert.doesNotMatch(nextConfig, /img-src[^`"']*\*/);
  assert.doesNotMatch(nextConfig, /unsafe-eval.*127\.0\.0\.1:55421/s);
});
