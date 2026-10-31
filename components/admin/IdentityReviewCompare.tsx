"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { supabase } from "@/lib/supabaseClient";

/**
 * Reviewer check: the document photo and live selfie side by side, with the prompt the person
 * was asked to follow. Photos load only when the reviewer asks, through links that expire in a
 * minute; every view is recorded. Approving confirms identity only and never opens records.
 */
type Assessment = { document_selfie_similarity?: number | null; session_similarity?: number | null; anti_spoof?: number | null; liveness?: number | null; motion_passed?: boolean; reasons?: string[] };
type Evidence = { documentUrl: string | null; documentIsPdf: boolean; selfieUrl: string | null; prompt: string; capturedAt: string | null; frames?: Array<{ direction: string; url: string | null }>; assessment?: Assessment | null; caseBound?: boolean };

const REASON: Record<string, string> = {
  no_face_on_document: "No face found on the document photo",
  no_face_in_selfie: "No face found in the selfie",
  more_than_one_face_in_selfie: "More than one face in the selfie",
  face_match_below_auto_threshold: "Face match not strong enough to pass automatically",
  motion_check_not_passed: "Head turns not clearly shown",
  antispoof_below_threshold: "Possible photo of a photo or screen",
  liveness_below_threshold: "Liveness score low",
  liveness_unavailable: "Liveness couldn’t be measured",
  document_not_an_image: "Document is a PDF, so it can’t be compared automatically",
  selfie_unreadable: "Selfie couldn’t be read",
  automatic_check_unavailable: "Automatic check unavailable",
};

function score(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(2) : "–";
}

const CHECKS = [
  "The selfie shows the same person as the document photo",
  "The person is following the prompt shown",
  "The document looks genuine and in date",
  "The name on the document matches the account",
];

export default function IdentityReviewCompare({ requestId, canDecide, title = "Compare the photos" }: { requestId: string; canDecide: boolean; title?: string }) {
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
    <h2 id="idv-compare-title">{title}</h2>
    {!evidence ? <>
      <p className="lf-admin-muted">The photos open through a link that expires in a minute. Viewing is recorded.</p>
      {canDecide ? <button type="button" className="lf-admin-row-button" disabled={loading} onClick={() => void load()}><Icon name="visibility" size={18} />{loading ? "Opening…" : "Show photos"}</button> : <p className="lf-admin-muted">Your role can’t view identity photos.</p>}
    </> : <>
      <p className="lf-admin-idv-prompt"><Icon name="front_hand" size={18} />They were asked to: <strong>{evidence.prompt || "follow a prompt"}</strong></p>
      {evidence.caseBound ? <p className="lf-admin-muted">This is a fresh check taken for a death report or Power of Attorney. It always needs a person.</p> : null}
      {evidence.assessment ? <dl className="lf-admin-keyvalues lf-admin-idv-scores">
        <div><dt>Selfie vs document</dt><dd>{score(evidence.assessment.document_selfie_similarity)}<small>Similarity, not a probability. Automatic pass needs a clear match.</small></dd></div>
        <div><dt>Same person throughout</dt><dd>{score(evidence.assessment.session_similarity)}</dd></div>
        <div><dt>Head turns</dt><dd>{evidence.assessment.motion_passed ? "Shown as asked" : "Not clearly shown"}</dd></div>
        <div><dt>Anti-spoofing · liveness</dt><dd>{score(evidence.assessment.anti_spoof)} · {score(evidence.assessment.liveness)}</dd></div>
        {evidence.assessment.reasons?.length ? <div><dt>Why it needs a person</dt><dd>{evidence.assessment.reasons.map((code) => REASON[code] ?? code.replace(/_/g, " ")).join("; ")}</dd></div> : null}
      </dl> : null}
      <div className="lf-admin-idv-photos">
        <figure>{evidence.documentUrl ? (evidence.documentIsPdf ? <a href={evidence.documentUrl} target="_blank" rel="noopener noreferrer">Open the document (PDF)</a> : <img src={evidence.documentUrl} alt="Identity document photo" referrerPolicy="no-referrer" />) : <span>No document photo</span>}<figcaption>Document</figcaption></figure>
        <figure>{evidence.selfieUrl ? <img src={evidence.selfieUrl} alt="Live selfie" referrerPolicy="no-referrer" /> : <span>No selfie</span>}<figcaption>Live selfie</figcaption></figure>
        {(evidence.frames ?? []).map((frame) => <figure key={frame.direction}>{frame.url ? <img src={frame.url} alt={`Turned ${frame.direction}`} referrerPolicy="no-referrer" /> : <span>Missing</span>}<figcaption>Turned {frame.direction}</figcaption></figure>)}
      </div>
      {evidence.caseBound ? null : <><fieldset className="lf-admin-idv-checks">
        <legend>Before you approve</legend>
        {CHECKS.map((label, index) => <label key={label}><input type="checkbox" checked={checked[index]} onChange={(event) => setChecked((current) => current.map((value, i) => i === index ? event.target.checked : value))} />{label}</label>)}
      </fieldset>
      <label className="lf-admin-field">Decision notes (required)
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What you checked. Don’t type document numbers." />
      </label>
      <div className="lf-admin-decision-footer">
        <button type="button" className="lf-admin-danger-button" disabled={Boolean(busy)} onClick={() => void decide("reject")}>{busy === "reject" ? "Rejecting…" : "Reject"}</button>
        <button type="button" className="lf-admin-primary-button" disabled={Boolean(busy) || !allChecked} onClick={() => void decide("approve")}>{busy === "approve" ? "Approving…" : "Approve ID"}</button>
      </div></>}
    </>}
    {message ? <p className="lf-admin-muted" role="status">{message}</p> : null}
  </section>;
}
