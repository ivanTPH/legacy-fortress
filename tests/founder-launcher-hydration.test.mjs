import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createFounderLauncherAvailability } from "../lib/testLauncher/availability.ts";

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test("session loading shell does not advertise an unverified switcher", () => {
  const layout = readFileSync(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8");
  const placeholder = layout.split('className="lf-workspace-placeholder lf-sidebar-workspace"')[1]?.split("</aside>")[0];
  assert.ok(placeholder);
  assert.doesNotMatch(placeholder, /unfold_more|FounderTestLauncher|<WorkspaceSwitcher/);
});

test("duplicate hydration events cannot replace a verified founder result", async () => {
  const states = [];
  const tokens = [];
  const tracker = createFounderLauncherAvailability({
    verify: async (token) => { tokens.push(token); return true; },
    onStatus: (state) => states.push(state),
    now: () => 1000,
  });
  tracker.authEvent("SIGNED_IN", "founder-token");
  tracker.initialSession(null); // An older getSession result arrives after SIGNED_IN.
  tracker.authEvent("INITIAL_SESSION", null);
  tracker.authEvent("INITIAL_SESSION", "founder-token");
  await settle();
  tracker.authEvent("SIGNED_IN", "founder-token");
  await settle();
  assert.deepEqual(tokens, ["founder-token"]);
  assert.deepEqual(states, ["pending", "allowed"]);
  tracker.dispose();
});

test("a changed token is rechecked and a stale positive response cannot restore access", async () => {
  const states = [];
  let completeOld;
  const tracker = createFounderLauncherAvailability({
    verify: (token) => token === "old-token" ? new Promise((resolve) => { completeOld = resolve; }) : Promise.resolve(false),
    onStatus: (state) => states.push(state),
  });
  tracker.initialSession("old-token");
  tracker.authEvent("TOKEN_REFRESHED", "new-token");
  await settle();
  completeOld(true);
  await settle();
  assert.equal(states.at(-1), "denied");
  assert.equal(states.includes("allowed"), false);
  tracker.dispose();
});

test("sign-out immediately revokes the launcher even if a request completes later", async () => {
  const states = [];
  let complete;
  const tracker = createFounderLauncherAvailability({
    verify: () => new Promise((resolve) => { complete = resolve; }),
    onStatus: (state) => states.push(state),
  });
  tracker.initialSession("founder-token");
  tracker.authEvent("SIGNED_OUT", null);
  complete(true);
  await settle();
  assert.equal(states.at(-1), "denied");
  assert.equal(states.includes("allowed"), false);
  tracker.dispose();
});

test("an absent session stays denied until a new token passes the server check", async () => {
  const states = [];
  const tracker = createFounderLauncherAvailability({
    verify: async (token) => token === "founder-token",
    onStatus: (state) => states.push(state),
  });
  tracker.initialSession(null);
  assert.equal(states.at(-1), "denied");
  tracker.authEvent("SIGNED_IN", "ordinary-token");
  await settle();
  assert.equal(states.at(-1), "denied");
  tracker.authEvent("SIGNED_IN", "founder-token");
  await settle();
  assert.equal(states.at(-1), "allowed");
  tracker.dispose();
});

test("a previously allowed token is rechecked after the hydration window", async () => {
  const states = [];
  let clock = 1000;
  let allowed = true;
  let checks = 0;
  const tracker = createFounderLauncherAvailability({
    verify: async () => { checks += 1; return allowed; },
    onStatus: (state) => states.push(state),
    now: () => clock,
  });
  tracker.initialSession("founder-token");
  await settle();
  tracker.authEvent("SIGNED_IN", "founder-token");
  assert.equal(checks, 1);
  clock += 30_001;
  allowed = false;
  tracker.authEvent("SIGNED_IN", "founder-token");
  await settle();
  assert.equal(checks, 2);
  assert.equal(states.at(-1), "denied");
  tracker.dispose();
});
