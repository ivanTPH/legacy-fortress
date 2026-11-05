import { supabase } from "@/lib/supabaseClient";
import type { BankAccountFinding } from "./bankFinding";
import type { DocumentDateFinding } from "./documentDates";

export const DOCUMENT_EXTRACTION_EVENT = "lf-document-extraction";
export const BANK_PREFILL_STORAGE_KEY = "lf-bank-prefill-from-document";

export type DocumentExtractionResult = {
  ok: boolean;
  readable?: boolean;
  reason?: string;
  usedOcr?: boolean;
  peopleSuggested?: number;
  account?: BankAccountFinding | null;
  dateFinding?: DocumentDateFinding | null;
  error?: string;
};

export type DocumentExtractionEventDetail = {
  recordId: string;
  documentId: string;
  status: "reading" | "done" | "failed";
  result?: DocumentExtractionResult;
};

export function isDocumentExtractionEnabled() {
  return process.env.NEXT_PUBLIC_DOCUMENT_EXTRACTION === "true";
}

/** Fire-and-forget after an upload. Findings arrive as an event on the record page. */
export async function startDocumentExtraction(documentId: string | null | undefined, recordId: string, source: "document" | "attachment" = "document") {
  if (!documentId || !recordId || !isDocumentExtractionEnabled() || typeof window === "undefined") return;
  const emit = (detail: DocumentExtractionEventDetail) => window.dispatchEvent(new CustomEvent(DOCUMENT_EXTRACTION_EVENT, { detail }));
  emit({ recordId, documentId, status: "reading" });
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("no_session");
    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/extract${source === "attachment" ? "?source=attachment" : ""}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({ ok: false }))) as DocumentExtractionResult;
    emit({ recordId, documentId, status: response.ok && result.ok ? "done" : "failed", result });
  } catch {
    emit({ recordId, documentId, status: "failed" });
  }
}

/** Hand bank details to the Add bank account form without putting them in the URL. */
export type StagedBankPrefill = Partial<BankAccountFinding["prefill"]> & { source_document_id?: string | null };

/** The statement's document id travels with the details so it can move to the new record once the owner confirms. */
export function stageBankPrefill(prefill: BankAccountFinding["prefill"], sourceDocumentId?: string | null) {
  try { window.sessionStorage.setItem(BANK_PREFILL_STORAGE_KEY, JSON.stringify({ ...prefill, source_document_id: sourceDocumentId ?? null })); } catch { /* storage unavailable */ }
}

export function takeBankPrefill(): StagedBankPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(BANK_PREFILL_STORAGE_KEY);
    window.sessionStorage.removeItem(BANK_PREFILL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save a date the owner confirmed (a Will's signing date, an ID document's expiry) on their own record.
 * Merges one key into the record's details; row-level security limits this to the owner.
 */
export async function saveConfirmedDocumentDate(table: "assets" | "records", rowId: string, key: DocumentDateFinding["kind"], date: string) {
  // Legal records can be read from either table; try the expected one first.
  for (const source of table === "assets" ? (["assets", "records"] as const) : (["records", "assets"] as const)) {
    const column = source === "assets" ? "metadata_json" : "metadata";
    const current = await supabase.from(source).select(`id,${column}`).eq("id", rowId).maybeSingle();
    if (current.error || !current.data) continue;
    const metadata = { ...(((current.data as Record<string, unknown>)[column] ?? {}) as Record<string, unknown>), [key]: date };
    const updated = await supabase.from(source).update({ [column]: metadata, updated_at: new Date().toISOString() }).eq("id", rowId).select("id").maybeSingle();
    return updated.error || !updated.data ? { ok: false as const } : { ok: true as const, metadata };
  }
  return { ok: false as const };
}
