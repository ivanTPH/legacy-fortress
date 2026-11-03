"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "../../../components/ui/Icon";
import { PageHeader } from "../../../components/ui/V3Primitives";
import { SuggestionComments, SuggestionStatusChip } from "../../../components/suggestions/SuggestionParts";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { DOCUMENT_UPLOAD_ACCEPT } from "../../../lib/validation/upload";
import {
  REJECT_REASON_LABELS, fileSizeLabel, firstName, formatUkDateTime, loadMySuggestions, loadSuggestion, loadSuggestionTargets,
  openSuggestionPreview, sendSuggestion, suggestionAction, type Suggestion, type SuggestionComment,
} from "../../../lib/suggestions/client";

type Target = { asset_id: string; owner_user_id: string; owner_name: string; record_title: string };

/**
 * Suggested documents, for the person suggesting (V5.2 7a; partner p1–p3 applied to people the owner
 * shares with, owner decision 3 Nov 2026). They see only their own suggestions and the names of the
 * records the owner chose, never the rest of the record.
 */
export default function SuggestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");
  const [userId, setUserId] = useState("");
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const user = await waitForActiveUser(supabase);
    if (!user) { setTargets([]); return; }
    const [nextTargets, mine] = await Promise.all([loadSuggestionTargets(supabase), loadMySuggestions(supabase, user.id)]);
    setUserId(user.id);
    setTargets(nextTargets);
    setItems(mine);
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const open = items.find((item) => item.id === openId) ?? null;

  if (open) return <SuggestionDetail suggestion={open} viewerUserId={userId} onBack={() => router.push("/suggestions")} onChanged={async (message) => { if (message) setNotice(message); await load(); }} onSendNew={() => { router.push("/suggestions"); setComposing(true); }} />;

  return (
    <div className="lf-sg-page">
      <PageHeader title="Suggested documents" description="Send a document for a record someone has asked you to help with. They approve it before it’s added." />
      {notice ? <p className="lf-sg-toast" role="status">{notice}</p> : null}
      {targets === null ? <div className="lf-sg-loading" role="status" aria-busy="true"><span className="lf-visually-hidden">Loading…</span><span className="lf-skeleton is-row" /><span className="lf-skeleton is-row" /></div> : <>
        {composing ? <SuggestForm targets={targets} onCancel={() => setComposing(false)} onSent={async (message) => { setComposing(false); setNotice(message); await load(); }} />
          : targets.length ? <button type="button" className="lf-sg-primary lf-sg-start" onClick={() => { setNotice(""); setComposing(true); }}><Icon name="note_add" size={20} />Suggest a document</button>
          : <p className="lf-sg-empty"><Icon name="edit_note" size={24} /><span><strong>No records to suggest for</strong>When someone lets you suggest documents for one of their records, it appears here.</span></p>}
        {items.length ? <section className="lf-sg-card lf-sg-list" aria-labelledby="sg-mine-title">
          <h2 id="sg-mine-title">Your suggestions</h2>
          {items.map((item) => <button key={item.id} type="button" className="lf-sg-row" onClick={() => router.push(`/suggestions?open=${encodeURIComponent(item.id)}`)}>
            <span className="lf-sg-file-icon" aria-hidden="true"><Icon name="description" size={22} /></span>
            <span className="lf-sg-row-text"><strong>{item.file_name}</strong><small>{item.record_title || "Record"} · {formatUkDateTime(item.created_at)}</small></span>
            <SuggestionStatusChip status={item.status} />
            <Icon name="chevron_right" size={22} />
          </button>)}
        </section> : null}
      </>}
    </div>
  );
}

function SuggestForm({ targets, onCancel, onSent }: { targets: Target[]; onCancel: () => void; onSent: (message: string) => void }) {
  const [assetId, setAssetId] = useState(targets.length === 1 ? targets[0].asset_id : "");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const target = targets.find((item) => item.asset_id === assetId) ?? null;
  const owners = useMemo(() => Array.from(new Set(targets.map((item) => item.owner_name))), [targets]);

  async function send() {
    if (!target) { setError("Choose a record."); return; }
    if (!file) { setError("Choose a file."); return; }
    setBusy(true); setError("");
    const result = await sendSuggestion(supabase, { assetId: target.asset_id, file, note });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    onSent(`Sent to ${firstName(target.owner_name)} for approval.`);
  }

  return (
    <section className="lf-sg-card lf-sg-form" aria-labelledby="sg-form-title">
      <h2 id="sg-form-title">Suggest a document</h2>
      <label className="lf-sg-field">Record <span className="lf-sg-required">Required</span>
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
          <option value="">Choose a record</option>
          {owners.map((owner) => <optgroup key={owner} label={`${owner}’s records`}>
            {targets.filter((item) => item.owner_name === owner).map((item) => <option key={item.asset_id} value={item.asset_id}>{item.record_title}</option>)}
          </optgroup>)}
        </select>
      </label>
      <div className="lf-sg-field">File <span className="lf-sg-required">Required</span>
        <input ref={fileRef} type="file" accept={DOCUMENT_UPLOAD_ACCEPT} className="lf-visually-hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button type="button" className="lf-sg-file-pick" onClick={() => fileRef.current?.click()}>
          <Icon name={file ? "description" : "upload_file"} size={22} />
          <span>{file ? <><strong>{file.name}</strong><small>{fileSizeLabel(file.size)} · Tap to change</small></> : <><strong>Choose a file</strong><small>PDF, photo, Word, Excel or CSV, up to 15MB</small></>}</span>
        </button>
      </div>
      <label className="lf-sg-field">Note for {target ? firstName(target.owner_name) : "the owner"} <span className="lf-sg-optional">Optional</span>
        <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is it, and why should it be added?" />
      </label>
      <p className="lf-sg-boundary"><Icon name="lock" size={18} />{target ? firstName(target.owner_name) : "The owner"} approves it before it’s added. Sending it doesn’t let you open the record.</p>
      {error ? <p className="lf-sg-error" role="alert">{error}</p> : null}
      <div className="lf-sg-actions">
        <button type="button" className="lf-sg-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="lf-sg-primary" disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : "Send for approval"}</button>
      </div>
    </section>
  );
}

