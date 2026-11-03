"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";
import { REJECT_REASON_LABELS, fileSizeLabel, firstName, formatUkDateTime, loadSuggestion, openSuggestionPreview, suggestionAction, type Suggestion, type SuggestionComment } from "../../lib/suggestions/client";
import { SuggestionComments, SuggestionStatusChip } from "./SuggestionParts";

/**
 * Review document (V5.2 7c), Reject sheet (7d) and Approve (7e) for the record's owner.
 * Decisions are made by the database as the owner; approving adds the file to the record and
 * never shares the record with the person who suggested it.
 */
export default function SuggestionReviewDialog({ suggestionId, ownerUserId, onClose, onDecided }: {
  suggestionId: string;
  ownerUserId: string;
  onClose: () => void;
  onDecided: (message: string, assetId: string | null) => void;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"review" | "reject">("review");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    const result = await loadSuggestion(supabase, suggestionId);
    setSuggestion(result.suggestion);
    setComments(result.comments);
    setLoading(false);
  }, [suggestionId]);

  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const who = suggestion?.proposer_name || "Someone";
  const first = firstName(who);
  const record = suggestion?.record_title || "this record";
  const canDecide = Boolean(suggestion && suggestion.owner_user_id === ownerUserId && suggestion.proposer_user_id !== ownerUserId && (suggestion.status === "pending" || suggestion.status === "approved"));

  async function approve() {
    if (!suggestion) return;
    setBusy("approve"); setError("");
    const result = await suggestionAction(supabase, suggestion.id, { action: "approve" });
    setBusy("");
    if (!result.ok) { setError(result.message); await reload(); return; }
    onDecided(`Approved. Added to ${record} and ${first} notified.`, result.assetId ?? suggestion.asset_id);
  }

  async function reject() {
    if (!suggestion || !reason) return;
    if (reason === "other" && !comment.trim()) { setError(`Tell ${first} what’s wrong.`); return; }
    setBusy("reject"); setError("");
    const result = await suggestionAction(supabase, suggestion.id, { action: "reject", reason, comment });
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    onDecided(`Rejected. ${first} has been told why.`, null);
  }

  async function preview() {
    if (!suggestion) return;
    setBusy("preview");
    const problem = await openSuggestionPreview(supabase, suggestion.id);
    setBusy("");
    if (problem) setError(problem);
  }

  return (
    <div className="lf-sg-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="lf-sg-dialog" role="dialog" aria-modal="true" aria-labelledby="sg-review-title" tabIndex={-1}>
        <header className="lf-sg-dialog-head">
          {mode === "reject" ? <button type="button" className="lf-sg-text-button" onClick={() => { setMode("review"); setError(""); }}>Back to review</button> : <button type="button" className="lf-sg-text-button" onClick={onClose}>Close</button>}
          <h2 id="sg-review-title">{mode === "reject" ? "Reject document" : "Review document"}</h2>
          <span />
        </header>
        <div className="lf-sg-dialog-body">
          {loading ? <p className="lf-sg-muted" role="status">Loading…</p> : !suggestion ? <p className="lf-sg-muted">This suggestion isn’t available.</p> : mode === "review" ? <>
            <section className="lf-sg-proposer">
              <span className="lf-sg-avatar" aria-hidden="true">{first.charAt(0).toUpperCase()}<span className="lf-sg-avatar-badge"><Icon name="edit_note" size={14} /></span></span>
              <span className="lf-sg-proposer-text"><strong>{who}</strong><small>Can suggest documents for {record} · sent {formatUkDateTime(suggestion.created_at)}</small></span>
              <SuggestionStatusChip status={suggestion.status} />
            </section>
            <section className="lf-sg-card" aria-labelledby="sg-change-title">
              <h3 id="sg-change-title">Proposed change</h3>
              <div className="lf-sg-file">
                <span className="lf-sg-file-icon" aria-hidden="true"><Icon name="description" size={22} /></span>
                <span><strong>{suggestion.file_name}</strong><small>{fileSizeLabel(suggestion.size_bytes)} · Add to {record} › Documents</small></span>
                {suggestion.status === "pending" ? <button type="button" className="lf-sg-secondary" disabled={busy === "preview"} onClick={() => void preview()}>{busy === "preview" ? "Opening…" : "Preview"}</button> : null}
              </div>
              {suggestion.note ? <p className="lf-sg-note"><span>Note from {first}</span>{suggestion.note}</p> : null}
              <p className="lf-sg-muted">Nothing else on {record} changes.</p>
            </section>
            <SuggestionComments suggestion={suggestion} comments={comments} viewerUserId={ownerUserId} otherName={first} onPosted={() => void reload()} />
            <p className="lf-sg-boundary"><Icon name="lock" size={18} />Approving adds this file to {record}. It doesn’t share the record: {first} still can’t open the rest of it.</p>
          </> : <>
            <fieldset className="lf-sg-reasons">
              <legend>Reason <span className="lf-sg-required">Required</span></legend>
              {Object.entries(REJECT_REASON_LABELS).map(([key, label]) => <button key={key} type="button" className={`lf-sg-reason${reason === key ? " is-selected" : ""}`} aria-pressed={reason === key} onClick={() => setReason(key)}>{reason === key ? <Icon name="check" size={16} /> : null}{label}</button>)}
            </fieldset>
            <label className="lf-sg-field">Comment to {first}{reason === "other" ? <span className="lf-sg-required">Required</span> : <span className="lf-sg-optional">Optional</span>}
              <textarea rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What should they send instead?" />
            </label>
            <p className="lf-sg-muted">The file is removed. The suggestion stays in the record’s history as Rejected, with your reason.</p>
          </>}
          {error ? <p className="lf-sg-error" role="alert">{error}</p> : null}
        </div>
        {suggestion && canDecide ? <footer className="lf-sg-dialog-foot">
          {mode === "review" ? <>
            {suggestion.status === "pending" ? <button type="button" className="lf-sg-danger-outline" disabled={Boolean(busy)} onClick={() => { setMode("reject"); setError(""); }}>Reject</button> : <span />}
            <button type="button" className="lf-sg-primary" disabled={Boolean(busy)} onClick={() => void approve()}>{busy === "approve" ? "Approving…" : suggestion.status === "approved" ? "Finish adding" : "Approve"}</button>
          </> : <>
            <button type="button" className="lf-sg-secondary" onClick={() => { setMode("review"); setError(""); }}>Back to review</button>
            <button type="button" className="lf-sg-danger" disabled={!reason || Boolean(busy)} onClick={() => void reject()}>{busy === "reject" ? "Rejecting…" : "Reject document"}</button>
          </>}
        </footer> : null}
      </div>
    </div>
  );
}
