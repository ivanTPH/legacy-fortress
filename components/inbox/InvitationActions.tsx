"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { cancelWaitingInvitation, isPlausibleEmail, loadWaitingInvitation, resendWaitingInvitation, type WaitingInvitation } from "../../lib/contacts/invitationActions";

/**
 * A waiting invitation, handled where it's shown (owner decision 16 Nov 2026): Resend, Change email, Cancel.
 * Uses the same shared actions as the People screen. Inviting never shares anything with the person.
 */
export default function InvitationActions({ contactId, onChanged, compact = false, showName = false }: { contactId: string; onChanged?: (outcome: "sent" | "cancelled") => void; compact?: boolean; showName?: boolean }) {
  const [owner, setOwner] = useState<{ id: string; email: string | null } | null>(null);
  const [invitation, setInvitation] = useState<WaitingInvitation | null | undefined>(undefined);
  const [mode, setMode] = useState<"idle" | "email" | "cancel">("idle");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"" | "send" | "cancel">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<"" | "sent" | "cancelled">("");

  const load = useCallback(async (isCancelled: () => boolean) => {
    try {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 200 });
      if (isCancelled()) return;
      if (!user) { setInvitation(null); return; }
      setOwner({ id: user.id, email: user.email ?? null });
      const found = await loadWaitingInvitation(supabase, user.id, contactId);
      if (!isCancelled()) setInvitation(found);
    } catch { if (!isCancelled()) setInvitation(null); }
  }, [contactId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { void load(() => cancelled); });
    return () => { cancelled = true; };
  }, [load]);

  async function send(newEmail?: string) {
    if (!owner || !invitation) return;
    setBusy("send"); setError(""); setNote("");
    try {
      const sentTo = await resendWaitingInvitation(supabase, {
        ownerUserId: owner.id, ownerEmail: owner.email, invitation, newEmail: newEmail ?? null,
        origin: typeof window === "undefined" ? null : window.location.origin,
      });
      setInvitation({ ...invitation, email: sentTo, lastSentAt: new Date().toISOString() });
      setMode("idle"); setDone("sent");
      setNote(newEmail ? `Sent to the new address, ${sentTo}. The link in the earlier email no longer works.` : `Sent again to ${sentTo}. The link in the earlier email no longer works.`);
      onChanged?.("sent");
    } catch (failure) {
      setError(failure instanceof Error && /full email/.test(failure.message) ? failure.message : "The invitation couldn’t be sent. Nothing has changed. Try again.");
    } finally { setBusy(""); }
  }

  async function cancel() {
    if (!owner || !invitation) return;
    setBusy("cancel"); setError("");
    try {
      await cancelWaitingInvitation(supabase, { ownerUserId: owner.id, contactId: invitation.contactId, invitationId: invitation.invitationId, source: "inbox" });
      setMode("idle"); setDone("cancelled");
      setNote(`Invitation cancelled. ${invitation.name.split(" ")[0]} stays in People, and the link in the email no longer works.`);
      onChanged?.("cancelled");
    } catch {
      setError("The invitation couldn’t be cancelled. Nothing has changed. Try again.");
    } finally { setBusy(""); }
  }

  if (invitation === undefined) return <p className="lf-inbox-message-meta" role="status">Loading the invitation…</p>;
  if (invitation === null && !done) return <p className="lf-inbox-message-meta">There’s no waiting invitation for this person now. It may have been accepted or cancelled.</p>;
  const first = invitation?.name.split(" ")[0] ?? "They";

  return (
    <div className={`lf-invite-actions${compact ? " is-compact" : ""}`}>
      {showName && invitation ? <h3 className="lf-invite-name">{invitation.name}</h3> : null}
      {invitation && !compact ? (
        <dl className="lf-invite-facts">
          <div><dt>Sent to</dt><dd>{invitation.email || "No email address"}</dd></div>
          {invitation.lastSentAt ? <div><dt>Last sent</dt><dd>{formatDay(invitation.lastSentAt)}</dd></div> : null}
          {invitation.expiresAt && done !== "cancelled" ? <div><dt>Link works until</dt><dd>{formatDay(invitation.expiresAt)}</dd></div> : null}
        </dl>
      ) : null}
      {note ? <p className="lf-invite-note" role="status">{done === "sent" ? <span className="lf-named-tick is-sent">✓ Sent</span> : null} {note}</p> : null}
      {error ? <p className="lf-named-error" role="alert">{error}</p> : null}
      {done === "cancelled" ? null : mode === "email" ? (
        <form className="lf-invite-email" onSubmit={(event) => { event.preventDefault(); void send(email); }}>
          <label htmlFor={`invite-email-${contactId}`}>New email address for {first}</label>
          <input id={`invite-email-${contactId}`} type="email" inputMode="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoFocus />
          <p className="lf-inbox-message-meta">We’ll send a new invitation there and update {first}’s email in People.</p>
          <div className="lf-invite-buttons">
            <button type="button" className="lf-inbox-secondary" onClick={() => { setMode("idle"); setError(""); }}>Back</button>
            <button type="submit" className="lf-inbox-primary" disabled={Boolean(busy) || !isPlausibleEmail(email)}>{busy === "send" ? "Sending…" : "Send to this address"}</button>
          </div>
        </form>
      ) : mode === "cancel" ? (
        <div className="lf-invite-confirm" role="group" aria-label="Cancel invitation">
          <p><strong>Cancel {first}’s invitation?</strong> {first} stays in People. The link in the email stops working. You can invite {first} again later.</p>
          <div className="lf-invite-buttons">
            <button type="button" className="lf-inbox-secondary" onClick={() => setMode("idle")}>Keep it</button>
            <button type="button" className="lf-inbox-danger" disabled={Boolean(busy)} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelling…" : "Cancel invitation"}</button>
          </div>
        </div>
      ) : (
        <div className="lf-invite-buttons">
          <button type="button" className="lf-inbox-primary" disabled={Boolean(busy) || !invitation?.email} onClick={() => void send()}>{busy === "send" ? "Sending…" : "Resend"}</button>
          <button type="button" className="lf-inbox-secondary" disabled={Boolean(busy)} onClick={() => { setEmail(invitation?.email ?? ""); setMode("email"); setError(""); }}>Change email</button>
          <button type="button" className="lf-inbox-secondary is-danger" disabled={Boolean(busy)} onClick={() => { setMode("cancel"); setError(""); }}>Cancel invitation</button>
        </div>
      )}
    </div>
  );
}

function formatDay(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}
