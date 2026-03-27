import test from "node:test";
import assert from "node:assert/strict";

const { getAssetCategoryFormConfig } = await import("../lib/assets/fieldDictionary.ts");

test("social media config captures the expected account-transfer fields", () => {
  const config = getAssetCategoryFormConfig("social-media");
  assert.ok(config);

  const fieldKeys = config.fields.map((field) => field.key);
  assert.deepEqual(fieldKeys, [
    "title",
    "social_profile_url",
    "social_username",
    "social_login_email",
    "social_credential_hint",
    "social_recovery_notes",
    "notes",
  ]);
});
