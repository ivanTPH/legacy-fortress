import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanonicalAssets } from "../assets/fetchCanonicalAssets";
import type { DashboardAssetRow } from "./summary";

type FinanceRecordRow = {
  id: string;
  owner_user_id?: string | null;
  section_key?: string | null;
  category_key?: string | null;
  title?: string | null;
  provider_name?: string | null;
  value_minor?: number | null;
  currency_code?: string | null;
  status?: "active" | "archived" | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type LoadFinanceRowsResult = {
  data: DashboardAssetRow[];
  error: Error | null;
};

export async function loadFinanceDashboardRows(
  client: SupabaseClient,
  {
    userId,
    walletId,
    select = "id,section_key,category_key,status,archived_at,deleted_at,created_at,updated_at,title,provider_name,provider_key,value_minor,currency_code,metadata_json",
  }: {
    userId: string;
    walletId?: string | null;
    select?: string;
  },
): Promise<LoadFinanceRowsResult> {
  const [assetsRes, recordsRes] = await Promise.all([
    fetchCanonicalAssets(client, {
      userId,
      walletId,
      sectionKey: "finances",
      select,
    }),
    client
      .from("records")
      .select("id,owner_user_id,section_key,category_key,title,provider_name,value_minor,currency_code,status,archived_at,created_at,updated_at,metadata")
      .eq("owner_user_id", userId)
      .eq("section_key", "finances")
      .order("updated_at", { ascending: false }),
  ]);

  const errors = [
    assetsRes.error ? new Error(assetsRes.error.message) : null,
    recordsRes.error ? new Error(recordsRes.error.message) : null,
  ].filter((error): error is Error => Boolean(error));

  if (errors.length === 2) {
    return { data: [], error: errors[0] };
  }

  return {
    data: [
      ...(((assetsRes.data ?? []) as unknown) as DashboardAssetRow[]),
      ...mapLegacyFinanceRecordsToDashboardRows(((recordsRes.data ?? []) as unknown) as FinanceRecordRow[]),
    ],
    error: errors[0] ?? null,
  };
}

export function mapLegacyFinanceRecordsToDashboardRows(rows: FinanceRecordRow[]): DashboardAssetRow[] {
  return rows.map((row) => ({
    id: row.id,
    section_key: row.section_key ?? "finances",
    category_key: normalizeLegacyFinanceCategory(row.category_key),
    status: row.status ?? "active",
    archived_at: row.archived_at ?? null,
    deleted_at: null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? row.created_at ?? null,
    title: row.title ?? null,
    provider_name: row.provider_name ?? null,
    provider_key: null,
    value_minor: row.value_minor ?? 0,
    currency_code: row.currency_code ?? "GBP",
    metadata: row.metadata ?? {},
    metadata_json: {
      ...(row.metadata ?? {}),
      finance_record_source: "records",
    },
  }));
}

function normalizeLegacyFinanceCategory(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized === "investment") return "investments";
  if (normalized === "pension") return "pensions";
  if (normalized === "debt" || normalized === "loans-liabilities") return "debts";
  return normalized || "finances";
}
