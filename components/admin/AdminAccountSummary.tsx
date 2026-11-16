"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";

/**
 * A customer's account summary in Admin (owner decision 16 Nov 2026): each count opens a list underneath.
 * Lists show area, type, status, size and dates only. Never record names, values, file names, contents, or the
 * names and emails of the people the customer added.
 */
type Detail = {
  counts: { assets: number; documents: number; contacts: number; invitations: number; linkedAccessGrants: number; verificationRequests: number };
  records: Array<{ id: string; area: string; type: string; status: string; createdAt: string; updatedAt: string }>;
  documentList: Array<{ id: string; area: string; kind: string; mimeType: string; sizeBytes: number; createdAt: string }>;
  contacts: Array<{ id: string; label: string; role: string | null; relationship: string | null; inviteStatus: string | null; verificationStatus: string | null }>;
  invitations: Array<{ id: string; assignedRole: string; invitationStatus: string; sentAt: string | null; acceptedAt: string | null; revokedAt: string | null }>;
  accessGrants: Array<{ id: string; activationStatus: string; updatedAt: string | null }>;
  verificationRequests: Array<{ id: string; requestType: string; requestStatus: string; submittedAt: string; reviewedAt: string | null }>;
};
type Key = "records" | "documents" | "people" | "invitations" | "access" | "identity";

export default function AdminAccountSummary({ detail }: { detail: Detail }) {
  const [open, setOpen] = useState<Key | null>(null);
  const tiles: Array<[Key, string, number]> = [
    ["records", "Records", Math.max(detail.counts.assets, detail.records.length)],
    ["documents", "Documents", Math.max(detail.counts.documents, detail.documentList.length)],
    ["people", "People", detail.contacts.length],
    ["invitations", "Invitations", detail.invitations.length],
    ["access", "Access given", detail.accessGrants.length],
    ["identity", "Identity checks", detail.verificationRequests.length],
  ];

  const lists: Record<Key, ReactNode> = {
    records: rows(detail.records, "No records yet.", (item) => line(`${words(item.area)} · ${words(item.type)}`, `${words(item.status)} · added ${day(item.createdAt)}${item.updatedAt && item.updatedAt !== item.createdAt ? ` · updated ${day(item.updatedAt)}` : ""}`)),
    documents: rows(detail.documentList, "No documents yet.", (item) => line(`${item.area ? `${words(item.area)} · ` : ""}${fileType(item.mimeType)}`, `${size(item.sizeBytes)} · added ${day(item.createdAt)}`)),
    people: rows(detail.contacts, "No one added yet.", (item) => line(`${item.label}${item.role ? ` · ${words(item.role)}` : ""}`, `${words(item.inviteStatus || "not invited")} · identity ${words(item.verificationStatus || "not started").toLowerCase()}`)),
    invitations: rows(detail.invitations, "No invitations sent.", (item) => line(`${words(item.assignedRole)} · ${words(item.invitationStatus)}`, item.acceptedAt ? `accepted ${day(item.acceptedAt)}` : item.revokedAt ? `cancelled ${day(item.revokedAt)}` : item.sentAt ? `sent ${day(item.sentAt)}` : "not sent")),
    access: rows(detail.accessGrants, "No access given.", (item) => line(words(item.activationStatus || "unknown"), item.updatedAt ? `changed ${day(item.updatedAt)}` : "")),
    identity: rows(detail.verificationRequests, "No identity checks.", (item) => line(`${words(item.requestType)} · ${words(item.requestStatus)}`, `started ${day(item.submittedAt)}${item.reviewedAt ? ` · reviewed ${day(item.reviewedAt)}` : ""}`)),
  };

  return (
    <section className="lf-admin-account-summary" aria-label="Account summary">
      <div className="lf-admin-account-tiles">
        {tiles.map(([key, label, value]) => (
          <button key={key} type="button" aria-expanded={open === key} aria-controls={`lf-admin-list-${key}`} onClick={() => setOpen(open === key ? null : key)}>
            <span>{label}</span>
            <strong>{value}</strong>
            <Icon name={open === key ? "expand_less" : "expand_more"} size={20} />
          </button>
        ))}
      </div>
      {open ? (
        <div id={`lf-admin-list-${open}`} className="lf-admin-account-list" role="region" aria-label={tiles.find(([key]) => key === open)?.[1]}>
          <h3>{tiles.find(([key]) => key === open)?.[1]}</h3>
          {lists[open]}
          <p className="lf-admin-muted">Details only. Names, values, file names and contents are never shown in admin.</p>
        </div>
      ) : null}
    </section>
  );
}

function rows<T extends { id: string }>(items: T[], empty: string, render: (item: T) => ReactNode) {
  if (!items.length) return <p className="lf-admin-muted">{empty}</p>;
  return <ul>{items.slice(0, 100).map((item) => <li key={item.id}>{render(item)}</li>)}</ul>;
}
function line(title: string, sub: string) {
  return <><strong>{title}</strong>{sub ? <small>{sub}</small> : null}</>;
}
function words(value: string) {
  const text = String(value ?? "").replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Not recorded";
}
function day(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fileType(mime: string) {
  if (/pdf/i.test(mime)) return "PDF";
  if (/image\//i.test(mime)) return "Picture";
  if (/word|document/i.test(mime)) return "Word document";
  if (/sheet|excel|csv/i.test(mime)) return "Spreadsheet";
  if (/calendar/i.test(mime)) return "Calendar file";
  return "File";
}
function size(bytes: number) {
  if (!bytes) return "size unknown";
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
