"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { buildContactsWorkspaceHref } from "../../lib/contacts/contactRouting";
import type { PeopleContactEntity } from "../../lib/contacts/contactRepository";
import { linkedPeopleConfig, loadRecordLinkedPeople, saveRecordLinkedPerson, type LinkedPerson, type LinkedRecordType } from "../../lib/linkedPeople/recordLinkedPeople";
import { supabase } from "../../lib/supabaseClient";

export default function LinkedPeopleSection({ ownerUserId, recordId, recordType, sectionKey, categoryKey, canManage }: {
  ownerUserId: string;
  recordId: string;
  recordType: LinkedRecordType;
  sectionKey: string;
  categoryKey: string;
  canManage: boolean;
}) {
  const config = linkedPeopleConfig(sectionKey, categoryKey);
  const formId = useId();
  const [links, setLinks] = useState<LinkedPerson[]>([]);
  const [contacts, setContacts] = useState<PeopleContactEntity[]>([]);
  const [mode, setMode] = useState<"closed" | "existing" | "new" | "saved">("closed");
  const [personId, setPersonId] = useState("");
  const [savedPersonId, setSavedPersonId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [role, setRole] = useState(config?.roles[0] ?? "Contact");
  const [otherRole, setOtherRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    loadRecordLinkedPeople(supabase, ownerUserId, recordType, recordId)
      .then((data) => { if (current) { setLinks(data.links); setContacts(data.contacts); setError(""); } })
      .catch(() => { if (current) setError("Linked people are unavailable. Please try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [ownerUserId, recordType, recordId]);

  if (!config) return null;
  const saved = contacts.find((contact) => contact.id === savedPersonId);
  const activeIds = new Set(links.map((link) => link.person_id));
  const availableContacts = contacts.filter((contact) => !activeIds.has(contact.id));

  const resetForm = () => {
    setMode("closed"); setPersonId(""); setName(""); setEmail(""); setPhone("");
    setRelationship(""); setRole(config.roles[0]); setOtherRole(""); setError("");
  };
  const save = async () => {
    if (!canManage || busy) return;
    setBusy(true); setError("");
    try {
      const result = await saveRecordLinkedPerson(supabase, {
        ownerUserId, recordId, recordType,
        existingPersonId: mode === "existing" ? personId : undefined,
        name, email, phone, relationship, role, roleOtherText: otherRole,
      });
      const data = await loadRecordLinkedPeople(supabase, ownerUserId, recordType, recordId);
      setLinks(data.links); setContacts(data.contacts);
      setSavedPersonId(result.personId);
      setMode("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this person.");
    } finally { setBusy(false); }
  };

  return <section className="lf-v52-record-people lf-linked-people" aria-label={config.heading}>
    <h2>{config.heading}</h2>
    {loading ? <p role="status">Loading linked people…</p> : links.length === 0 ? <p>No people recorded for this record yet.</p> :
      <ul className="lf-v52-record-person-list">{links.map((link) => {
        const contact = contacts.find((item) => item.id === link.person_id);
        const displayName = contact?.full_name || "Person unavailable";
        const verified = contact?.verification_status === "verified" || contact?.verification_status === "active";
        const invitationLabel = contact?.invite_status === "accepted" ? "Accepted"
          : contact?.invite_status === "invite_sent" ? "Invited"
          : contact?.invite_status === "failed" ? "Delivery failed"
          : contact?.invite_status === "revoked" ? "Revoked"
          : contact?.invite_status === "rejected" ? "Declined"
          : "Not invited";
        return <li key={link.id}>
          <span className="lf-v52-record-person-avatar" aria-hidden="true">{displayName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
          <span className="lf-v52-record-person-copy">
            {contact ? <Link href={buildContactsWorkspaceHref(contact.id)}>{displayName}</Link> : <strong>{displayName}</strong>}
            <small>{link.role === "Other" ? link.role_other_text : link.role} · Recorded</small>
            <small>Invitation: {invitationLabel} · Identity: {verified ? "Verified" : "Not verified"}</small>
            <small>Access: managed separately · {link.source === "extraction" ? `Confirmed from document · page ${link.source_page}` : link.manual_origin === "people" ? "Added by you from People" : "Added by you"}</small>
          </span>
        </li>;
      })}</ul>}
    {canManage && mode === "closed" ? <button type="button" className="lf-linked-people-action" onClick={() => { setError(""); setMode(availableContacts.length ? "existing" : "new"); }}>{config.action}</button> : null}
    {canManage && (mode === "existing" || mode === "new") ? <div className="lf-linked-people-form" id={formId}>
      <h3>Add a person to this record</h3>
      <div className="lf-linked-people-choice" role="group" aria-label="Person source">
        <button type="button" aria-pressed={mode === "existing"} onClick={() => setMode("existing")} disabled={!availableContacts.length}>Choose from People</button>
        <button type="button" aria-pressed={mode === "new"} onClick={() => setMode("new")}>Add new person</button>
      </div>
      {mode === "existing" ? <label>Person<select value={personId} onChange={(event) => setPersonId(event.target.value)} required><option value="">Choose a person</option>{availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}</select></label> : <>
        <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} /></label>
        <label>Relationship<input value={relationship} onChange={(event) => setRelationship(event.target.value)} maxLength={80} /></label>
        <label>Email (optional to save)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Telephone (optional)<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
      </>}
      <label>Role on this record<select value={role} onChange={(event) => setRole(event.target.value)}>{config.roles.map((option) => <option key={option}>{option}</option>)}</select></label>
      {role === "Other" ? <label>Describe role<input value={otherRole} onChange={(event) => setOtherRole(event.target.value)} required maxLength={60} /></label> : null}
      <p>Saving this person does not invite them or give them access to this record.</p>
      <div className="lf-linked-people-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="button" disabled={busy || (mode === "existing" ? !personId : !name.trim()) || (role === "Other" && !otherRole.trim())} onClick={() => void save()}>{busy ? "Saving…" : "Save person and relationship"}</button></div>
    </div> : null}
    {canManage && mode === "saved" ? <div className="lf-linked-people-form" role="status">
      <h3>Person saved to this record</h3>
      <p>Invitation is a separate action. Sending one does not grant record access.</p>
      <div className="lf-linked-people-actions">
        {saved?.email ? <Link href={buildContactsWorkspaceHref(savedPersonId)}>Review and send invitation in People</Link> : <p>Add an email in People before sending an invitation.</p>}
        <button type="button" onClick={resetForm}>Invite later</button>
        <button type="button" onClick={() => { resetForm(); setMode(availableContacts.length ? "existing" : "new"); }}>{config.action}</button>
      </div>
    </div> : null}
    {error ? <p className="lf-linked-people-error" role="alert">{error}</p> : null}
  </section>;
}
