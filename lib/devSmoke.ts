export type DevSmokeVariant = "empty" | "fixture";
export type CanonicalBankTraceEntry = {
  kind: "create" | "bank-load" | "dashboard-load";
  source: string;
  timestamp: string;
  userId: string | null;
  organisationId: string | null;
  walletId: string | null;
  createdAssetId?: string | null;
  assetIds?: string[];
  categorySlug?: string | null;
  assetCategoryToken?: string | null;
  assetCategoryTokens?: string[];
  titles?: string[];
};

export type CanonicalBankContextTrace = {
  timestamp: string;
  source: string;
  stage: string;
  sessionPresent: boolean | null;
  userId: string | null;
  organisationId: string | null;
  walletId: string | null;
  error: string | null;
  assetInsertReached: boolean;
  createdAssetId: string | null;
};

type SearchParamsLike = {
  get: (key: string) => string | null;
} | null | undefined;

const BANK_TRACE_QUERY_KEY = "lf_dev_bank_trace";
const BANK_TRACE_STORAGE_KEY = "lf:dev:bank-trace";
const BANK_REQUEST_TRACE_STORAGE_KEY = "lf:dev:bank-request-trace";
const BANK_CONTEXT_TRACE_STORAGE_KEY = "lf:dev:bank-context-trace";
const BANK_TRACE_EVENT = "lf-dev-bank-trace-updated";

export function isDevSmokeModeEnabled(searchParams: SearchParamsLike) {
  if (process.env.NODE_ENV !== "development") return false;
  return searchParams?.get("lf_dev_smoke") === "1";
}

export function getDevSmokeVariant(searchParams: SearchParamsLike): DevSmokeVariant {
  const variant = searchParams?.get("lf_dev_variant");
  return variant === "fixture" ? "fixture" : "empty";
}

export function isDevBankTraceEnabled(searchParams?: SearchParamsLike) {
  if (process.env.NODE_ENV !== "development") return false;
  if (searchParams?.get(BANK_TRACE_QUERY_KEY) === "1") return true;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(BANK_TRACE_QUERY_KEY) === "1";
}

export function appendDevBankTrace(entry: CanonicalBankTraceEntry) {
  if (!isDevBankTraceEnabled()) return;
  if (typeof window === "undefined") return;

  const existing = readDevBankTrace();
  const next = [...existing, entry].slice(-30);
  window.sessionStorage.setItem(BANK_TRACE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BANK_TRACE_EVENT));
}

export function readDevBankTrace(): CanonicalBankTraceEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(BANK_TRACE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CanonicalBankTraceEntry[]) : [];
  } catch {
    return [];
  }
}

export function subscribeToDevBankTrace(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(BANK_TRACE_EVENT, handler);
  return () => window.removeEventListener(BANK_TRACE_EVENT, handler);
}

export function appendDevBankRequestTrace(entry: string) {
  if (!isDevBankTraceEnabled()) return;
  if (typeof window === "undefined") return;

  const existing = readDevBankRequestTrace();
  const next = [...existing, `${new Date().toISOString()} ${entry}`].slice(-60);
  window.sessionStorage.setItem(BANK_REQUEST_TRACE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BANK_TRACE_EVENT));
}

export function mergeDevBankContextTrace(
  patch: Partial<Omit<CanonicalBankContextTrace, "timestamp">> & Pick<CanonicalBankContextTrace, "source" | "stage">,
) {
  if (!isDevBankTraceEnabled()) return;
  if (typeof window === "undefined") return;

  const existing = readDevBankContextTrace();
  const next: CanonicalBankContextTrace = {
    timestamp: new Date().toISOString(),
    source: patch.source,
    stage: patch.stage,
    sessionPresent: patch.sessionPresent ?? existing?.sessionPresent ?? null,
    userId: patch.userId ?? existing?.userId ?? null,
    organisationId: patch.organisationId ?? existing?.organisationId ?? null,
    walletId: patch.walletId ?? existing?.walletId ?? null,
    error: patch.error ?? (patch.error === null ? null : existing?.error ?? null),
    assetInsertReached: patch.assetInsertReached ?? existing?.assetInsertReached ?? false,
    createdAssetId: patch.createdAssetId ?? existing?.createdAssetId ?? null,
  };
  window.sessionStorage.setItem(BANK_CONTEXT_TRACE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BANK_TRACE_EVENT));
}

export function readDevBankContextTrace(): CanonicalBankContextTrace | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(BANK_CONTEXT_TRACE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CanonicalBankContextTrace;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readDevBankRequestTrace(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(BANK_REQUEST_TRACE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export function clearDevBankRequestTrace() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(BANK_REQUEST_TRACE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(BANK_TRACE_EVENT));
}

export function clearDevBankContextTrace() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(BANK_CONTEXT_TRACE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(BANK_TRACE_EVENT));
}
