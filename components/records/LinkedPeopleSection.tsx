"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useId, useState } from "react";
import { buildContactsWorkspaceHref } from "../../lib/contacts/contactRouting";
import type { PeopleContactEntity } from "../../lib/contacts/contactRepository";
import { LinkedPersonRecoveryError, changeRecordLinkedPersonRole, linkedPeopleConfig, loadRecordLinkedPeople, loadRecordLinkedPeopleHistory, normalizeLinkedPersonEmail, normalizeLinkedPersonPhone, saveRecordLinkedPerson, searchLinkedPeopleContacts, sendRecordLinkedPersonInvitation, unlinkRecordLinkedPerson, type LinkedPerson, type LinkedPersonHistoryEvent, type LinkedRecordAccessState, type LinkedRecordType } from "../../lib/linkedPeople/recordLinkedPeople";
import { loadLinkedPersonSuggestions, reviewLinkedPersonSuggestion, type LinkedPersonSuggestion } from "../../lib/linkedPeople/suggestions";
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
  const [documentTitles, setDocumentTitles] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"closed" | "existing" | "new" | "saved" | "confirmInvite" | "reviewSuggestion" | "editRole" | "confirmUnlink">("closed");
  const [managedLinkId, setManagedLinkId] = useState("");
  const [history, setHistory] = useState<LinkedPersonHistoryEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [suggestions, setSuggestions] = useState<LinkedPersonSuggestion[]>([]);
  const [suggestionId, setSuggestionId] = useState("");
  const [suggestionChoice, setSuggestionChoice] = useState<"" | "existing" | "new">("");
  const [suggestionError, setSuggestionError] = useState("");
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
      .then((data) => { if (current) { setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles); setError(""); } })
      .catch(() => { if (current) setError("Linked people are unavailable. Please try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, ownerUserId, recordType, recordId]);

  useEffect(() => {
    if (recordType !== "asset" || !canManage) return;
    let current = true;
    loadLinkedPersonSuggestions(client, ownerUserId, recordId)
      .then((rows) => { if (current) setSuggestions(rows); })
      .catch(() => { if (current) setSuggestionError("Document suggestions are unavailable."); });
    return () => { current = false; };
  }, [client, ownerUserId, recordId, recordType, canManage]);

  if (!config) return null;
  const saved = contacts.find((contact) => contact.id === savedPersonId);
  const activeIds = new Set(links.map((link) => link.person_id));
  const availableContacts = contacts.filter((contact) => !activeIds.has(contact.id));
  const addAction = links.length ? config.action.replace(/^Add person$/, "Add another person") : config.action.replace("another ", "");
  const matchingContacts = searchLinkedPeopleContacts(contacts, activeIds, contactSearch);
  const duplicateEmailContact = mode === "new" && email.trim()
    ? contacts.find((contact) => contact.email?.toLowerCase() === email.trim().toLowerCase())
    : null;
  const selectedSuggestion = suggestions.find((item) => item.id === suggestionId);
  const managedLink = links.find((link) => link.id === managedLinkId);
  const managedContact = contacts.find((contact) => contact.id === managedLink?.person_id);
  let invalidContactField = "";
  if (mode === "new" && !recoveryPersonId) {
    try { normalizeLinkedPersonEmail(email); } catch { invalidContactField = "Enter a valid email address, or leave it blank."; }
    if (!invalidContactField) try { normalizeLinkedPersonPhone(phone); } catch { invalidContactField = "Enter a valid telephone number, or leave it blank."; }
  }
  const saveBlocker = mode === "existing" && !personId ? "Select a person from the matching results."
    : mode === "new" && !name.trim() && !recoveryPersonId ? "Full name is required."
    : mode === "new" && duplicateEmailContact && !recoveryPersonId ? "Use the existing person with this email."
    : invalidContactField || (role === "Other" && !otherRole.trim() ? "Describe this person's role on this record." : "");

  const resetForm = () => {
    setMode("closed"); setPersonId(""); setName(""); setEmail(""); setPhone("");
    setRelationship(""); setRole(config.roles[0]); setOtherRole(""); setError("");
    setContactSearch(""); setRecoveryPersonId("");
    setSuggestionId(""); setSuggestionChoice("");
    setManagedLinkId("");
  };
  const refreshLinks = async () => {
    const data = await loadRecordLinkedPeople(client, ownerUserId, recordType, recordId);
    setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles);
  };
  const openHistory = async () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true); setHistoryLoading(true); setHistoryError("");
    try { setHistory(await loadRecordLinkedPeopleHistory(client, { ownerUserId, recordType, recordId })); }
    catch { setHistoryError("Record-link history is unavailable. No history has been inferred."); }
    finally { setHistoryLoading(false); }
  };
  const saveRole = async () => {
    if (!canManage || busy || !managedLinkId || saveBlocker) return;
    setBusy(true); setError("");
    try {
      await changeRecordLinkedPersonRole(client, { ownerUserId, recordType, recordId, linkId: managedLinkId, role, roleOtherText: otherRole });
      await refreshLinks(); setHistoryOpen(false); resetForm();
      setNotice(`Role on this record updated for ${managedContact?.full_name ?? "this person"}. Their People relationship and access were not changed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this record role."); }
    finally { setBusy(false); }
  };
  const removeLink = async () => {
    if (!canManage || busy || !managedLinkId) return;
    setBusy(true); setError("");
    try {
      await unlinkRecordLinkedPerson(client, { ownerUserId, recordType, recordId, linkId: managedLinkId });
      await refreshLinks(); setHistoryOpen(false); resetForm();
      setNotice(`${managedContact?.full_name ?? "Person"} was unlinked from this record. Their contact and any separate access grant were not changed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not unlink this person."); }
    finally { setBusy(false); }
  };
  const openSuggestion = (suggestion: LinkedPersonSuggestion) => {
    const suggestedRole = config.roles.find((item) => item.toLowerCase() === suggestion.extracted_role?.toLowerCase());
    setSuggestionId(suggestion.id); setSuggestionChoice(""); setPersonId("");
    setName(suggestion.extracted_name); setRole(suggestedRole || (suggestion.extracted_role ? "Other" : config.roles[0]));
    setOtherRole(suggestedRole ? "" : suggestion.extracted_role || "");
    setEmail(""); setPhone(""); setError(""); setNotice(""); setMode("reviewSuggestion");
  };
  const decideSuggestion = async (decision: "confirm" | "dismiss", targetSuggestion = selectedSuggestion) => {
    if (!canManage || busy || !targetSuggestion) return;
    setBusy(true); setError("");
    try {
      const result = await reviewLinkedPersonSuggestion(client, {
        ownerUserId, suggestionId: targetSuggestion.id, decision,
        choice: suggestionChoice || undefined, personId, name, role,
        roleOtherText: otherRole, email, phone,
      });
      setSuggestions((current) => current.filter((item) => item.id !== targetSuggestion.id));
      if (decision === "dismiss") {
        resetForm(); setNotice("Suggestion dismissed. No person or relationship was added.");
      } else {
        setSavedPersonId(result.person_id || ""); setMode("saved");
        try {
          const data = await loadRecordLinkedPeople(client, ownerUserId, recordType, recordId);
          setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles);
        } catch {
          setError("The relationship was saved, but the display could not refresh. Reopen this record before inviting.");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review this suggestion.");
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!canManage || busy) return;
    setBusy(true); setError("");
    try {
      if (duplicateEmailContact && !recoveryPersonId) throw new Error(`This email belongs to ${duplicateEmailContact.full_name}. Choose that person from People.`);
      if (mode === "new" && !recoveryPersonId) { normalizeLinkedPersonEmail(email); normalizeLinkedPersonPhone(phone); }
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
        setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles);
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
        setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles);
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
    {suggestionError ? <p role="status">{suggestionError}</p> : null}
    {loading ? <p role="status">Loading linked people…</p> : links.length === 0 ? <p>{config.heading === "Executors" ? "No executors linked yet. Add them one at a time." : "No people linked yet. Add them one at a time."}</p> :
      <ul className="lf-v52-record-person-list">{links.map((link) => {
        const contact = contacts.find((item) => item.id === link.person_id);
        const displayName = contact?.full_name || "Person unavailable";
        const verified = contact?.verification_status === "verified" || contact?.verification_status === "active";
        const invitationLabel = contact?.invite_status === "accepted" ? "Accepted"
          : contact?.invite_status === "invite_sent" ? "Invited"
          : contact?.invite_status === "failed" ? "Delivery failed"
          : contact?.invite_status === "not_delivered" ? "Not delivered"
          : contact?.invite_status === "expired" ? "Expired"
          : contact?.invite_status === "revoked" ? "Revoked"
          : contact?.invite_status === "rejected" ? "Declined"
          : "Not invited";
        return <li key={link.id}>
          <span className="lf-v52-record-person-avatar" aria-hidden="true">{displayName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
          <span className="lf-v52-record-person-copy">
            {contact ? <Link href={buildContactsWorkspaceHref(contact.id)}>{displayName}</Link> : <strong>{displayName}</strong>}
            <small>Role on this record: {link.role === "Other" ? link.role_other_text : link.role}</small>
            {contact?.relationship ? <small>Relationship in People: {contact.relationship}</small> : null}
            {contact ? <small>{[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</small> : null}
            <small>Invitation: {invitationLabel} · Identity: {verified ? "Verified" : "Not verified"}</small>
            <small>Access: {accessByPerson[link.person_id] === "explicit" ? "Explicit record access selected" : accessByPerson[link.person_id] === "unavailable" ? "Status unavailable" : "No explicit record access"}</small>
            <small>{link.source === "extraction" ? `From ${documentTitles[link.source_document_id || ""] || "document"} · page ${link.source_page} · confirmed by you` : link.manual_origin === "people" ? "Added by you from People" : "Added by you"}</small>
            {contact ? <span className="lf-linked-people-row-actions">
              <Link href={buildContactsWorkspaceHref(contact.id)}>View / Edit contact</Link>
              {canManage ? <>
                <button type="button" disabled={busy || mode !== "closed"} onClick={() => { setManagedLinkId(link.id); setRole(link.role); setOtherRole(link.role_other_text ?? ""); setNotice(""); setError(""); setMode("editRole"); }}>Edit record role</button>
                <Link href={buildContactsWorkspaceHref(contact.id, true)}>Manage access</Link>
                <button type="button" disabled={busy || mode !== "closed"} onClick={() => { setManagedLinkId(link.id); setNotice(""); setError(""); setMode("confirmUnlink"); }}>Unlink from record</button>
              </> : null}
            </span> : null}
          </span>
        </li>;
      })}</ul>}
    {canManage ? <div className="lf-linked-people-history">
      <button type="button" className="lf-linked-people-history-toggle" aria-expanded={historyOpen} onClick={() => void openHistory()}>{historyOpen ? "Hide record-link history" : "Show record-link history"}</button>
      {historyOpen ? historyLoading ? <p role="status">Loading history…</p> : historyError ? <p role="status">{historyError}</p> : history.length ? <ol>{history.map((event) => {
        const contact = contacts.find((item) => item.id === event.person_id);
        const action = event.action === "link.created" ? "Linked to record" : event.action === "link.role_changed" ? "Record role changed" : "Unlinked from record";
        return <li key={event.id}><span>{action}{contact ? ` · ${contact.full_name}` : ""}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></li>;
      })}</ol> : <p>No recorded link changes yet.</p> : null}
    </div> : null}
    {canManage && suggestions.length ? <div className="lf-linked-people-suggestions">
      <h3>We found in this document</h3>
      <p>Review each saved suggestion against its source. Nothing changes until you confirm.</p>
      <ul>{suggestions.map((suggestion) => {
        const match = contacts.find((contact) => contact.id === suggestion.match_person_id);
        return <li key={suggestion.id}>
          <strong>{suggestion.extracted_name}</strong>
          <span>{suggestion.extracted_role || "Role needs review"} · {suggestion.document_title} · page {suggestion.page}</span>
          {match ? <span>{suggestion.match_kind === "possible" ? "Possible match" : "Matched in People"}: {match.full_name}. Confirm who this is before linking.</span> : null}
          <div className="lf-linked-people-actions"><button type="button" disabled={busy} onClick={() => openSuggestion(suggestion)}>Review person</button><button type="button" disabled={busy} onClick={() => void decideSuggestion("dismiss", suggestion)}>Not now</button></div>
        </li>;
      })}</ul>
    </div> : null}
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
        <div className="lf-linked-people-picker" role="group" aria-label="Matching people">
          {matchingContacts.map((contact) => <button key={contact.id} type="button" aria-pressed={personId === contact.id} onClick={() => setPersonId(contact.id)}>
            <strong>{contact.full_name}</strong><span>{[contact.relationship, contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</span><small>{personId === contact.id ? "Selected" : "Select person"}</small>
          </button>)}
        </div>
        {matchingContacts.length === 0 ? <p>No matching people in your Vault.</p> : null}
      </> : <>
        <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} /></label>
        <label>Relationship in People (optional)<input value={relationship} onChange={(event) => setRelationship(event.target.value)} maxLength={80} /></label>
        <label>Email (optional to save)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        {duplicateEmailContact ? <div role="alert" className="lf-linked-people-duplicate"><p>This email belongs to {duplicateEmailContact.full_name}.</p>{activeIds.has(duplicateEmailContact.id) ? <Link href={buildContactsWorkspaceHref(duplicateEmailContact.id)}>View linked person</Link> : <button type="button" onClick={() => { setMode("existing"); setContactSearch(duplicateEmailContact.full_name); setPersonId(duplicateEmailContact.id); }}>Use existing person</button>}</div> : null}
        <label>Telephone (optional)<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="07700 900123" /></label>
      </>}
      <label>Role on this record<select value={role} onChange={(event) => setRole(event.target.value)}>{config.roles.map((option) => <option key={option}>{option}</option>)}</select></label>
      {role === "Other" ? <label>Describe role<input value={otherRole} onChange={(event) => setOtherRole(event.target.value)} required maxLength={60} /></label> : null}
      <p>The People relationship describes how you know them. Their role applies only to this record. Linking does not grant access.</p>
      {recoveryPersonId ? <p role="status">The person is saved in People. Retry the link without creating them again.</p> : null}
      {saveBlocker ? <p className="lf-linked-people-validation" role="status">To save: {saveBlocker}</p> : null}
      <div className="lf-linked-people-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="button" disabled={busy || Boolean(saveBlocker)} onClick={() => void save()}>{busy ? "Saving…" : recoveryPersonId ? "Retry relationship" : "Save person and relationship"}</button></div>
    </div> : null}
    {canManage && mode === "editRole" && managedLink ? <div className="lf-linked-people-form" role="group" aria-label="Edit record role">
      <h3>Edit {managedContact?.full_name ?? "person"}&apos;s role</h3>
      <p>This changes only the role on this record. Their People relationship, invitation and access remain separate.</p>
      <label>Role on this record<select value={role} onChange={(event) => setRole(event.target.value)}>{!config.roles.includes(managedLink.role) ? <option value={managedLink.role}>{managedLink.role}</option> : null}{config.roles.map((option) => <option key={option}>{option}</option>)}</select></label>
      {role === "Other" ? <label>Describe role<input value={otherRole} onChange={(event) => setOtherRole(event.target.value)} maxLength={60} /></label> : null}
      {saveBlocker ? <p role="status">To save: {saveBlocker}</p> : null}
      <div className="lf-linked-people-actions"><button type="button" onClick={resetForm} disabled={busy}>Cancel</button><button type="button" disabled={busy || Boolean(saveBlocker)} onClick={() => void saveRole()}>{busy ? "Saving…" : "Save record role"}</button></div>
    </div> : null}
    {canManage && mode === "confirmUnlink" && managedLink ? <div className="lf-linked-people-form" role="group" aria-label="Confirm unlink">
      <h3>Unlink {managedContact?.full_name ?? "this person"}?</h3>
      <p>Their contact and links to other records remain. Any explicit access grant must be reviewed separately in Manage access.</p>
      {accessByPerson[managedLink.person_id] === "explicit" && managedContact ? <p role="alert">This person still has explicit access to this record. <Link href={buildContactsWorkspaceHref(managedContact.id, true)}>Manage access</Link> separately if you want to stop it.</p> : null}
      <div className="lf-linked-people-actions"><button type="button" onClick={resetForm} disabled={busy}>Cancel</button><button type="button" disabled={busy} onClick={() => void removeLink()}>{busy ? "Unlinking…" : "Unlink from this record"}</button></div>
    </div> : null}
    {canManage && mode === "saved" ? <div className="lf-linked-people-form" role="status">
      <h3>{saved?.full_name ?? "Person"} saved to this record</h3>
      <p>Invite {saved?.full_name ?? "this person"} to connect in Legacy Fortress? It will not share this record or any other record.</p>
      <div className="lf-linked-people-actions">
        {saved?.email && !["invite_sent", "accepted"].includes(saved.invite_status) ? <button type="button" onClick={() => { setError(""); setMode("confirmInvite"); }}>Invite to connect</button> : saved?.email ? <p>This person is already invited or connected.</p> : <Link href={buildContactsWorkspaceHref(savedPersonId)}>Add email and invite</Link>}
        <button type="button" onClick={() => { resetForm(); setNotice(`${saved?.full_name ?? "Person"} remains linked. No invitation was sent.`); }}>{saved?.email && ["invite_sent", "accepted"].includes(saved.invite_status) ? "Back to record" : "Invite later"}</button>
      </div>
      <div className="lf-linked-people-actions">
        {saved ? <Link href={buildContactsWorkspaceHref(saved.id)}>View / Edit contact</Link> : null}
        {links.find((link) => link.person_id === savedPersonId) ? <button type="button" onClick={() => { const link = links.find((item) => item.person_id === savedPersonId); if (!link) return; setManagedLinkId(link.id); setRole(link.role); setOtherRole(link.role_other_text ?? ""); setMode("editRole"); }}>Edit record role</button> : null}
        {saved ? <Link href={buildContactsWorkspaceHref(saved.id, true)}>Manage access</Link> : null}
      </div>
    </div> : null}
    {canManage && mode === "confirmInvite" ? <div className="lf-linked-people-form" role="group" aria-label="Confirm invitation">
      <h3>Invite {saved?.full_name ?? "this person"}</h3>
      <p>Email: <strong>{saved?.email}</strong></p>
      <p>They will receive a request to create an account and connect with you. They will not receive this record, its documents, or access to your Vault. Access must be shared separately.</p>
      <div className="lf-linked-people-actions"><button type="button" disabled={busy} onClick={() => { setError(""); setMode("saved"); }}>Back</button><button type="button" disabled={busy || !saved?.email} onClick={() => void sendInvitation()}>{busy ? "Submitting…" : "Send invitation"}</button></div>
    </div> : null}
    {canManage && mode === "reviewSuggestion" && selectedSuggestion ? <div className="lf-linked-people-form" role="group" aria-label="Review suggested person">
      <h3>Review {selectedSuggestion.extracted_name}</h3>
      <p>Suggested by {selectedSuggestion.document_title} · page {selectedSuggestion.page}. Check the document before confirming; this suggestion has not created a contact or link.</p>
      <div className="lf-linked-people-choice" role="group" aria-label="Match this person">
        <button type="button" aria-pressed={suggestionChoice === "existing"} onClick={() => setSuggestionChoice("existing")}>Choose from People</button>
        <button type="button" aria-pressed={suggestionChoice === "new"} onClick={() => setSuggestionChoice("new")}>Add new person</button>
      </div>
      {suggestionChoice === "existing" ? <label>Person<select value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="">Choose a person</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}{contact.id === selectedSuggestion.match_person_id ? " · suggested match" : ""}</option>)}</select></label> : null}
      {suggestionChoice === "new" ? <>
        <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
        <label>Email (optional)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Telephone (optional)<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      </> : null}
      <label>Role on this record<select value={role} onChange={(event) => setRole(event.target.value)}>{config.roles.map((option) => <option key={option}>{option}</option>)}</select></label>
      {role === "Other" ? <label>Describe role<input value={otherRole} onChange={(event) => setOtherRole(event.target.value)} maxLength={60} /></label> : null}
      <p>Confirming saves the person and relationship together. It does not send an invitation or grant access.</p>
      <div className="lf-linked-people-actions"><button type="button" disabled={busy} onClick={resetForm}>Back</button><button type="button" disabled={busy} onClick={() => void decideSuggestion("dismiss")}>Dismiss suggestion</button><button type="button" disabled={busy || !suggestionChoice || (suggestionChoice === "existing" ? !personId : !name.trim()) || (role === "Other" && !otherRole.trim())} onClick={() => void decideSuggestion("confirm")}>Save person and relationship</button></div>
    </div> : null}
    {error ? <p className="lf-linked-people-error" role="alert">{error}</p> : null}
  </section>;
}
