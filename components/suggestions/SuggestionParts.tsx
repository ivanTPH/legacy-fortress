"use client";

import { useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";
import { SUGGESTION_STATUS, formatUkDateTime, suggestionAction, type Suggestion, type SuggestionComment } from "../../lib/suggestions/client";

export function SuggestionStatusChip({ status }: { status: Suggestion["status"] }) {
  const item = SUGGESTION_STATUS[status];
  return <span className={`lf-sg-chip is-${item.tone}`}><Icon name={item.icon} size={16} />{item.label}</span>;
}

/** Comments thread (7c, p2). Comments keep the suggestion pending and are kept permanently. */
export function SuggestionComments({ suggestion, comments, viewerUserId, otherName, onPosted }: {
  suggestion: Suggestion;
  comments: SuggestionComment[];
  viewerUserId: string;
  otherName: string;
  onPosted: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = suggestion.status === "pending";

  async function post() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    const result = await suggestionAction(supabase, suggestion.id, { action: "comment", body: text });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setDraft("");
    onPosted();
  }

  return (
    <section className="lf-sg-card" aria-labelledby={`sg-comments-${suggestion.id}`}>
      <h3 id={`sg-comments-${suggestion.id}`}>Comments</h3>
      {comments.length ? <ol className="lf-sg-comments">
        {comments.map((comment) => <li key={comment.id} className={comment.author_user_id === viewerUserId ? "is-mine" : ""}>
          <strong>{comment.author_user_id === viewerUserId ? "You" : comment.author_name || "Someone"}</strong>
          <p>{comment.body}</p>
          <small>{formatUkDateTime(comment.created_at)}</small>
        </li>)}
      </ol> : <p className="lf-sg-muted">No comments yet.</p>}
      {open ? <>
        <div className="lf-sg-comment-input">
          <label className="lf-visually-hidden" htmlFor={`sg-comment-${suggestion.id}`}>Write a comment</label>
          <textarea id={`sg-comment-${suggestion.id}`} rows={2} maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a comment" />
          <button type="button" className="lf-sg-icon-button" aria-label="Send comment" disabled={!draft.trim() || busy} onClick={() => void post()}><Icon name="send" size={20} /></button>
        </div>
        <p className="lf-sg-muted">{otherName} sees comments. Commenting keeps the suggestion waiting.</p>
      </> : null}
      {error ? <p className="lf-sg-error" role="alert">{error}</p> : null}
    </section>
  );
}
