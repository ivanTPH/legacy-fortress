import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function buildFlag(publicSupabaseUrl, explicitFlag) {
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl };
  delete env.NEXT_PUBLIC_LINKED_PEOPLE_V52;
  if (explicitFlag !== undefined) env.NEXT_PUBLIC_LINKED_PEOPLE_V52 = explicitFlag;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import config from './next.config.ts'; process.stdout.write(config.env.NEXT_PUBLIC_LINKED_PEOPLE_V52)"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("Linked People is enabled for the approved TEST build origin", () => {
  assert.equal(buildFlag("https://supabase-test.mylegacyfortress.com"), "true");
});

test("Linked People stays disabled for production and honours an explicit TEST off switch", () => {
  assert.equal(buildFlag("https://production.example.test"), "false");
  assert.equal(buildFlag("", undefined), "false");
  assert.equal(buildFlag("https://supabase-test.mylegacyfortress.com", "false"), "false");
});
