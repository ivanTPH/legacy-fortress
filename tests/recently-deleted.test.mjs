import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { daysLeft, restoreErrorMessage, RECENTLY_DELETED_DAYS, purgeRecentlyDeleted } from "../lib/records/recentlyDeleted.ts";

const migration = fs.readFileSync("supabase/migrations/20261118210000_recently_deleted.sql", "utf8");

test("Recently deleted keeps things for 30 days (owner approved 18 Nov 2026)", () => {
  assert.equal(RECENTLY_DELETED_DAYS, 30);
  const now = Date.parse("2026-12-01T12:00:00Z");
  assert.equal(daysLeft("2026-12-01T11:00:00Z", now), 30);
  assert.equal(daysLeft("2026-11-01T13:00:00Z", now), 1);
  assert.equal(daysLeft("2026-10-01T00:00:00Z", now), 0);
  assert.match(restoreErrorMessage("PLAN_LIMIT_DOCUMENTS: The free plan holds 10 documents"), /document limit/);
  assert.match(restoreErrorMessage("DELETED_ITEM_EXPIRED"), /more than 30 days/);
});

test("the bin is owner-only and grants nothing", () => {
  assert.match(migration, /interval '30 days'/);
  assert.equal((migration.match(/SECURITY INVOKER SET search_path/g) ?? []).length, 2, "both functions run with the owner's own permissions");
  assert.doesNotMatch(migration, /SECURITY DEFINER/);
  assert.match(migration, /REVOKE UPDATE ON public\.deleted_items FROM authenticated/);
  assert.match(migration, /REVOKE ALL ON public\.deleted_items FROM anon/);
  assert.doesNotMatch(migration, /account_access_grants|permissions_override|INSERT INTO public\.(contact_links|linked)/, "restoring never creates access");
  for (const policy of migration.match(/CREATE POLICY[\s\S]*?;/g) ?? []) assert.match(policy, /owner_user_id = auth\.uid\(\)/);
});

test("the daily job removes items after 30 days with their files, and only those", async () => {
  const calls = [];
  const rows = { deleted_items: [{ id: "b1", owner_user_id: "u1", attachment_rows: [{ storage_bucket: "vault-docs", storage_path: "users/u1/a.pdf" }] }], assets: [{ id: "a1", owner_user_id: "u1" }], documents: [{ storage_bucket: "vault-docs", storage_path: "users/u1/b.pdf" }] };
  const chain = (table, op) => {
    const q = { filters: [], eq(c, v) { this.filters.push(["eq", c, v]); return this; }, lte(c, v) { this.filters.push(["lte", c, v]); return this; }, gte(c, v) { this.filters.push(["gte", c, v]); return this; }, not(c, o, v) { this.filters.push(["not", c, o, v]); return this; }, limit() { return this; },
      then(resolve) { calls.push({ table, op, filters: this.filters }); resolve({ data: op === "select" ? rows[table] : null, error: null }); } };
    return q;
  };
  const admin = {
    from: (table) => ({ select: () => chain(table, "select"), delete: () => chain(table, "delete") }),
    storage: { from: (bucket) => ({ remove: async (paths) => { calls.push({ storage: bucket, paths }); return { error: null }; } }) },
  };
  const result = await purgeRecentlyDeleted(admin, new Date("2026-12-31T09:00:00Z"));
  assert.deepEqual({ ...result }, { ok: true, records: 1, assets: 1, failed: 0 });
  assert.ok(calls.some((c) => c.storage && c.paths.includes("users/u1/a.pdf")));
  assert.ok(calls.some((c) => c.storage && c.paths.includes("users/u1/b.pdf")));
  const assetQuery = calls.find((c) => c.table === "assets" && c.op === "select");
  assert.ok(assetQuery.filters.some(([k, c, v]) => k === "gte" && c === "deleted_at" && v === "2026-11-19T00:00:00.000Z"), "assets deleted before the bin existed are never removed");
  assert.ok(assetQuery.filters.some(([k, c, v]) => k === "lte" && c === "deleted_at" && v === "2026-12-01T09:00:00.000Z"));
});

test("migration hash recorded for owner approval", () => {
  const sha = crypto.createHash("sha256").update(fs.readFileSync("supabase/migrations/20261118210000_recently_deleted.sql")).digest("hex");
  assert.match(sha, /^[0-9a-f]{64}$/);
});
