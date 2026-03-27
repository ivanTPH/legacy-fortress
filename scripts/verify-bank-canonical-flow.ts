import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAsset, updateAsset } from "../lib/assets/createAsset";
import { normalizeBankAssetRow } from "../lib/assets/bankAsset";
import { fetchCanonicalAssets } from "../lib/assets/fetchCanonicalAssets";
import { BANK_WORKSPACE_CONFIG } from "../lib/assets/workspaceCategoryConfig";
import { countAssetsByBucket, getAssetsForBucket } from "../lib/dashboard/summary";

type Row = Record<string, unknown>;

type QueryResult<T> = Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

class FakeSupabaseClient {
  private sequences = new Map<string, number>();
  readonly schema = new Map<string, Set<string>>();
  readonly tables = new Map<string, Row[]>();

  constructor() {
    this.defineTable("organisations", ["id", "owner_user_id", "name", "created_at"]);
    this.defineTable("wallets", ["id", "organisation_id", "owner_user_id", "label", "status", "created_at"]);
    this.defineTable("asset_categories", ["id", "slug", "key", "category_key", "name", "created_at"]);
    this.defineTable("assets", [
      "id",
      "organisation_id",
      "wallet_id",
      "owner_user_id",
      "section_key",
      "category_key",
      "title",
      "provider_name",
      "provider_key",
      "summary",
      "value_minor",
      "currency_code",
      "visibility",
      "status",
      "metadata_json",
      "created_at",
      "updated_at",
      "archived_at",
      "deleted_at",
    ]);
    this.defineTable("asset_encrypted_payloads", ["asset_id", "owner_user_id", "payload", "updated_at"]);

    this.insertSeed("asset_categories", {
      id: "asset-category-bank",
      slug: "bank-accounts",
      key: "bank-accounts",
      category_key: "bank",
      name: "Bank Accounts",
      created_at: this.timestamp(),
    });
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(name: string, params: Record<string, unknown>) {
    if (name === "upsert_asset_sensitive_payload") {
      const assetId = String(params.p_asset_id ?? "").trim();
      const payload = ((params.p_payload as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const asset = this.rows("assets").find((row) => String(row.id ?? "") === assetId);
      if (!asset) {
        return { data: null, error: { message: `Asset ${assetId} not found.` } };
      }

      const existing = this.rows("asset_encrypted_payloads").find((row) => String(row.asset_id ?? "") === assetId);
      if (existing) {
        existing.payload = payload;
        existing.updated_at = this.timestamp();
      } else {
        this.rows("asset_encrypted_payloads").push({
          asset_id: assetId,
          owner_user_id: String(asset.owner_user_id ?? ""),
          payload,
          updated_at: this.timestamp(),
        });
      }
      return { data: true, error: null };
    }

    return { data: null, error: { message: `RPC ${name} is not implemented in FakeSupabaseClient.` } };
  }

  hasTable(table: string) {
    return this.schema.has(table);
  }

  hasColumn(table: string, column: string) {
    return this.schema.get(table)?.has(column) ?? false;
  }

  rows(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table) as Row[];
  }

  nextId(table: string) {
    const current = (this.sequences.get(table) ?? 0) + 1;
    this.sequences.set(table, current);
    return `${table}-${current}`;
  }

  timestamp() {
    return new Date().toISOString();
  }

  private defineTable(table: string, columns: string[]) {
    this.schema.set(table, new Set(columns));
    this.tables.set(table, []);
  }

  private insertSeed(table: string, row: Row) {
    this.rows(table).push({ ...row });
  }
}

class FakeQuery implements PromiseLike<{ data: Row[] | Row | null; error: { message: string } | null }> {
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private selectColumns = "*";
  private insertedRows: Row[] | null = null;
  private updatePayload: Row | null = null;
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(
    private readonly client: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(columns = "*") {
    this.selectColumns = columns;
    if (this.operation === "select") {
      this.operation = "select";
    }
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.insertedRows = Array.isArray(payload) ? payload.map((row) => ({ ...row })) : [{ ...payload }];
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.updatePayload = { ...payload };
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.ensureColumn(column);
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.ensureColumn(column);
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: unknown) {
    this.ensureColumn(column);
    this.filters.push((row) => row[column] === value);
    return this;
  }

  ilike(column: string, value: string) {
    this.ensureColumn(column);
    const normalized = value.trim().toLowerCase();
    this.filters.push((row) => String(row[column] ?? "").trim().toLowerCase() === normalized);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.ensureColumn(column);
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this.executeSingle();
  }

  single() {
    this.singleMode = "single";
    return this.executeSingle();
  }

  then<TResult1 = { data: Row[] | Row | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | Row | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (!this.client.hasTable(this.table)) {
      return { data: null, error: { message: `relation "${this.table}" does not exist` } };
    }

    if (this.operation === "insert") {
      const rows = this.insertedRows ?? [];
      const inserted = rows.map((row) => this.insertRow(row));
      return this.finalizeResult(inserted);
    }

    if (this.operation === "update") {
      const rows = this.applyFilters(this.client.rows(this.table));
      const updated = rows.map((row) => {
        Object.assign(row, this.updatePayload ?? {}, { updated_at: this.updatePayload?.updated_at ?? this.client.timestamp() });
        return { ...row };
      });
      return this.finalizeResult(updated);
    }

    if (this.operation === "delete") {
      const source = this.client.rows(this.table);
      const kept: Row[] = [];
      const removed: Row[] = [];
      for (const row of source) {
        if (this.matches(row)) removed.push({ ...row });
        else kept.push(row);
      }
      this.client.tables.set(this.table, kept);
      return this.finalizeResult(removed);
    }

    const selected = this.selectRows();
    return this.finalizeResult(selected);
  }

  private executeSingle(): QueryResult<Row> {
    return this.execute().then((result) => {
      if (result.error) return { data: null, error: result.error };
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      if (this.singleMode === "single" && rows.length !== 1) {
        return { data: null, error: { message: `Expected single row from ${this.table}, received ${rows.length}.` } };
      }
      return { data: rows[0] ?? null, error: null };
    });
  }

  private finalizeResult(rows: Row[]) {
    const projected = this.projectRows(rows);
    if (this.singleMode) {
      const single = projected[0] ?? null;
      if (this.singleMode === "single" && !single) {
        return { data: null, error: { message: `Expected single row from ${this.table}, received 0.` } };
      }
      return { data: single, error: null };
    }
    return { data: projected, error: null };
  }

  private selectRows() {
    let rows = this.applyFilters(this.client.rows(this.table)).map((row) => ({ ...row }));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = rows.sort((left, right) => {
        const a = left[column];
        const b = right[column];
        if (a === b) return 0;
        if (a == null) return ascending ? -1 : 1;
        if (b == null) return ascending ? 1 : -1;
        return ascending ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
      });
    }
    if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
    return rows;
  }

  private applyFilters(rows: Row[]) {
    return rows.filter((row) => this.matches(row));
  }

  private matches(row: Row) {
    return this.filters.every((filter) => filter(row));
  }

  private projectRows(rows: Row[]) {
    if (this.selectColumns === "*" || !this.selectColumns.trim()) return rows;
    const columns = this.selectColumns
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    return rows.map((row) => {
      const projected: Row = {};
      for (const column of columns) {
        projected[column] = row[column];
      }
      return projected;
    });
  }

  private insertRow(row: Row) {
    const next = { ...row };
    const now = this.client.timestamp();
    for (const column of this.client.schema.get(this.table) ?? []) {
      if (!(column in next)) next[column] = null;
    }
    if ((next.id == null || next.id === "") && this.client.hasColumn(this.table, "id")) next.id = this.client.nextId(this.table);
    if ((next.created_at == null || next.created_at === "") && this.client.hasColumn(this.table, "created_at")) next.created_at = now;
    if ((next.updated_at == null || next.updated_at === "") && this.client.hasColumn(this.table, "updated_at")) next.updated_at = now;
    this.client.rows(this.table).push(next);
    return { ...next };
  }

  private ensureColumn(column: string) {
    if (column === "*") return;
    if (!this.client.hasColumn(this.table, column)) {
      throw new Error(`column "${this.table}.${column}" does not exist`);
    }
  }
}

async function main() {
  const client = new FakeSupabaseClient();
  const canonicalClient = client as unknown as Parameters<typeof createAsset>[0];
  const userId = "bank-flow-dev-user";

  const firstCreate = await createAsset(canonicalClient, {
    userId,
    categorySlug: "bank-accounts",
    title: "Verification Barclays Current",
    metadata: {
      institution_name: "Barclays",
      provider_name: "Barclays",
      provider_key: "barclays",
      account_type: "Current account",
      account_number: "12345678",
      sort_code: "12-34-56",
      country_code: "GB",
      currency_code: "GBP",
      value_major: 1250.25,
      last_updated_on: "2026-03-19",
      notes: "Primary household account",
    },
    visibility: "private",
  });

  const walletProbe = await client
    .from("wallets")
    .select("id,organisation_id,owner_user_id,status")
    .eq("owner_user_id", userId)
    .eq("status", "active")
    .limit(5);
  const walletProbeRows = ((walletProbe.data ?? []) as unknown[]) as Row[];
  assert.equal(
    walletProbeRows.length,
    1,
    `Wallet read probe should return one active wallet for the user. Returned wallet ids=${walletProbeRows.map((row) => String(row.id ?? "")).join(",")}`,
  );

  const secondCreate = await createAsset(canonicalClient, {
    userId,
    categorySlug: "bank-accounts",
    title: "Verification Lloyds Savings",
    metadata: {
      institution_name: "Lloyds Bank",
      provider_name: "Lloyds Bank",
      provider_key: "lloyds",
      account_type: "Savings account",
      account_number: "87654321",
      sort_code: "65-43-21",
      country_code: "GB",
      currency_code: "GBP",
      value_major: 9800.0,
      last_updated_on: "2026-03-18",
      notes: "Emergency savings",
    },
    visibility: "private",
  });

  assert.ok(firstCreate.id, "First bank record id should be returned.");
  assert.ok(secondCreate.id, "Second bank record id should be returned.");
  assert.equal(firstCreate.row.section_key, "finances");
  assert.equal(firstCreate.row.category_key, "bank");

  const storedAssets = client.rows("assets");
  assert.equal(storedAssets.length, 2, "Two canonical assets should be persisted.");
  assert.ok(
    storedAssets.every((row) => String(row.section_key ?? "") === "finances" && String(row.category_key ?? "") === "bank"),
    "Stored assets should keep the canonical Bank section/category mapping.",
  );
  assert.equal(
    new Set(storedAssets.map((row) => String(row.wallet_id ?? ""))).size,
    1,
    `Both synthetic Bank assets should share the same wallet. Stored wallet ids=${storedAssets.map((row) => String(row.wallet_id ?? "")).join(",")}`,
  );
  assert.ok(
    storedAssets.every((row) => !("account_number" in (((row.metadata_json as Record<string, unknown> | null) ?? {})))),
    "Sensitive bank fields must not be stored in public metadata_json.",
  );

  const encryptedPayloads = client.rows("asset_encrypted_payloads");
  assert.equal(encryptedPayloads.length, 2, "Sensitive bank payloads should be written through the encrypted payload path.");
  assert.ok(
    encryptedPayloads.every((row) => String(((row.payload as Record<string, unknown> | null) ?? {})["account_number"] ?? "").trim()),
    "Encrypted payloads should contain the bank account number.",
  );

  const walletId = firstCreate.row.wallet_id;
  const bankPageRowsResult = await fetchCanonicalAssets(canonicalClient, {
    userId,
    walletId,
    sectionKey: BANK_WORKSPACE_CONFIG.sectionKey,
    categoryKey: BANK_WORKSPACE_CONFIG.categoryKey,
    select: "id,wallet_id,section_key,category_key,title,provider_name,provider_key,summary,value_minor,currency_code,status,metadata_json,created_at,updated_at,archived_at,deleted_at",
  });
  assert.equal(bankPageRowsResult.error, null, "Bank page canonical query should succeed.");
  const bankPageRows = ((bankPageRowsResult.data ?? []) as unknown[]) as Row[];
  assert.equal(
    bankPageRows.length,
    2,
    `Bank page query should return both synthetic Bank assets. Returned ids=${bankPageRows.map((row) => String(row.id ?? "")).join(",")}`,
  );

  const bankTitles = bankPageRows.map((row) => normalizeBankAssetRow({
    title: String(row.title ?? ""),
    provider_name: typeof row.provider_name === "string" ? row.provider_name : null,
    provider_key: typeof row.provider_key === "string" ? row.provider_key : null,
    currency_code: typeof row.currency_code === "string" ? row.currency_code : null,
    value_minor: typeof row.value_minor === "number" ? row.value_minor : Number(row.value_minor ?? 0),
    metadata_json: (row.metadata_json as Record<string, unknown> | null) ?? null,
  }).title);
  assert.deepEqual(
    new Set(bankTitles),
    new Set(["Verification Barclays Current", "Verification Lloyds Savings"]),
    "Bank page normalization should preserve both synthetic Bank titles.",
  );

  const dashboardRowsResult = await fetchCanonicalAssets(canonicalClient, {
    userId,
    walletId,
    select: "id,wallet_id,section_key,category_key,title,provider_name,provider_key,summary,value_minor,currency_code,status,metadata_json,created_at,updated_at,archived_at,deleted_at",
  });
  assert.equal(dashboardRowsResult.error, null, "Dashboard canonical asset query should succeed.");
  const dashboardRows = ((dashboardRowsResult.data ?? []) as unknown[]) as Array<{
    id: string;
    section_key?: string | null;
    category_key?: string | null;
    status?: "active" | "archived" | null;
    archived_at?: string | null;
    deleted_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;

  const financeRows = getAssetsForBucket(dashboardRows, "finance");
  const counts = countAssetsByBucket(dashboardRows);
  assert.equal(financeRows.length, 2, "Dashboard finance bucket should include both synthetic Bank assets.");
  assert.equal(counts.finance, 2, "Dashboard finance total should count both synthetic Bank assets.");

  await updateAsset(canonicalClient, {
    assetId: firstCreate.id,
    userId,
    categorySlug: "bank-accounts",
    title: "Verification Barclays Current",
    metadata: {
      institution_name: "Barclays",
      provider_name: "Barclays",
      provider_key: "barclays",
      account_type: "Current account",
      account_number: "12345678",
      sort_code: "12-34-56",
      country_code: "GB",
      currency_code: "GBP",
      value_major: 1250.25,
      last_updated_on: "2026-03-19",
      notes: "Primary household account",
    },
    visibility: "private",
    status: "archived",
  });

  const dashboardRowsAfterArchiveResult = await fetchCanonicalAssets(canonicalClient, {
    userId,
    walletId,
    select: "id,wallet_id,section_key,category_key,title,provider_name,provider_key,summary,value_minor,currency_code,status,metadata_json,created_at,updated_at,archived_at,deleted_at",
  });
  assert.equal(dashboardRowsAfterArchiveResult.error, null, "Dashboard canonical asset query after archive should still succeed.");
  const dashboardRowsAfterArchive = ((dashboardRowsAfterArchiveResult.data ?? []) as unknown[]) as Array<{
    id: string;
    section_key?: string | null;
    category_key?: string | null;
    status?: "active" | "archived" | null;
    archived_at?: string | null;
    deleted_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  const countsAfterArchive = countAssetsByBucket(dashboardRowsAfterArchive);
  assert.equal(countsAfterArchive.finance, 1, "Dashboard finance total should drop after archiving one Bank asset.");

  const activeFinanceRowsAfterArchive = getAssetsForBucket(dashboardRowsAfterArchive, "finance");
  assert.deepEqual(
    activeFinanceRowsAfterArchive.map((row) => row.id),
    [secondCreate.id],
    "Only the active synthetic Bank asset should remain in the dashboard finance bucket after archive.",
  );

  const activeBankFlowSources = [
    "app/(app)/finances/bank/page.tsx",
    "components/records/UniversalRecordWorkspace.tsx",
    "lib/assets/workspaceCategoryConfig.ts",
    "lib/assets/createAsset.ts",
    "lib/assets/fetchCanonicalAssets.ts",
    "app/(app)/dashboard/page.tsx",
  ];
  for (const file of activeBankFlowSources) {
    const source = readFileSync(file, "utf8");
    assert.ok(!source.includes("assets.owner_user_id"), `${file} should not contain the stale assets.owner_user_id reference.`);
  }

  console.log("PASS createAsset persists canonical Bank assets");
  console.log("PASS sensitive Bank fields are kept out of public metadata_json");
  console.log("PASS Bank page canonical query returns synthetic Bank assets");
  console.log("PASS Dashboard canonical finance query and totals include synthetic Bank assets");
  console.log("PASS archive behavior updates dashboard finance totals correctly");
  console.log("PASS active Bank flow source files do not contain stale assets.owner_user_id references");
}

main().catch((error) => {
  console.error("FAIL", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
