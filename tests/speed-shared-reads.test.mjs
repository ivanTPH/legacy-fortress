import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("shared reads: one request for many askers, cleared by saves (browser only)", async () => {
  globalThis.window = globalThis.window ?? {};
  const { sharedRead, clearSharedReads } = await import("../lib/sharedRead.ts");
  let calls = 0;
  const load = async () => { calls += 1; return calls; };
  const [a, b] = await Promise.all([sharedRead("k", load), sharedRead("k", load)]);
  assert.equal(a, 1); assert.equal(b, 1); assert.equal(await sharedRead("k", load), 1);
  clearSharedReads();
  assert.equal(await sharedRead("k", load), 2);
});

test("known schema skips probe requests; wallet fast path skips the per-page write", () => {
  const schema = readFileSync(new URL("../lib/schemaSafe.ts", import.meta.url), "utf8");
  assert.match(schema, /wallets: \["id", "owner_user_id", "organisation_id", "status", "label", "created_at"\]/);
  const wallet = readFileSync(new URL("../lib/canonicalPersistence.ts", import.meta.url), "utf8");
  assert.match(wallet, /if \(existing\.walletId && existing\.organisationId\) \{/);
  const bootstrap = readFileSync(new URL("../lib/auth/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /await Promise\.all\(\[\s*ensureWalletContext/);
  for (const [file, fn] of [["lib/onboarding/index.ts", "saveOnboardingState"], ["lib/onboarding/index.ts", "saveTermsAcceptance"], ["lib/vaultPreferences.ts", "saveVaultPreferences"], ["lib/accessibilityPreferences.ts", "saveAccessibilityPreferences"], ["lib/profile/workspace.ts", "saveProfileWorkspace"]]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const body = source.slice(source.indexOf(`export async function ${fn}(`), source.indexOf(`export async function ${fn}(`) + 900);
    assert.match(body, /clearSharedReads\(\)/, `${fn} clears shared reads`);
  }
});
