"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";
import { loadInboxNamedPeople, type InboxNamedPerson } from "../../lib/linkedPeople/inboxNamedPeople";
import { reviewLinkedPersonSuggestion } from "../../lib/linkedPeople/suggestions";
import { normalizeLinkedPersonEmail, sendRecordLinkedPersonInvitation } from "../../lib/linkedPeople/recordLinkedPeople";
import { buildContactsWorkspaceHref } from "../../lib/contacts/contactRouting";

/**
 * Executors (or attorneys) named on a Will (or Power of Attorney), decided in the Inbox (owner, 11 Nov 2026):
 * found → Add (with an email, since a Will rarely has one) → Add and invite / Add without inviting → ✓ Sent (orange)
 * → ✓ Accepted (green). Uses the record page's own services. Adding, inviting or accepting never shares anything.
 */
export default function NamedPeoplePanel({ doc, onChanged }: { doc: "will" | "poa"; onChanged?: () => void }) {
  const label = doc === "will" ? "executor" : "attorney";
  const docName = doc === "will" ? "Will" : "Power of Attorney";
  const role = doc === "will" ? "Executor" : "Attorney";
  const [ownerUserId, setOwnerUserId] = useState("");
  const [people, setPeople] = useState<InboxNamedPerson[] | null>(null);
  const [form, setForm] = useState<{ key: string; name: string; email: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async (owner: string) => {
    try { setPeople((await loadInboxNamedPeople(supabase, owner, doc)).people); }
    catch { setError("We couldn’t load the names just now. Please try again."); setPeople([]); }
  }, [doc]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? "";
      if (cancelled || !id) return;
      setOwnerUserId(id);
      void reload(id);
    });
    return () => { cancelled = true; };
  }, [reload]);

  async function run(key: string, work: () => Promise<string>) {
    if (busy) return;
    setBusy(key); setError(""); setNotice("");
    try {
      const message = await work();
      setForm(null);
      setNotice(message);
      await reload(ownerUserId);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn’t work. Please try again.");
    } finally { setBusy(""); }
  }

  const invite = (person: { personId: string; recordId: string; recordType: "asset" | "record"; name: string }, resend = false) =>
    sendRecordLinkedPersonInvitation(supabase, { ownerUserId, recordType: person.recordType, recordId: person.recordId, personId: person.personId, origin: window.location.origin, resend })
      .then(() => resend ? `Invite sent to ${person.name} again` : `${person.name} invited`);

  function addFound(person: Extract<InboxNamedPerson, { kind: "found" }>, sendInvite: boolean) {
    const email = normalizeLinkedPersonEmail(form?.email ?? "");
    if (sendInvite && !email) { setError("Add an email address to invite them, or choose Add without inviting."); return; }
    void run(person.key, async () => {
      const result = await reviewLinkedPersonSuggestion(supabase, {
        ownerUserId, suggestionId: person.suggestionId, decision: "confirm", choice: "new",
        name: form?.name || person.name, role, email: email || undefined,
      });
      if (sendInvite && result.person_id) {
        await invite({ personId: result.person_id, recordId: person.recordId, recordType: person.recordType, name: form?.name || person.name });
        return `${form?.name || person.name} added and invited`;
      }
      return `${form?.name || person.name} added to People`;
    });
  }

  if (!people) return <p className="lf-inbox-message-meta" role="status">Loading the names…</p>;
  if (!people.length) return <p className="lf-inbox-message-body">Nothing to check here now. Everyone named on your {docName} is in People.</p>;

  return (
    <div className="lf-named">
      <p className="lf-named-key"><span className="is-sent">✓ Sent</span>: invite on its way · <span className="is-accepted">✓ Accepted</span>: joined Legacy Fortress</p>
      <ul className="lf-named-list">
        {people.map((person) => {
          const open = form?.key === person.key;
          return <li key={person.key} className="lf-named-row">
            <div className="lf-named-line">
              <span className="lf-named-who">
                <strong>{person.name}</strong>
                <small>{person.kind === "found"
                  ? person.match ? `Already in People as ${person.match.name}` : `Found in your ${docName} · not in People yet`
                  : person.invite === "not_invited" ? (person.email ? `${role} · not invited yet` : `${role} · no email address yet`)
                  : person.invite === "problem" ? `${role} · the invite didn’t arrive` : `${role} · in People`}</small>
              </span>
              {person.kind === "found" && person.match ? (
                <button type="button" className="lf-inbox-secondary" disabled={Boolean(busy)} onClick={() => void run(person.key, async () => {
                  await reviewLinkedPersonSuggestion(supabase, { ownerUserId, suggestionId: person.suggestionId, decision: "confirm", choice: "existing", personId: person.match!.personId, role });
                  return `${person.match!.name} confirmed as your ${label}`;
                })}>{busy === person.key ? "Saving…" : "Confirm"}</button>
              ) : person.kind === "found" ? (
                open ? null : <button type="button" className="lf-inbox-secondary" disabled={Boolean(busy)} onClick={() => { setError(""); setForm({ key: person.key, name: person.name, email: "" }); }}>Add</button>
              ) : person.invite === "accepted" ? <span className="lf-named-tick is-accepted">✓ Accepted</span>
                : person.invite === "sent" ? <span className="lf-named-tick is-sent">✓ Sent</span>
                : person.email ? <button type="button" className="lf-inbox-secondary" disabled={Boolean(busy)} onClick={() => void run(person.key, () => invite(person, person.invite === "problem"))}>{busy === person.key ? "Sending…" : person.invite === "problem" ? "Send again" : "Invite"}</button>
                : <Link className="lf-inbox-secondary" href={buildContactsWorkspaceHref(person.personId)}>Add email</Link>}
            </div>
            {person.kind === "linked" && person.invite === "sent" ? <button type="button" className="lf-inbox-quiet" disabled={Boolean(busy)} onClick={() => void run(person.key, () => invite(person, true))}>{busy === person.key ? "Sending…" : "Send the invite again"}</button> : null}
            {person.kind === "found" && open ? (
              <div className="lf-named-form">
                <label><span>Name</span><input value={form.name} autoComplete="off" onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <label><span>Role</span><input value={role} readOnly /></label>
                <label><span>Email address</span><small>Needed to invite them. We didn’t find one in your {docName}.</small><input type="email" inputMode="email" autoComplete="off" value={form.email} placeholder="name@example.com" onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                <button type="button" className="lf-inbox-primary" disabled={Boolean(busy)} onClick={() => addFound(person, true)}>{busy === person.key ? "Saving…" : "Add and invite"}</button>
                <button type="button" className="lf-inbox-quiet" disabled={Boolean(busy)} onClick={() => addFound(person, false)}>Add without inviting</button>
                <button type="button" className="lf-inbox-quiet" disabled={Boolean(busy)} onClick={() => void run(person.key, async () => {
                  await reviewLinkedPersonSuggestion(supabase, { ownerUserId, suggestionId: person.suggestionId, decision: "dismiss" });
                  return `${person.name} removed from the suggestions`;
                })}>{`This isn’t my ${label}`}</button>
                <small className="lf-named-note">The invitation names no records or details. Accepting it doesn’t let them see anything.</small>
              </div>
            ) : null}
          </li>;
        })}
      </ul>
      {notice ? <p className="lf-named-notice" role="status"><Icon name="check_circle" size={18} />{notice}</p> : null}
      {error ? <p className="lf-named-error" role="alert">{error}</p> : null}
    </div>
  );
}
