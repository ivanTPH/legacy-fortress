"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { Sheet } from "../ui/V3Primitives";
import { buildContactsWorkspaceHref } from "../../lib/contacts/contactRouting";
import type { PeopleContactEntity } from "../../lib/contacts/contactRepository";
import { LinkedPersonRecoveryError, changeRecordLinkedPersonRole, linkedPeopleConfig, linkedPersonFormIssues, loadRecordLinkedPeople, loadRecordLinkedPeopleHistory, normalizeLinkedPersonEmail, normalizeLinkedPersonPhone, saveRecordLinkedPerson, searchLinkedPeopleContacts, sendRecordLinkedPersonInvitation, unlinkRecordLinkedPerson, type LinkedPerson, type LinkedPersonHistoryEvent, type LinkedRecordAccessState, type LinkedRecordType } from "../../lib/linkedPeople/recordLinkedPeople";
import { loadLinkedPersonSuggestions, reviewLinkedPersonSuggestion, type LinkedPersonSuggestion } from "../../lib/linkedPeople/suggestions";
import { supabase } from "../../lib/supabaseClient";

export default function LinkedPeopleSection({ ownerUserId, recordId, recordType, recordTitle, sectionKey, categoryKey, canManage, autoOpen = false, onAutoOpened, client = supabase }: {
  ownerUserId: string;
  recordId: string;
  recordType: LinkedRecordType;
  recordTitle?: string;
  sectionKey: string;
  categoryKey: string;
  canManage: boolean;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
  client?: SupabaseClient;
}) {
  const config = linkedPeopleConfig(sectionKey, categoryKey);
  const formId = useId();
  const [links, setLinks] = useState<LinkedPerson[]>([]);
  const [contacts, setContacts] = useState<PeopleContactEntity[]>([]);
  const [accessByPerson, setAccessByPerson] = useState<Record<string, LinkedRecordAccessState>>({});
  const [documentTitles, setDocumentTitles] = useState<Record<string, string>>({});
  const [otherRecordCounts, setOtherRecordCounts] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"closed" | "choose" | "existing" | "new" | "saved" | "viewContact" | "confirmInvite" | "reviewSuggestion" | "editRole" | "confirmUnlink" | "discard">("closed");
  const [discardReturnMode, setDiscardReturnMode] = useState<"existing" | "new">("new");
  const [online, setOnline] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const validationRef = useRef<HTMLDivElement>(null);
  const autoOpenHandledRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<() => void>(() => {});
  const [managedLinkId, setManagedLinkId] = useState("");
  const [rowActionLinkId, setRowActionLinkId] = useState("");
  const rowActionTriggerRef = useRef<HTMLElement | null>(null);
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
  const [role, setRole] = useState("");
  const [otherRole, setOtherRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const recordLabel = recordTitle?.trim() || "this record";

  useEffect(() => {
    let current = true;
    loadRecordLinkedPeople(client, ownerUserId, recordType, recordId)
      .then((data) => { if (current) { setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles); setOtherRecordCounts(data.otherRecordCounts); setError(""); } })
      .catch(() => { if (current) setError("Linked people are unavailable. Please try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, ownerUserId, recordType, recordId]);

  useEffect(() => {
    if (!autoOpen || !canManage || loading || autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = true;
    setMode("choose");
    onAutoOpened?.();
  }, [autoOpen, canManage, loading, onAutoOpened]);

  useEffect(() => {
    if (recordType !== "asset" || !canManage) return;
    let current = true;
    loadLinkedPersonSuggestions(client, ownerUserId, recordId)
      .then((rows) => { if (current) setSuggestions(rows); })
      .catch(() => { if (current) setSuggestionError("Document suggestions are unavailable."); });
    return () => { current = false; };
  }, [client, ownerUserId, recordId, recordType, canManage]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  const saved = contacts.find((contact) => contact.id === savedPersonId);
  const activeIds = new Set(links.map((link) => link.person_id));
  const availableContacts = contacts.filter((contact) => !activeIds.has(contact.id));
  const addAction = links.length ? (config?.action ?? "Add person").replace(/^Add person$/, "Add another person") : (config?.action ?? "Add person").replace("another ", "");
  const matchingContacts = searchLinkedPeopleContacts(contacts, activeIds, contactSearch);
  const duplicateEmailContact = mode === "new" && email.trim()
    ? contacts.find((contact) => contact.email?.toLowerCase() === email.trim().toLowerCase())
    : null;
  const enteredName = name.trim().toLocaleLowerCase();
  const possibleNameMatch = mode === "new" && enteredName.length >= 3
    ? contacts.find((contact) => contact.full_name.trim().toLocaleLowerCase() === enteredName && contact.id !== duplicateEmailContact?.id)
    : null;
  const selectedSuggestion = suggestions.find((item) => item.id === suggestionId);
  const managedLink = links.find((link) => link.id === managedLinkId);
  const managedContact = contacts.find((contact) => contact.id === managedLink?.person_id);
  const rowActionLink = links.find((link) => link.id === rowActionLinkId);
  const rowActionContact = contacts.find((contact) => contact.id === rowActionLink?.person_id);
  const validationIssues = mode === "existing" || mode === "new" || mode === "editRole" ? linkedPersonFormIssues({
    mode, personId, recoveryPersonId, name, email, phone, role, roleOtherText: otherRole,
    duplicateEmail: Boolean(duplicateEmailContact), online, recordLabel,
  }) : [];
  const saveBlocker = validationIssues[0]?.message ?? "";
  const showValidationIssues = Boolean(error && error === saveBlocker && validationIssues.length);
  const issueFor = (field: typeof validationIssues[number]["field"]) => showValidationIssues ? validationIssues.find((issue) => issue.field === field)?.message : undefined;

  const requestClose = () => {
    if (busy) return;
    if (mode === "discard") { setMode(discardReturnMode); return; }
    if (mode === "confirmInvite") { setMode("saved"); return; }
    if (mode === "viewContact") { setMode("saved"); return; }
    if (mode === "saved") { resetForm(); return; }
    if ((mode === "new" || mode === "existing") && (name.trim() || email.trim() || phone.trim() || relationship.trim() || otherRole.trim())) {
      setDiscardReturnMode(mode); setMode("discard"); return;
    }
    resetForm();
  };

  const resetForm = () => {
    setMode("closed"); setPersonId(""); setName(""); setEmail(""); setPhone("");
    setRelationship(""); setRole(""); setOtherRole(""); setError("");
    setContactSearch(""); setRecoveryPersonId(""); setSavedPersonId("");
    setSuggestionId(""); setSuggestionChoice("");
    setManagedLinkId("");
  };
  const beginAnotherPerson = () => {
    resetForm();
    setNotice("");
    setMode("choose");
  };
  useEffect(() => { closeRef.current = requestClose; });
  useEffect(() => {
    if (mode === "closed") { returnFocusRef.current?.focus(); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button, input, a, select")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [mode]);

  if (!config) return null;
  const refreshLinks = async () => {
    const data = await loadRecordLinkedPeople(client, ownerUserId, recordType, recordId);
    setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles); setOtherRecordCounts(data.otherRecordCounts);
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
          setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles); setOtherRecordCounts(data.otherRecordCounts);
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
    if (saveBlocker) {
      setError(saveBlocker);
      requestAnimationFrame(() => validationRef.current?.focus());
      return;
    }
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
        setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles); setOtherRecordCounts(data.otherRecordCounts);
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
        setLinks(data.links); setContacts(data.contacts); setAccessByPerson(data.accessByPerson); setDocumentTitles(data.documentTitles); setOtherRecordCounts(data.otherRecordCounts);
      } catch { /* The accepted request remains authoritative; avoid a second dispatch. */ }
      resetForm();
      setNotice(result.deliveryState === "auth_request_accepted"
        ? `Invitation request submitted for ${saved?.full_name ?? "this person"}. Delivery is not yet confirmed.`
        : "Invitation status updated.");
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Could not confirm the invitation request."} Check People before trying again; the request may already have been accepted.`);
    } finally { setBusy(false); }
  };

  const closeRowActions = () => setRowActionLinkId("");
  const renderRowActions = (link: LinkedPerson, contact: PeopleContactEntity, mobile: boolean) => <>
    <Link href={buildContactsWorkspaceHref(contact.id)} onClick={mobile ? closeRowActions : undefined}>View / Edit contact</Link>
    {canManage ? <>
      <button type="button" disabled={busy || mode !== "closed"} onClick={(event) => { returnFocusRef.current = mobile ? rowActionTriggerRef.current : event.currentTarget; if (mobile) closeRowActions(); setManagedLinkId(link.id); setRole(link.role); setOtherRole(link.role_other_text ?? ""); setNotice(""); setError(""); setMode("editRole"); }}>Change role on this record</button>
      <Link href={buildContactsWorkspaceHref(contact.id, true)} onClick={mobile ? closeRowActions : undefined}>Manage access</Link>
      {contact.email && !["accepted", "invite_sent"].includes(contact.invite_status) ? <button type="button" disabled={busy || mode !== "closed"} onClick={(event) => { returnFocusRef.current = mobile ? rowActionTriggerRef.current : event.currentTarget; if (mobile) closeRowActions(); setSavedPersonId(contact.id); setError(""); setMode("saved"); }}>Invite to connect</button> : null}
      {!contact.email ? <Link href={buildContactsWorkspaceHref(contact.id)} onClick={mobile ? closeRowActions : undefined}>Add email to invite</Link> : null}
      <button type="button" disabled={busy || mode !== "closed"} onClick={(event) => { returnFocusRef.current = mobile ? rowActionTriggerRef.current : event.currentTarget; if (mobile) closeRowActions(); setManagedLinkId(link.id); setNotice(""); setError(""); setMode("confirmUnlink"); }}>Remove from this record</button>
    </> : null}
  </>;

  return <section className="lf-v52-record-people lf-linked-people" aria-label={config.heading}>
    <h2>{config.heading}</h2>
    {notice ? <p className="lf-linked-people-notice" role="status">{notice}</p> : null}
    {suggestionError ? <p role="status">{suggestionError}</p> : null}
    {loading ? <p role="status">Loading linked people…</p> : links.length === 0 ? <p>{config.heading === "Executors" ? "No executors linked yet. Add them one at a time." : "No people linked yet. Add them one at a time."}</p> :
      <ul className="lf-v52-record-person-list">{links.map((link) => {
        const contact = contacts.find((item) => item.id === link.person_id);
        const displayName = contact?.full_name || "Person unavailable";
        const verified = contact?.verification_status === "verified" || contact?.verification_status === "active";
        const invitationLabel = contact?.invite_status === "accepted" ? "Joined"
          : contact?.invite_status === "invite_sent" ? "Invite sent"
          : contact?.invite_status === "failed" ? "Delivery failed"
          : contact?.invite_status === "not_delivered" ? "Not delivered"
          : contact?.invite_status === "expired" ? "Expired"
          : contact?.invite_status === "revoked" ? "Revoked"
          : contact?.invite_status === "rejected" ? "Declined"
          : "Not invited";
        return <li key={link.id}>
          <span className="lf-v52-record-person-avatar" aria-hidden="true">{displayName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
          <div className="lf-v52-record-person-copy">
            {contact ? <Link href={buildContactsWorkspaceHref(contact.id)}>{displayName}</Link> : <strong>{displayName}</strong>}
            <small>Role on this record: {link.role === "Other" ? link.role_other_text : link.role}</small>
            {contact?.relationship ? <small>Relationship in People: {contact.relationship}</small> : null}
            {otherRecordCounts[link.person_id] ? <small>Also linked to {otherRecordCounts[link.person_id]} other {otherRecordCounts[link.person_id] === 1 ? "record" : "records"}</small> : null}
            {contact ? <small>{[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</small> : null}
            <span className="lf-linked-people-states"><span className={`lf-linked-people-chip ${contact?.invite_status === "accepted" ? "is-good" : contact?.invite_status === "failed" || contact?.invite_status === "not_delivered" ? "is-error" : contact?.invite_status === "invite_sent" ? "is-pending" : ""}`}>{invitationLabel}</span>{!contact?.email ? <span className="lf-linked-people-chip">No email</span> : null}{verified ? <span className="lf-linked-people-chip is-good">ID verified</span> : contact?.verification_status === "pending_verification" || contact?.verification_status === "verification_submitted" ? <span className="lf-linked-people-chip is-pending">Checking ID</span> : null}{accessByPerson[link.person_id] === "explicit" ? <span className="lf-linked-people-chip is-good">Can see this record</span> : null}</span>
            {accessByPerson[link.person_id] === "unavailable" ? <small>Record access status unavailable</small> : null}
            <small>{link.source === "extraction" ? `From ${documentTitles[link.source_document_id || ""] || "document"} · page ${link.source_page} · confirmed by you` : link.manual_origin === "people" ? "Added by you from People" : "Added by you"}</small>
            {contact ? <details className="lf-linked-people-row-menu"><summary aria-label={`Actions for ${displayName}`}>More actions</summary><span className="lf-linked-people-row-actions">{renderRowActions(link, contact, false)}</span></details> : null}
          </div>
          {contact ? <button type="button" className="lf-linked-people-mobile-actions" aria-label={`Actions for ${displayName}`} aria-haspopup="dialog" onClick={(event) => { rowActionTriggerRef.current = event.currentTarget; setRowActionLinkId(link.id); }}><Icon name="more_vert" size={20} /></button> : null}
        </li>;
      })}</ul>}
    <Sheet open={Boolean(rowActionLink && rowActionContact)} title={`Actions for ${rowActionContact?.full_name ?? "person"}`} onClose={closeRowActions} returnFocusTo={rowActionTriggerRef}>
      {rowActionLink && rowActionContact ? <div className="lf-linked-people-row-actions lf-linked-people-mobile-sheet-actions">{renderRowActions(rowActionLink, rowActionContact, true)}</div> : null}
    </Sheet>
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
    {canManage && mode === "closed" ? <button type="button" className="lf-linked-people-action" disabled={loading} onClick={(event) => { returnFocusRef.current = event.currentTarget; setError(""); setNotice(""); setMode("choose"); }}>{addAction}</button> : null}
    {canManage && mode !== "closed" ? createPortal(<div className="lf-linked-people-overlay" onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={dialogRef} className={`lf-linked-people-dialog ${["saved", "viewContact", "confirmInvite", "confirmUnlink", "discard"].includes(mode) ? "is-offer" : "is-entry"} ${["existing", "new", "reviewSuggestion"].includes(mode) ? "is-full-mobile" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`}>
        <div className="lf-linked-people-dialog-header"><div className="lf-linked-people-drag-handle" aria-hidden="true" /><h3 id={`${formId}-title`}>{mode === "choose" ? (config.heading === "Executors" ? "Add an executor" : "Add a person") : mode === "existing" ? "Choose a person" : mode === "new" ? (config.heading === "Executors" ? "New executor" : "New person") : mode === "saved" ? `${saved?.full_name ?? "Person"} added` : mode === "viewContact" ? `${saved?.full_name ?? "Person"} in People` : mode === "confirmInvite" ? `Invite ${saved?.full_name ?? "this person"}` : mode === "editRole" ? "Change role on this record" : mode === "confirmUnlink" ? "Remove from this record?" : mode === "discard" ? "Discard these details?" : "Review suggested person"}</h3><button type="button" className="lf-linked-people-dialog-close" onClick={requestClose} aria-label="Close linked people dialog">×</button></div>
        <div className="lf-linked-people-dialog-body">
    {mode === "choose" ? <div className="lf-linked-people-choose"><p>{links.length ? "People already linked remain saved while you add another." : "Choose someone already in your People, or add a new person."}</p><button type="button" disabled={!availableContacts.length} onClick={() => setMode("existing")}><strong>Choose from People</strong><small>{availableContacts.length} available in your Vault</small></button><button type="button" onClick={() => setMode("new")}><strong>Add someone new</strong><small>Name and contact details, if you have them</small></button></div> : null}
    {(mode === "existing" || mode === "new") ? <div className="lf-linked-people-form" id={formId}>
      <h3>{config.heading === "Executors" ? "Add an executor" : "Add a person to this record"}</h3>
      {error ? <div ref={validationRef} tabIndex={-1} className="lf-linked-people-error" role="alert">{showValidationIssues ? <><strong>There {validationIssues.length === 1 ? "is 1 thing" : `are ${validationIssues.length} things`} to fix</strong><ul>{validationIssues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.field === "connection" ? issue.message : <button type="button" onClick={() => document.getElementById(`${formId}-${issue.field}`)?.focus()}>{issue.message}</button>}</li>)}</ul></> : error}</div> : null}
      {links.length ? <p>Already saved: {links.map((link) => contacts.find((contact) => contact.id === link.person_id)?.full_name).filter(Boolean).join(", ")}</p> : null}
      <div className="lf-linked-people-choice" role="group" aria-label="Person source">
        <button type="button" aria-pressed={mode === "existing"} onClick={() => { setError(""); setMode("existing"); }} disabled={!availableContacts.length}>Choose from People</button>
        <button type="button" aria-pressed={mode === "new"} onClick={() => { if (mode === "existing" && contactSearch.trim() && !name.trim()) setName(contactSearch.trim()); setError(""); setMode("new"); }}>Add new person</button>
      </div>
      {mode === "existing" ? <>
        <label>Search your People<input id={`${formId}-person`} type="search" value={contactSearch} onChange={(event) => { setContactSearch(event.target.value); setPersonId(""); setError(""); }} aria-invalid={Boolean(issueFor("person"))} aria-describedby={issueFor("person") ? `${formId}-person-error` : undefined} placeholder="Name, email or telephone" />{issueFor("person") ? <small id={`${formId}-person-error`} className="lf-linked-people-field-error">{issueFor("person")}</small> : null}</label>
        <div className="lf-linked-people-picker" role="group" aria-label="Matching people">
          {matchingContacts.map((contact) => <button key={contact.id} type="button" aria-pressed={personId === contact.id} onClick={() => { setPersonId(contact.id); setError(""); }}>
            <strong>{contact.full_name}</strong><span>{[contact.relationship, contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</span><small>{otherRecordCounts[contact.id] ? `Also on ${otherRecordCounts[contact.id]} other ${otherRecordCounts[contact.id] === 1 ? "record" : "records"} · ` : ""}{personId === contact.id ? "Selected" : "Select person"}</small>
          </button>)}
        </div>
        {matchingContacts.length === 0 ? <p>No matching people in your Vault.</p> : null}
      </> : <div className="lf-linked-people-person-fields">
        <h4>About this person</h4>
        <label>Full name<input id={`${formId}-name`} name="lp_full_name" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoComplete="off" aria-invalid={showValidationIssues && validationIssues.some((issue) => issue.field === "name")} aria-describedby={showValidationIssues && !name.trim() ? `${formId}-name-error` : undefined} required maxLength={120} />{showValidationIssues && !name.trim() ? <small id={`${formId}-name-error`} className="lf-linked-people-field-error">Enter their full name.</small> : null}</label>
        {possibleNameMatch ? <div className="lf-linked-people-duplicate"><p>Possible match in your People: {possibleNameMatch.full_name}. Check their details before creating someone new.</p><button type="button" onClick={() => { setMode("existing"); setContactSearch(possibleNameMatch.full_name); setPersonId(possibleNameMatch.id); setError(""); }}>Use existing person</button></div> : null}
        <label>Relationship to you (optional)<input value={relationship} onChange={(event) => setRelationship(event.target.value)} maxLength={80} /></label>
        <label>Email (optional to save)<input id={`${formId}-email`} name="lp_email" type="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="off" aria-invalid={Boolean(issueFor("email"))} aria-describedby={issueFor("email") ? `${formId}-email-error` : undefined} />{issueFor("email") ? <small id={`${formId}-email-error`} className="lf-linked-people-field-error">{issueFor("email")}</small> : null}</label>
        {duplicateEmailContact ? <div role="alert" className="lf-linked-people-duplicate"><p>This email belongs to {duplicateEmailContact.full_name}.</p>{activeIds.has(duplicateEmailContact.id) ? <Link href={buildContactsWorkspaceHref(duplicateEmailContact.id)}>View linked person</Link> : <button type="button" onClick={() => { setMode("existing"); setContactSearch(duplicateEmailContact.full_name); setPersonId(duplicateEmailContact.id); }}>Use existing person</button>}</div> : null}
        <label>Telephone (optional)<input id={`${formId}-phone`} name="lp_phone" type="tel" inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} autoComplete="off" aria-invalid={Boolean(issueFor("phone"))} aria-describedby={issueFor("phone") ? `${formId}-phone-error` : undefined} placeholder="07700 900123" />{issueFor("phone") ? <small id={`${formId}-phone-error`} className="lf-linked-people-field-error">{issueFor("phone")}</small> : null}</label>
      </div>}
      <fieldset className="lf-linked-people-role-choices"><legend>Their role on {recordLabel}</legend>{showValidationIssues && validationIssues.some((issue) => issue.field === "role") ? <small className="lf-linked-people-field-error">Choose their role on {recordLabel}.</small> : null}{config.roles.map((option, index) => <button key={option} id={index === 0 ? `${formId}-role` : undefined} type="button" aria-pressed={role === option} onClick={() => { setRole(option); setError(""); }}>{option}</button>)}</fieldset>
      {role === "Other" ? <label>Describe role<input id={`${formId}-other`} value={otherRole} onChange={(event) => { setOtherRole(event.target.value); setError(""); }} aria-invalid={Boolean(issueFor("other"))} aria-describedby={issueFor("other") ? `${formId}-other-error` : undefined} required maxLength={60} />{issueFor("other") ? <small id={`${formId}-other-error`} className="lf-linked-people-field-error">{issueFor("other")}</small> : null}</label> : null}
      <p>The People relationship describes how you know them. Their role applies only to this record. Linking does not grant access.</p>
      {recoveryPersonId ? <p role="status">The person is saved in People. Retry the link without creating them again.</p> : null}
      {!online ? <p className="lf-linked-people-offline" role="status">You are offline. Your details remain here; save when your connection returns.</p> : null}
      <div className="lf-linked-people-actions"><button type="button" onClick={requestClose}>Cancel</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : recoveryPersonId ? "Retry relationship" : "Save person and relationship"}</button></div>
    </div> : null}
    {canManage && mode === "editRole" && managedLink ? <div className="lf-linked-people-form" role="group" aria-label="Edit record role">
      <h3>Edit {managedContact?.full_name ?? "person"}&apos;s role</h3>
      <p>This changes only the role on this record. Their People relationship, invitation and access remain separate.</p>
      <fieldset className="lf-linked-people-role-choices"><legend>Role on this record</legend>{[...new Set([managedLink.role, ...config.roles])].map((option) => <button key={option} type="button" aria-pressed={role === option} onClick={() => setRole(option)}>{option}</button>)}</fieldset>
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
      <h3>{saved?.full_name ?? "Person"} added as {links.find((link) => link.person_id === savedPersonId)?.role || "a linked person"}</h3>
      <p>Saved to {recordLabel}. Linking records their role; it does not let them see this record.</p>
      {saved?.invite_status === "accepted" ? <p>{saved.full_name} is already connected. No invitation is needed.</p>
        : saved?.invite_status === "invite_sent" ? <p>An invitation request is already recorded for {saved.full_name}. No duplicate invitation will be sent.</p>
        : <p>Invite {saved?.full_name ?? "this person"} to connect in Legacy Fortress? The invitation will not mention {recordLabel} or share any record.</p>}
      <div className="lf-linked-people-actions">
        {saved?.email && !["invite_sent", "accepted"].includes(saved.invite_status) ? <button type="button" onClick={() => { setError(""); setMode("confirmInvite"); }}>Send invitation…</button> : !saved?.email ? <Link href={buildContactsWorkspaceHref(savedPersonId)}>Add email in People to invite</Link> : null}
        <button type="button" onClick={() => { resetForm(); setNotice(`${saved?.full_name ?? "Person"} remains linked. No invitation was sent.`); }}>{saved?.email && ["invite_sent", "accepted"].includes(saved.invite_status) ? "Back to record" : "Invite later"}</button>
      </div>
      <div className="lf-linked-people-actions">
        <button type="button" onClick={beginAnotherPerson}>{config.heading === "Executors" ? "Add another executor" : "Add another person"}</button>
        {saved ? <button type="button" onClick={() => setMode("viewContact")}>View contact</button> : null}
        {links.find((link) => link.person_id === savedPersonId) ? <button type="button" onClick={() => { const link = links.find((item) => item.person_id === savedPersonId); if (!link) return; setManagedLinkId(link.id); setRole(link.role); setOtherRole(link.role_other_text ?? ""); setMode("editRole"); }}>Edit record role</button> : null}
        {saved ? <Link href={buildContactsWorkspaceHref(saved.id, true)}>Manage access</Link> : null}
        <button type="button" onClick={resetForm}>Return to {recordLabel}</button>
      </div>
    </div> : null}
    {canManage && mode === "viewContact" && saved ? <div className="lf-linked-people-form" role="group" aria-label="Contact details">
      <h3>{saved.full_name}</h3>
      <p>Relationship to you: {saved.relationship || "Not recorded"}</p>
      <p>Email: {saved.email || "Not recorded"}</p>
      <p>Telephone: {saved.phone || "Not recorded"}</p>
      <p>Their role on {recordLabel} is stored on this record separately from their People details.</p>
      <div className="lf-linked-people-actions"><button type="button" onClick={() => setMode("saved")}>Back to saved options</button><button type="button" onClick={resetForm}>Return to {recordLabel}</button><Link href={buildContactsWorkspaceHref(saved.id)}>Edit contact in People</Link></div>
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
      {selectedSuggestion.match_kind === "possible" && selectedSuggestion.match_person_id ? <div className="lf-linked-people-comparison"><div><small>In the document</small><strong>{selectedSuggestion.extracted_name}</strong><span>{selectedSuggestion.extracted_role || "Role needs review"} · page {selectedSuggestion.page}</span></div><div><small>In your People</small><strong>{contacts.find((contact) => contact.id === selectedSuggestion.match_person_id)?.full_name || "Person unavailable"}</strong><span>{contacts.find((contact) => contact.id === selectedSuggestion.match_person_id)?.relationship || "Relationship not recorded"}</span></div><p>Names are similar but may refer to different people. Choose the correct person before saving.</p></div> : null}
      <div className="lf-linked-people-choice" role="group" aria-label="Match this person">
        <button type="button" aria-pressed={suggestionChoice === "existing"} onClick={() => setSuggestionChoice("existing")}>Choose from People</button>
        <button type="button" aria-pressed={suggestionChoice === "new"} onClick={() => setSuggestionChoice("new")}>Add new person</button>
      </div>
      {suggestionChoice === "existing" ? <><label>Search your People<input type="search" value={contactSearch} onChange={(event) => { setContactSearch(event.target.value); setPersonId(""); }} placeholder="Name, email or telephone" /></label><div className="lf-linked-people-picker" role="group" aria-label="Possible matching people">{matchingContacts.map((contact) => <button key={contact.id} type="button" aria-pressed={personId === contact.id} onClick={() => setPersonId(contact.id)}><strong>{contact.full_name}{contact.id === selectedSuggestion.match_person_id ? " · suggested match" : ""}</strong><span>{[contact.relationship, contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</span><small>{personId === contact.id ? "Selected" : "Select this person"}</small></button>)}</div></> : null}
      {suggestionChoice === "new" ? <>
        <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
        <label>Email (optional)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Telephone (optional)<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      </> : null}
      <fieldset className="lf-linked-people-role-choices"><legend>Role on this record</legend>{config.roles.map((option) => <button key={option} type="button" aria-pressed={role === option} onClick={() => setRole(option)}>{option}</button>)}</fieldset>
      {role === "Other" ? <label>Describe role<input value={otherRole} onChange={(event) => setOtherRole(event.target.value)} maxLength={60} /></label> : null}
      <p>Confirming saves the person and relationship together. It does not send an invitation or grant access.</p>
      <div className="lf-linked-people-actions"><button type="button" disabled={busy} onClick={resetForm}>Back</button><button type="button" disabled={busy} onClick={() => void decideSuggestion("dismiss")}>Dismiss suggestion</button><button type="button" disabled={busy || !suggestionChoice || (suggestionChoice === "existing" ? !personId : !name.trim()) || (role === "Other" && !otherRole.trim())} onClick={() => void decideSuggestion("confirm")}>Save person and relationship</button></div>
    </div> : null}
    {mode === "discard" ? <div className="lf-linked-people-form"><p>The people already saved to this record will stay linked.</p><div className="lf-linked-people-actions"><button type="button" onClick={() => setMode(discardReturnMode)}>Keep editing</button><button type="button" onClick={resetForm}>Discard details</button></div></div> : null}
    {error && mode !== "new" && mode !== "existing" ? <p className="lf-linked-people-error" role="alert">{error}</p> : null}
        </div>
      </div>
    </div>, document.body) : null}
  </section>;
}
