import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError, isMissingRelationError } from "./supabaseErrors";

type AnySupabaseClient = SupabaseClient;

const tableCache = new Map<string, boolean>();
const columnCache = new Map<string, boolean>();

function tableKey(table: string) {
  return table.trim().toLowerCase();
}

function columnKey(table: string, column: string) {
  return `${tableKey(table)}:${column.trim().toLowerCase()}`;
}

export async function hasTable(client: AnySupabaseClient, table: string): Promise<boolean> {
  const key = tableKey(table);
  if (tableCache.has(key)) return tableCache.get(key) as boolean;

  const result = await client.from(table).select("*").limit(1).maybeSingle();
  if (result.error) {
    if (isMissingRelationError(result.error, table)) {
      tableCache.set(key, false);
      return false;
    }
    // If relation exists but the query failed for another reason (RLS/network), treat as present.
    tableCache.set(key, true);
    return true;
  }

  tableCache.set(key, true);
  return true;
}

export async function hasColumn(
  client: AnySupabaseClient,
  table: string,
  column: string,
): Promise<boolean> {
  const key = columnKey(table, column);
  if (columnCache.has(key)) return columnCache.get(key) as boolean;

  const tableExists = await hasTable(client, table);
  if (!tableExists) {
    columnCache.set(key, false);
    return false;
  }

  const result = await client.from(table).select(column).limit(1).maybeSingle();
  if (result.error) {
    if (isMissingColumnError(result.error, column) || isMissingRelationError(result.error, table)) {
      columnCache.set(key, false);
      return false;
    }
    // Non-schema errors should not be interpreted as missing columns.
    columnCache.set(key, true);
    return true;
  }

  columnCache.set(key, true);
  return true;
}

