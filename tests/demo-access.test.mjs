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
