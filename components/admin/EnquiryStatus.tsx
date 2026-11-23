"use client";

import Link from "next/link";
import { useState } from "react";

const OPTIONS = [["new", "New"], ["contacted", "Contacted"], ["onboarding", "Onboarding"], ["closed", "Closed"]] as const;

/** Where a partner enquiry stands, set from the Admin Inbox (23 Nov 2026); audited on the server. */
export default function EnquiryStatus({ id, status, authFetch }: { id: string; status: string; authFetch: (input: string, init?: RequestInit) => Promise<Response> }) {
  const [value, setValue] = useState(status);
  const [note, setNote] = useState("");
  async function change(next: string) {
    const previous = value;
    setValue(next); setNote("");
    const res = await authFetch("/api/internal/admin/partner-enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id.replace(/^partner:/, ""), status: next }) }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }) : {};
    if (!res?.ok || !json.ok) { setValue(previous); setNote(json.message || "That didn’t save. Try again."); return; }
    setNote("Saved.");
  }
  return (
    <div className="lf-admin-reply">
      <div className="lf-admin-reply-row">
        <label className="lf-admin-enquiry-status">Status
          <select value={value} onChange={(event) => void change(event.target.value)}>
            {OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <Link href="/admin/organisations" prefetch={false} className="lf-admin-row-button">Start onboarding</Link>
        {note ? <span role="status" className="lf-admin-reply-note">{note}</span> : null}
      </div>
    </div>
  );
}
