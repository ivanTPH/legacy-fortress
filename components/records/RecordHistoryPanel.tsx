"use client";

import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";

/**
 * Record history (AGENTS rule 28; 6b collapsed disclosure, 6n / W3 full history).
 * Who did what and when; field names only, never values or document contents.
 */
type Entry = { at: string; action: string; actorKind: "owner" | "person" | "system"; actorName: string; fields: string[]; subject: string | null };

function formatWhen(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day}, ${time}`;
}

const FIELD_LABEL: Record<string, string> = { title: "name", value_minor: "value", currency_code: "currency", provider_name: "provider", section_key: "area", category_key: "category", sort_code: "sort code", account_number: "account number" };

function fieldList(fields: string[]) {
  const names = fields.map((field) => FIELD_LABEL[field] ?? field.replace(/_/g, " "));
  if (!names.length) return "";
  return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

export function describeEntry(entry: Entry) {
  const subject = entry.subject ?? "";
  switch (entry.action) {
    case "created": return { icon: "add_circle", text: "Created the record" };
    case "updated": return { icon: "edit", text: entry.fields.length ? `Changed ${fieldList(entry.fields)}` : "Edited the record" };
    case "deleted": return { icon: "delete", text: "Deleted the record" };
    case "restored": return { icon: "restore", text: "Restored the record" };
    case "document_added": return { icon: "note_add", text: subject ? `Added ${subject}` : "Added a document" };
    case "document_removed": return { icon: "draft", text: subject ? `Removed ${subject}` : "Removed a document" };
    case "person_linked": return { icon: "person_add", text: subject ? `Linked ${subject}` : "Linked a person" };
    case "person_unlinked": return { icon: "person_remove", text: subject ? `Unlinked ${subject}` : "Unlinked a person" };
    case "access_given": return { icon: "visibility", text: subject ? `Gave ${subject} access` : "Gave access" };
    case "access_stopped": return { icon: "visibility_off", text: subject ? `Stopped ${subject}’s access` : "Stopped access" };
    default: return { icon: "history", text: "Updated" };
  }
}

function initials(name: string) {
  if (name === "You") return "Y";
  if (name === "System") return "S";
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function RecordHistoryPanel({ recordId }: { recordId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.rpc("my_record_history", { p_record_id: recordId });
      if (!active) return;
      if (error || !Array.isArray(data)) { setEntries([]); return; }
      setEntries(data.map((row) => ({ at: row.at, action: row.action, actorKind: row.actor_kind, actorName: row.actor_name, fields: row.changed_fields ?? [], subject: row.subject_label ?? null })));
    })();
    return () => { active = false; };
  }, [recordId]);

  if (entries === null) return <details className="lf-v52-record-history"><summary>Record history</summary><p>Loading…</p></details>;
  // Hide the section if history isn't available for this record (PROMPTS: read from the audit source once verified).
  if (!entries.length) return null;
  const created = [...entries].reverse().find((entry) => entry.action === "created");
  const updated = entries.find((entry) => entry.action !== "created") ?? created;

  return <>
    <details className="lf-v52-record-history lf-record-history">
      <summary>
        <span className="lf-record-history-tile" aria-hidden="true"><Icon name="history" size={18} /></span>
        <span><strong>Record history</strong><small>{updated ? `Updated ${formatWhen(updated.at).split(",")[0]} by ${updated.actorName}` : ""}</small></span>
        <Icon name="expand_more" size={20} />
      </summary>
      <dl>
        {created ? <div><dt>Created by</dt><dd>{created.actorName}<small>{formatWhen(created.at)}</small></dd></div> : null}
        {updated && updated !== created ? <div><dt>Last updated by</dt><dd>{updated.actorName}<small>{formatWhen(updated.at)}</small></dd></div> : null}
      </dl>
      <button type="button" className="lf-record-history-all" onClick={() => setFull(true)}>View full history<Icon name="chevron_right" size={18} /></button>
    </details>
    {full ? <div className="lf-record-history-sheet" role="dialog" aria-modal="true" aria-label="Record history">
      <button type="button" className="lf-record-history-scrim" aria-label="Close" onClick={() => setFull(false)} />
      <section>
        <header><h2>Record history</h2><button type="button" className="lf-icon-btn-round" aria-label="Close" onClick={() => setFull(false)}><Icon name="close" size={20} /></button></header>
        <p className="lf-record-history-note">Who changed what, and when. Values and document contents are never shown here.</p>
        <ol>{entries.map((entry, index) => { const copy = describeEntry(entry); return <li key={index}>
          <span className={`lf-record-history-actor is-${entry.actorKind}`} aria-hidden="true">{entry.actorKind === "system" ? <Icon name="settings" size={16} /> : initials(entry.actorName)}</span>
          <span><strong>{copy.text}</strong><small>{entry.actorName}{entry.actorKind === "system" ? " · applied automatically" : ""} · {formatWhen(entry.at)}</small></span>
        </li>; })}</ol>
      </section>
    </div> : null}
  </>;
}
