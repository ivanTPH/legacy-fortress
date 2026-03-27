import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError, isMissingRelationError } from "./supabaseErrors";

type AnySupabaseClient = SupabaseClient;

const tableCache = new Map<string, boolean>();
const columnCache = new Map<string, boolean>();

function tableKey(table: string) {
  return table.trim().toLowerCase();
}

function columnKey(table: string, column: string) {
  return `${tableKey(table)}:${normalizeSchemaColumnName(column)}`;
}

function normalizeSchemaColumnName(column: string) {
  return column
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
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
  const normalizedColumn = normalizeSchemaColumnName(column);
  const key = columnKey(table, normalizedColumn);
  if (columnCache.has(key)) return columnCache.get(key) as boolean;

  const tableExists = await hasTable(client, table);
  if (!tableExists) {
    columnCache.set(key, false);
    return false;
  }

  if (process.env.NODE_ENV === "development" && normalizedColumn !== column.trim().toLowerCase()) {
    console.info("[schemaSafe] normalized schema column", {
      table,
      requestedColumn: column,
      normalizedColumn,
    });
  }

  const result = await client.from(table).select(normalizedColumn).limit(1).maybeSingle();
  if (result.error) {
    if (isMissingColumnError(result.error, normalizedColumn) || isMissingRelationError(result.error, table)) {
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
