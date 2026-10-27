"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useId, useState } from "react";
import { buildContactsWorkspaceHref } from "../../lib/contacts/contactRouting";
import type { PeopleContactEntity } from "../../lib/contacts/contactRepository";
import { LinkedPersonRecoveryError, linkedPeopleConfig, loadRecordLinkedPeople, normalizeLinkedPersonEmail, normalizeLinkedPersonPhone, saveRecordLinkedPerson, sendRecordLinkedPersonInvitation, type LinkedPerson, type LinkedRecordAccessState, type LinkedRecordType } from "../../lib/linkedPeople/recordLinkedPeople";
import { supabase } from "../../lib/supabaseClient";

export default function LinkedPeopleSection({ ownerUserId, recordId, recordType, sectionKey, categoryKey, canManage, client = supabase }: {
  ownerUserId: string;
  recordId: string;
  recordType: LinkedRecordType;
  sectionKey: string;
  categoryKey: string;
  canManage: boolean;
  client?: SupabaseClient;
}) {
  const config = linkedPeopleConfig(sectionKey, categoryKey);
  const formId = useId();
  const [links, setLinks] = useState<LinkedPerson[]>([]);
  const [contacts, setContacts] = useState<PeopleContactEntity[]>([]);
  const [accessByPerson, setAccessByPerson] = useState<Record<string, LinkedRecordAccessState>>({});
  const [mode, setMode] = useState<"closed" | "existing" | "new" | "saved" | "confirmInvite">("closed");
  const [personId, setPersonId] = useState("");
  const [savedPersonId, setSavedPersonId] = useState("");
  const [recoveryPersonId, setRecoveryPersonId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [notice, setNotice] = useState("");
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
    loadRecordLinkedPeople(client, ownerUserId, recordType, recordId)
      .then((data) => { if (current) { setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setError(""); } })
      .catch(() => { if (current) setError("Linked people are unavailable. Please try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, ownerUserId, recordType, recordId]);

  if (!config) return null;
  const saved = contacts.find((contact) => contact.id === savedPersonId);
  const activeIds = new Set(links.map((link) => link.person_id));
  const availableContacts = contacts.filter((contact) => !activeIds.has(contact.id));
  const addAction = links.length ? config.action.replace(/^Add person$/, "Add another person") : config.action.replace("another ", "");
  const matchingContacts = availableContacts.filter((contact) => `${contact.full_name} ${contact.email ?? ""} ${contact.phone ?? ""}`.toLowerCase().includes(contactSearch.trim().toLowerCase()));
  const duplicateEmailContact = mode === "new" && email.trim()
    ? contacts.find((contact) => contact.email?.toLowerCase() === email.trim().toLowerCase())
    : null;

  const resetForm = () => {
    setMode("closed"); setPersonId(""); setName(""); setEmail(""); setPhone("");
    setRelationship(""); setRole(config.roles[0]); setOtherRole(""); setError("");
    setContactSearch(""); setRecoveryPersonId("");
  };
  const save = async () => {
    if (!canManage || busy) return;
    setBusy(true); setError("");
    try {
      if (duplicateEmailContact && !recoveryPersonId) throw new Error(`This email belongs to ${duplicateEmailContact.full_name}. Choose that person from People.`);
      normalizeLinkedPersonEmail(email); normalizeLinkedPersonPhone(phone);
      const result = await saveRecordLinkedPerson(client, {
        ownerUserId, recordId, recordType,
        existingPersonId: mode === "existing" ? personId : undefined,
        recoveryPersonId: recoveryPersonId || undefined,
        name, email, phone, relationship, role, roleOtherText: otherRole,
      });
      setSavedPersonId(result.personId);
      setRecoveryPersonId(""); setNotice("");
      setMode("saved");
      try {
        const data = await loadRecordLinkedPeople(client, ownerUserId, recordType, recordId);
        setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson);
      } catch {
        setError("The relationship was saved, but its display could not be refreshed. Reopen this record to check it.");
      }
    } catch (cause) {
      if (cause instanceof LinkedPersonRecoveryError) setRecoveryPersonId(cause.personId);
      setError(cause instanceof Error ? cause.message : "Could not save this person.");
    } finally { setBusy(false); }
  };
  const sendInvitation = async () => {
    if (!canManage || busy || !savedPersonId) return;
    setBusy(true); setError("");
    try {
      const result = await sendRecordLinkedPersonInvitation(client, {
        ownerUserId, recordId, recordType, personId: savedPersonId,
        origin: window.location.origin,
      });
      try {
        const data = await loadRecordLinkedPeople(client, ownerUserId, recordType, recordId);
        setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson);
      } catch { /* The accepted request remains authoritative; avoid a second dispatch. */ }
      resetForm();
      setNotice(result.deliveryState === "auth_request_accepted"
        ? `Invitation request submitted for ${saved?.full_name ?? "this person"}. Delivery is not yet confirmed.`
        : "Invitation status updated.");
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Could not confirm the invitation request."} Check People before trying again; the request may already have been accepted.`);
    } finally { setBusy(false); }
  };

  return <section className="lf-v52-record-people lf-linked-people" aria-label={config.heading}>
    <h2>{config.heading}</h2>
    {notice ? <p className="lf-linked-people-notice" role="status">{notice}</p> : null}
    {loading ? <p role="status">Loading linked people…</p> : links.length === 0 ? <p>{config.heading === "Executors" ? "No executors linked yet. Add them one at a time." : "No people linked yet. Add them one at a time."}</p> :
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
            <small>{link.role === "Other" ? link.role_other_text : link.role}{contact?.relationship ? ` · ${contact.relationship}` : ""} · Recorded</small>
            {contact ? <small>{[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</small> : null}
            <small>Invitation: {invitationLabel} · Identity: {verified ? "Verified" : "Not verified"}</small>
            <small>Access: {accessByPerson[link.person_id] === "explicit" ? "Explicit record access selected" : accessByPerson[link.person_id] === "unavailable" ? "Status unavailable" : "No explicit record access"}</small>
            <small>{link.source === "extraction" ? `Confirmed from document · page ${link.source_page}` : link.manual_origin === "people" ? "Added by you from People" : "Added by you"}</small>
          </span>
        </li>;
      })}</ul>}
    {canManage && mode === "closed" ? <button type="button" className="lf-linked-people-action" disabled={loading} onClick={() => { setError(""); setNotice(""); setMode(availableContacts.length ? "existing" : "new"); }}>{addAction}</button> : null}
    {canManage && (mode === "existing" || mode === "new") ? <div className="lf-linked-people-form" id={formId}>
      <h3>{config.heading === "Executors" ? "Add an executor" : "Add a person to this record"}</h3>
      {links.length ? <p>Already saved: {links.map((link) => contacts.find((contact) => contact.id === link.person_id)?.full_name).filter(Boolean).join(", ")}</p> : null}
      <div className="lf-linked-people-choice" role="group" aria-label="Person source">
        <button type="button" aria-pressed={mode === "existing"} onClick={() => setMode("existing")} disabled={!availableContacts.length}>Choose from People</button>
        <button type="button" aria-pressed={mode === "new"} onClick={() => setMode("new")}>Add new person</button>
      </div>
      {mode === "existing" ? <>
        <label>Search your People<input type="search" value={contactSearch} onChange={(event) => { setContactSearch(event.target.value); setPersonId(""); }} placeholder="Name, email or telephone" /></label>
        <label>Person<select value={personId} onChange={(event) => setPersonId(event.target.value)} required><option value="">Choose a person</option>{matchingContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}{contact.relationship ? ` · ${contact.relationship}` : ""}</option>)}</select></label>
        {matchingContacts.length === 0 ? <p>No matching people in your Vault.</p> : null}
      </> : <>
        <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} /></label>
        <label>Relationship<input value={relationship} onChange={(event) => setRelationship(event.target.value)} maxLength={80} /></label>
        <label>Email (optional to save)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        {duplicateEmailContact ? <p role="alert">This email belongs to {duplicateEmailContact.full_name}. Choose that person from People.</p> : null}
        <label>Telephone (optional)<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="07700 900123" /></label>
      </>}
      <label>Role on this record<select value={role} onChange={(event) => setRole(event.target.value)}>{config.roles.map((option) => <option key={option}>{option}</option>)}</select></label>
      {role === "Other" ? <label>Describe role<input value={otherRole} onChange={(event) => setOtherRole(event.target.value)} required maxLength={60} /></label> : null}
      <p>Linking a person records their role. It does not let them see this record. You choose access separately.</p>
      {recoveryPersonId ? <p role="status">The person is saved in People. Retry the link without creating them again.</p> : null}
      <div className="lf-linked-people-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="button" disabled={busy || (mode === "existing" ? !personId : !name.trim()) || Boolean(duplicateEmailContact && !recoveryPersonId) || (role === "Other" && !otherRole.trim())} onClick={() => void save()}>{busy ? "Saving…" : recoveryPersonId ? "Retry relationship" : "Save person and relationship"}</button></div>
    </div> : null}
    {canManage && mode === "saved" ? <div className="lf-linked-people-form" role="status">
      <h3>{saved?.full_name ?? "Person"} saved to this record</h3>
      <p>Invite {saved?.full_name ?? "this person"} to connect in Legacy Fortress? It will not share this record or any other record.</p>
      <div className="lf-linked-people-actions">
        {saved?.email && !["invite_sent", "accepted"].includes(saved.invite_status) ? <button type="button" onClick={() => { setError(""); setMode("confirmInvite"); }}>Send invitation</button> : saved?.email ? <p>This person is already invited or connected.</p> : <Link href={buildContactsWorkspaceHref(savedPersonId)}>Add email and invite</Link>}
        <button type="button" onClick={() => { resetForm(); setNotice(`${saved?.full_name ?? "Person"} remains linked. No invitation was sent.`); }}>{saved?.email && ["invite_sent", "accepted"].includes(saved.invite_status) ? "Back to record" : "Invite later"}</button>
      </div>
    </div> : null}
    {canManage && mode === "confirmInvite" ? <div className="lf-linked-people-form" role="group" aria-label="Confirm invitation">
      <h3>Invite {saved?.full_name ?? "this person"}</h3>
      <p>Email: <strong>{saved?.email}</strong></p>
      <p>They will receive a request to create an account and connect with you. They will not receive this record, its documents, or access to your Vault. Access must be shared separately.</p>
      <div className="lf-linked-people-actions"><button type="button" disabled={busy} onClick={() => { setError(""); setMode("saved"); }}>Back</button><button type="button" disabled={busy || !saved?.email} onClick={() => void sendInvitation()}>{busy ? "Submitting…" : "Send invitation"}</button></div>
    </div> : null}
    {error ? <p className="lf-linked-people-error" role="alert">{error}</p> : null}
  </section>;
}
