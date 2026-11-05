"use client";

import { useState } from "react";
import { saveConfirmedDocumentDate } from "@/lib/documents/extraction/client";
import { formatDocumentDate } from "@/lib/documents/extraction/documentDates";

/**
 * "Date signed" on a Will (owner decision 5 Nov 2026). Read from the document when it can be, or entered here.
 * The 3-yearly "has anything changed?" check counts from this date.
 */
export default function WillDateLine({ signedOn, canEdit, recordId, table, onSaved }: {
  signedOn: string | null;
  canEdit: boolean;
  recordId: string;
  table: "assets" | "records";
  onSaved: (metadata: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(signedOn ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  async function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) { setError("Choose the date the Will was signed. It can't be in the future."); return; }
    setSaving(true);
    const saved = await saveConfirmedDocumentDate(table, recordId, "will_signed_on", value);
    setSaving(false);
    if (!saved.ok) { setError("We couldn’t save the date. Please try again."); return; }
    setError("");
    setEditing(false);
    onSaved(saved.metadata);
  }

  if (editing) {
    return (
      <div className="lf-v52-will-date" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
        <label htmlFor={`will-date-${recordId}`}>Date signed</label>
        <input id={`will-date-${recordId}`} type="date" max={today} value={value} onChange={(event) => setValue(event.target.value)} />
        <button type="button" className="lf-v52-finding-primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => { setEditing(false); setError(""); setValue(signedOn ?? ""); }}>Cancel</button>
        {error ? <p role="alert" style={{ flexBasis: "100%", margin: 0, color: "var(--lf-danger, #a3311f)" }}>{error}</p> : null}
      </div>
    );
  }
  return (
    <p className="lf-v52-will-date" style={{ fontSize: 13, color: "var(--lf-text-secondary)", margin: "0 0 8px" }}>
      Date signed: {signedOn ? formatDocumentDate(signedOn) : "Not set"}
      {canEdit ? <> · <button type="button" className="lf-link-button" onClick={() => setEditing(true)} style={{ background: "none", border: 0, padding: 0, color: "var(--lf-accent, #8C4A32)", cursor: "pointer", textDecoration: "underline" }}>{signedOn ? "Change" : "Add the date"}</button></> : null}
    </p>
  );
}
