/**
 * Identity document expiry (owner decision 5 Nov 2026): say about 3 months before a passport or licence
 * runs out; when the new one is added, the old one is kept and shown as "Expired, replaced".
 */
export const ID_EXPIRY_NOTICE_DAYS = 90;
const DAY = 86400000;

export type IdentityDocumentRow = {
  id: string;
  title?: string | null;
  category_key?: string | null;
  metadata_json?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type IdentityDocumentStatus = "valid" | "expiring" | "expired" | "expired_replaced" | "replaced" | "no_date";

const TYPE_LABELS: Record<string, string> = {
  passport: "passport",
  driving_licence: "driving licence",
  national_identity_card: "identity card",
  residence_permit: "residence permit",
};

function meta(row: IdentityDocumentRow) {
  return (row.metadata_json ?? row.metadata ?? {}) as Record<string, unknown>;
}

export function expiryOf(row: IdentityDocumentRow) {
  const value = String(meta(row).renewal_date ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function typeOf(row: IdentityDocumentRow) {
  const metadata = meta(row);
  return String(metadata.identity_document_type_other || metadata.identity_document_type || row.title || "document").trim().toLowerCase();
}

function countryOf(row: IdentityDocumentRow) {
  const metadata = meta(row);
  return String(metadata.identity_document_country_other || metadata.identity_document_country || "").trim().toLowerCase();
}

/** "passport", "driving licence", or the document's own name. */
export function identityDocumentLabel(row: IdentityDocumentRow) {
  const type = String(meta(row).identity_document_type ?? "");
  return TYPE_LABELS[type] ?? (String(row.title ?? "").trim() || "identity document");
}

/** Only documents that expire (not birth or marriage certificates). */
export function isExpiringIdentityDocument(row: IdentityDocumentRow) {
  const type = String(meta(row).identity_document_type ?? "");
  return !["birth_certificate", "marriage_certificate"].includes(type) && Boolean(expiryOf(row));
}

function today(now: Date) {
  return now.toISOString().slice(0, 10);
}

/**
 * Status for each identity document. A document is "replaced" when another one of the same type
 * (and country, where both say) has a later expiry date that is still in the future.
 */
export function identityDocumentStatuses(rows: IdentityDocumentRow[], now = new Date()) {
  const statuses = new Map<string, IdentityDocumentStatus>();
  const nowIso = today(now);
  const soonIso = today(new Date(now.getTime() + ID_EXPIRY_NOTICE_DAYS * DAY));
  for (const row of rows) {
    const expiry = expiryOf(row);
    if (!expiry || !isExpiringIdentityDocument(row)) { statuses.set(row.id, "no_date"); continue; }
    const replaced = rows.some((other) => {
      if (other.id === row.id || typeOf(other) !== typeOf(row)) return false;
      const a = countryOf(row);
      const b = countryOf(other);
      if (a && b && a !== b) return false;
      const otherExpiry = expiryOf(other);
      return Boolean(otherExpiry && otherExpiry > expiry && otherExpiry > nowIso);
    });
    if (expiry < nowIso) statuses.set(row.id, replaced ? "expired_replaced" : "expired");
    else if (replaced) statuses.set(row.id, "replaced");
    else statuses.set(row.id, expiry <= soonIso ? "expiring" : "valid");
  }
  return statuses;
}

export const IDENTITY_STATUS_LABEL: Record<IdentityDocumentStatus, string | null> = {
  valid: null,
  no_date: null,
  expiring: "Expires soon",
  expired: "Expired",
  expired_replaced: "Expired, replaced",
  replaced: "Replaced",
};

/** When a new document is saved with an expiry date that has already passed. */
export function expiredOnSaveMessage(expiry: string | null, now = new Date()) {
  if (!expiry || expiry >= today(now)) return null;
  return "The expiry date you entered has already passed. If this is an old document that's fine, we'll keep it; add your current one too.";
}
