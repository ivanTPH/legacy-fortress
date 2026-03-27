import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProfileAvatarStoragePath,
  loadProfileIdentityChip,
  resolveProfileIdentityDisplayName,
  uploadProfileAvatarFile,
} from "../lib/profile/workspace.ts";

test("resolveProfileIdentityDisplayName falls back safely when no display name exists", () => {
  assert.equal(resolveProfileIdentityDisplayName("Jane Doe", "jane@example.com"), "Jane Doe");
  assert.equal(resolveProfileIdentityDisplayName("", "jane@example.com"), "jane");
  assert.equal(resolveProfileIdentityDisplayName(null, ""), "Secure Account");
});

test("buildProfileAvatarStoragePath matches avatars bucket owner-folder policy", () => {
  const path = buildProfileAvatarStoragePath("user-1", "Jane Doe.png", 12345);
  assert.equal(path, "user-1/avatar-12345-Jane_Doe.png");
});

test("loadProfileIdentityChip uses user_profiles.avatar_path as the shared avatar source", async () => {
  const client = {
    from(table) {
      if (table === "user_profiles") {
        return {
          select(columns) {
            assert.match(columns, /display_name/);
            return {
              eq(key, value) {
                assert.equal(key, "user_id");
                assert.equal(value, "user-1");
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        display_name: "Jane Doe",
                        avatar_path: "profiles/user-1/avatar.png",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "contact_details") {
        return {
          select(columns) {
            assert.match(columns, /telephone/);
            return {
              eq(key, value) {
                assert.equal(key, "user_id");
                assert.equal(value, "user-1");
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        telephone: "0207 123 4567",
                        mobile_number: "",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, expiresIn) {
            assert.equal(path, "profiles/user-1/avatar.png");
            assert.equal(expiresIn, 3600);
            if (bucket === "vault-docs") {
              return {
                data: { signedUrl: "https://example.test/avatar.png" },
                error: null,
              };
            }
            return { data: null, error: { message: "bucket not found" } };
          },
        };
      },
    },
  };

  const chip = await loadProfileIdentityChip(client, {
    userId: "user-1",
    email: "jane@example.com",
  });

  assert.equal(chip.displayName, "Jane Doe");
  assert.equal(chip.avatarUrl, "https://example.test/avatar.png");
  assert.equal(chip.telephone, "0207 123 4567");
});

test("uploadProfileAvatarFile fails loudly when storage upload fails", async () => {
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload() {
            return {
              data: null,
              error: { message: bucket === "avatars" ? "new row violates row-level security policy" : "bucket not found" },
            };
          },
        };
      },
    },
  };

  await assert.rejects(
    () => uploadProfileAvatarFile(client, {
      userId: "user-1",
      file: { name: "avatar.png" },
    }),
    /Avatar upload failed for bucket avatars: new row violates row-level security policy/,
  );
});
