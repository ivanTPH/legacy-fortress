import test from "node:test";
import assert from "node:assert/strict";

const demoConfig = await import("../lib/demo/config.ts");

test("demo config stays isolated from owner and admin accounts", () => {
  assert.equal(demoConfig.DEMO_OWNER_EMAIL, "bill.smith.demo.owner@legacyfortress.test");
  assert.equal(demoConfig.DEMO_REVIEWER_EMAIL, "bill.smith.demo.reviewer@legacyfortress.test");
  assert.notEqual(demoConfig.DEMO_OWNER_EMAIL, "ivanyardley@me.com");
  assert.notEqual(demoConfig.DEMO_REVIEWER_EMAIL, "ivanyardley@me.com");
});

test("demo session detection works from email and metadata", () => {
  assert.equal(
    demoConfig.isDemoSessionUser({
      email: demoConfig.DEMO_REVIEWER_EMAIL,
      userMetadata: null,
      appMetadata: null,
    }),
    true,
  );

  assert.equal(
    demoConfig.isDemoSessionUser({
      email: "reviewer@example.com",
      userMetadata: { lf_demo_environment: demoConfig.DEMO_ENVIRONMENT_KEY },
      appMetadata: null,
    }),
    true,
  );

  assert.equal(
    demoConfig.isDemoSessionUser({
      email: "someone@example.com",
      userMetadata: {},
      appMetadata: {},
    }),
    false,
  );
});

test("public demo is off unless switched on, and never on the live site (security review 23 Nov 2026)", () => {
  const before = process.env.LF_PUBLIC_DEMO_ENABLED;
  delete process.env.LF_PUBLIC_DEMO_ENABLED;
  assert.equal(demoConfig.isPublicDemoEnabled("test.mylegacyfortress.com"), false);
  process.env.LF_PUBLIC_DEMO_ENABLED = "true";
  assert.equal(demoConfig.isPublicDemoEnabled("test.mylegacyfortress.com"), true);
  assert.equal(demoConfig.isPublicDemoEnabled("mylegacyfortress.com"), false);
  assert.equal(demoConfig.isPublicDemoEnabled("www.mylegacyfortress.com"), false);
  assert.equal(demoConfig.isPublicDemoEnabled("legacy-fortress.vercel.app"), false);
  if (before === undefined) delete process.env.LF_PUBLIC_DEMO_ENABLED; else process.env.LF_PUBLIC_DEMO_ENABLED = before;
});
