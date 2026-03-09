import test from "node:test";
import assert from "node:assert/strict";

import { toSafeInternalPath } from "../lib/auth/session.ts";
import { isMissingRelationError, isMissingColumnError } from "../lib/supabaseErrors.ts";

test("toSafeInternalPath only allows app-internal paths", () => {
  assert.equal(toSafeInternalPath("/dashboard", "/sign-in"), "/dashboard");
  assert.equal(toSafeInternalPath("/onboarding?step=1", "/sign-in"), "/onboarding?step=1");
  assert.equal(toSafeInternalPath("https://evil.test", "/sign-in"), "/sign-in");
  assert.equal(toSafeInternalPath("//evil.test", "/sign-in"), "/sign-in");
  assert.equal(toSafeInternalPath("dashboard", "/sign-in"), "/sign-in");
  assert.equal(toSafeInternalPath(null, "/sign-in"), "/sign-in");
});

test("isMissingRelationError detects schema-cache and relation drift", () => {
  assert.equal(
    isMissingRelationError({ message: "Could not find the table 'section_entries' in the schema cache" }, "section_entries"),
    true,
  );
  assert.equal(
    isMissingRelationError({ message: "relation \"public.section_entries\" does not exist" }, "section_entries"),
    true,
  );
  assert.equal(
    isMissingRelationError({ message: "permission denied for table section_entries" }, "section_entries"),
    false,
  );
});

test("isMissingColumnError detects missing column schema-cache drift", () => {
  assert.equal(
    isMissingColumnError({ message: "Could not find the 'avatar_path' column of 'user_profiles' in the schema cache" }, "avatar_path"),
    true,
  );
  assert.equal(
    isMissingColumnError({ message: "column user_profiles.avatar_path does not exist" }, "avatar_path"),
    true,
  );
  assert.equal(
    isMissingColumnError({ message: "invalid input syntax for type uuid" }, "avatar_path"),
    false,
  );
});
