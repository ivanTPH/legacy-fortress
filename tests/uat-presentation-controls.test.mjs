import assert from "node:assert/strict";
import test from "node:test";

const MODULE_PATH = "../lib/environment/appEnvironment.ts";

async function loadEnvironmentModule() {
  return import(`${MODULE_PATH}?cache=${Date.now()}-${Math.random()}`);
}

function withEnvironment(overrides, fn) {
  const keys = ["APP_ENV", "LEGACY_FORTRESS_ENV", "VERCEL_ENV", "NODE_ENV"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of keys) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

test("UAT presentation controls activate only from explicit server environment", async () => {
  await withEnvironment({ APP_ENV: "uat", NODE_ENV: "production" }, async () => {
    const env = await loadEnvironmentModule();
    assert.equal(env.isUatEnvironment(), true);
    assert.deepEqual(env.getRobotsPolicy(), {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    });
  });
});

test("production presentation controls do not add noindex by default", async () => {
  await withEnvironment({ NODE_ENV: "production" }, async () => {
    const env = await loadEnvironmentModule();
    assert.equal(env.isUatEnvironment(), false);
    assert.equal(env.getRobotsPolicy(), undefined);
  });
});

test("browser query strings cannot enable UAT presentation controls", async () => {
  await withEnvironment({ NODE_ENV: "production" }, async () => {
    const env = await loadEnvironmentModule();
    const pretendBrowserUrl = new URL("https://legacy-fortress.example/?APP_ENV=uat&uat=1");
    assert.equal(pretendBrowserUrl.searchParams.get("APP_ENV"), "uat");
    assert.equal(env.isUatEnvironment(), false);
    assert.equal(env.getRobotsPolicy(), undefined);
  });
});