function SuggestionDetail({ suggestion, viewerUserId, onBack, onChanged, onSendNew }: {
  suggestion: Suggestion; viewerUserId: string; onBack: () => void; onChanged: (message?: string) => Promise<void>; onSendNew: () => void;
}) {
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reloadComments = useCallback(async () => setComments((await loadSuggestion(supabase, suggestion.id)).comments), [suggestion.id]);
  useEffect(() => {
    queueMicrotask(() => void reloadComments());
    void loadSuggestionTargets(supabase).then((targets) => setOwnerName(targets.find((item) => item.owner_user_id === suggestion.owner_user_id)?.owner_name ?? ""));
  }, [reloadComments, suggestion.owner_user_id]);
  const owner = firstName(ownerName, "The owner");
  const record = suggestion.record_title || "the record";

  async function withdraw() {
    setBusy(true); setError("");
    const result = await suggestionAction(supabase, suggestion.id, { action: "withdraw" });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    await onChanged("Withdrawn. The file was removed.");
  }

  return (
    <div className="lf-sg-page">
      <button type="button" className="lf-sg-back" onClick={onBack}><Icon name="chevron_left" size={22} />Suggested documents</button>
      <header className="lf-sg-detail-head">
        <h1>Your suggestion</h1>
        <SuggestionStatusChip status={suggestion.status} />
      </header>
      <section className="lf-sg-card">
        <div className="lf-sg-file">
          <span className="lf-sg-file-icon" aria-hidden="true"><Icon name="description" size={22} /></span>
          <span><strong>{suggestion.file_name}</strong><small>{fileSizeLabel(suggestion.size_bytes)} · For {record} · sent {formatUkDateTime(suggestion.created_at)}</small></span>
          {suggestion.status === "pending" ? <button type="button" className="lf-sg-secondary" onClick={() => void openSuggestionPreview(supabase, suggestion.id).then((problem) => problem && setError(problem))}>View</button> : null}
        </div>
        {suggestion.note ? <p className="lf-sg-note"><span>Your note</span>{suggestion.note}</p> : null}
      </section>
      {suggestion.status === "rejected" ? <section className="lf-sg-card lf-sg-decision is-rejected">
        <h2>{owner} didn’t add it</h2>
        <p><strong>{REJECT_REASON_LABELS[suggestion.reject_reason ?? ""] ?? "No reason given"}</strong>{suggestion.reject_comment ? ` · “${suggestion.reject_comment}”` : ""}</p>
        <p className="lf-sg-muted">The file was removed. The history is kept.</p>
        <button type="button" className="lf-sg-primary" onClick={onSendNew}>Send a new document</button>
      </section> : null}
      {suggestion.status === "applied" || suggestion.status === "approved" ? <section className="lf-sg-card lf-sg-decision is-approved">
        <h2>{suggestion.status === "applied" ? `Added to ${record}` : "Approved"}</h2>
        <p className="lf-sg-muted">{owner} approved it{suggestion.decided_at ? ` on ${formatUkDateTime(suggestion.decided_at)}` : ""}. You still can’t open the record.</p>
      </section> : null}
      {suggestion.status === "withdrawn" ? <section className="lf-sg-card lf-sg-decision"><h2>You withdrew it</h2><p className="lf-sg-muted">The file was removed. The history is kept.</p></section> : null}
      <SuggestionComments suggestion={suggestion} comments={comments} viewerUserId={viewerUserId} otherName={owner} onPosted={() => void reloadComments()} />
      {error ? <p className="lf-sg-error" role="alert">{error}</p> : null}
      {suggestion.status === "pending" ? <button type="button" className="lf-sg-danger-text" disabled={busy} onClick={() => void withdraw()}>{busy ? "Withdrawing…" : "Withdraw suggestion"}</button> : null}
    </div>
  );
}
