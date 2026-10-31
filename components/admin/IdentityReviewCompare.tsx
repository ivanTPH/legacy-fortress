"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { supabase } from "@/lib/supabaseClient";

/**
 * Reviewer check: the document photo and live selfie side by side, with the prompt the person
 * was asked to follow. Photos load only when the reviewer asks, through links that expire in a
 * minute; every view is recorded. Approving confirms identity only and never opens records.
 */
type Evidence = { documentUrl: string | null; documentIsPdf: boolean; selfieUrl: string | null; prompt: string; capturedAt: string | null };

const CHECKS = [
  "The selfie shows the same person as the document photo",
  "The person is following the prompt shown",
  "The document looks genuine and in date",
  "The name on the document matches the account",
];

export default function IdentityReviewCompare({ requestId, canDecide }: { requestId: string; canDecide: boolean }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true); setMessage("");
    const res = await fetch(`/api/internal/admin/verifications/${encodeURIComponent(requestId)}/evidence`, { headers: { authorization: `Bearer ${await token()}` }, cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as Evidence & { ok?: boolean; message?: string };
    setLoading(false);
    if (!res.ok || !json.ok) { setMessage(json.message ?? "The photos aren’t available."); return; }
    setEvidence(json);
  }

  async function decide(action: "approve" | "reject") {
    if (!notes.trim()) { setMessage("Add decision notes first."); return; }
    setBusy(action); setMessage("");
    const res = await fetch("/api/internal/admin/verifications", {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify({ requestId, action, reviewNotes: notes }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    setBusy("");
    if (!res.ok || !json.ok) { setMessage(json.message ?? "That didn’t save."); return; }
    setEvidence(null);
    setMessage(action === "approve" ? "Approved. Their ID is verified for a year. The photos have been deleted." : "Rejected. The photos have been deleted and they can try again.");
    window.setTimeout(() => window.location.reload(), 1200);
  }

  const allChecked = checked.every(Boolean);
  return <section className="lf-admin-table-card lf-admin-idv-compare" aria-labelledby="idv-compare-title">
    <h2 id="idv-compare-title">Compare the photos</h2>
    {!evidence ? <>
      <p className="lf-admin-muted">The photos open through a link that expires in a minute. Viewing is recorded.</p>
      {canDecide ? <button type="button" className="lf-admin-row-button" disabled={loading} onClick={() => void load()}><Icon name="visibility" size={18} />{loading ? "Opening…" : "Show photos"}</button> : <p className="lf-admin-muted">Your role can’t view identity photos.</p>}
    </> : <>
      <p className="lf-admin-idv-prompt"><Icon name="front_hand" size={18} />They were asked to: <strong>{evidence.prompt || "follow a prompt"}</strong></p>
      <div className="lf-admin-idv-photos">
        <figure>{evidence.documentUrl ? (evidence.documentIsPdf ? <a href={evidence.documentUrl} target="_blank" rel="noopener noreferrer">Open the document (PDF)</a> : <img src={evidence.documentUrl} alt="Identity document photo" referrerPolicy="no-referrer" />) : <span>No document photo</span>}<figcaption>Document</figcaption></figure>
        <figure>{evidence.selfieUrl ? <img src={evidence.selfieUrl} alt="Live selfie" referrerPolicy="no-referrer" /> : <span>No selfie</span>}<figcaption>Live selfie</figcaption></figure>
      </div>
      <fieldset className="lf-admin-idv-checks">
        <legend>Before you approve</legend>
        {CHECKS.map((label, index) => <label key={label}><input type="checkbox" checked={checked[index]} onChange={(event) => setChecked((current) => current.map((value, i) => i === index ? event.target.checked : value))} />{label}</label>)}
      </fieldset>
      <label className="lf-admin-field">Decision notes (required)
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What you checked. Don’t type document numbers." />
      </label>
      <div className="lf-admin-decision-footer">
        <button type="button" className="lf-admin-danger-button" disabled={Boolean(busy)} onClick={() => void decide("reject")}>{busy === "reject" ? "Rejecting…" : "Reject"}</button>
        <button type="button" className="lf-admin-primary-button" disabled={Boolean(busy) || !allChecked} onClick={() => void decide("approve")}>{busy === "approve" ? "Approving…" : "Approve ID"}</button>
      </div>
    </>}
    {message ? <p className="lf-admin-muted" role="status">{message}</p> : null}
  </section>;
}
