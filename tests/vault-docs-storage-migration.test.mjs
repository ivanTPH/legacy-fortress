import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260721153000_provision_vault_docs_storage_bucket.sql", import.meta.url),
  "utf8",
);

test("vault-docs storage migration provisions a private constrained bucket", () => {
  assert.match(migration, /INSERT INTO storage\.buckets/);
  assert.match(migration, /'vault-docs'/);
  assert.match(migration, /public,\s*file_size_limit,\s*allowed_mime_types/s);
  assert.match(migration, /false,\s*15728640/s);
  assert.match(migration, /application\/pdf/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
  assert.match(migration, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(migration, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(migration, /text\/csv/);
});

test("vault-docs storage policies constrain owner writes to user-id paths", () => {
  assert.match(migration, /CREATE POLICY vault_docs_owner_select ON storage\.objects/);
  assert.match(migration, /CREATE POLICY vault_docs_owner_insert ON storage\.objects/);
  assert.match(migration, /CREATE POLICY vault_docs_owner_update ON storage\.objects/);
  assert.match(migration, /CREATE POLICY vault_docs_owner_delete ON storage\.objects/);
  assert.match(migration, /split_part\(name, '\/', 1\) = 'users'/);
  assert.match(migration, /split_part\(name, '\/', 2\) = auth\.uid\(\)::text/);
  assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /WITH CHECK\s*\(\s*true\s*\)/i);
});

test("vault-docs linked reads remain scoped through existing grant helper", () => {
  assert.match(migration, /CREATE POLICY vault_docs_linked_select ON storage\.objects/);
  assert.match(migration, /public\.linked_grant_allows_storage_object\(bucket_id, name\)/);
  assert.doesNotMatch(migration, /bucket_id = 'avatars'/);
});
