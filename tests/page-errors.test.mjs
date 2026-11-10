import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { isNewVersionError } from "../lib/errors/recovery.ts";

test("a page left open across a new version reloads once; other faults show our error screen (owner report 10 Nov 2026)", () => {
  assert.ok(isNewVersionError({ name: "ChunkLoadError", message: "Loading chunk 123 failed." }));
  assert.ok(isNewVersionError(new TypeError("Failed to fetch dynamically imported module: https://test.mylegacyfortress.com/_next/static/chunks/x.js")));
  assert.ok(isNewVersionError(new TypeError("Importing a module script failed.")));
  assert.ok(!isNewVersionError(new TypeError("Cannot read properties of undefined (reading 'map')")));
  const recovery = fs.readFileSync("lib/errors/recovery.ts", "utf8");
  assert.match(recovery, /Date\.now\(\) - last < 60_000\) return false/, "never a reload loop");
  for (const file of ["app/global-error.tsx", "app/(app)/error.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /reloadOnceForNewVersion\(error\)/);
    assert.match(source, /Sorry, this page didn’t load/);
    assert.match(source, /Nothing in your Vault has been changed/);
  }
});
