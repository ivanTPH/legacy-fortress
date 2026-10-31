"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import IdentityReviewCompare from "@/components/admin/IdentityReviewCompare";
import { supabase } from "@/lib/supabaseClient";

/**
 * Release reviewer (owner decision 31 Oct 2026): before unlocking, a person looks at the death
 * certificate and the reporter's fresh ID check, and can ask for more evidence.
 */
type Report = { id: string; status: string; role: string; submittedAt: string | null };
type Evidence = {
  report: { reporterName: string; role: string; relationship: string | null; dateOfDeath: string | null; submittedAt: string | null; status: string };
  files: Array<{ id: string; type: string; fileName: string; mimeType: string; url: string | null }>;
  check: { id: string; status: string } | null;
};

function when(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
}

async function bearer() {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

export default function DeathReportEvidence({ report, canDecide }: { report: Report; canDecide: boolean }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [message, setMessage] = useState("");
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true); setMessage("");
    const res = await fetch(`/api/internal/admin/estate-cases/death-reports/${encodeURIComponent(report.id)}/evidence`, { headers: { authorization: await bearer() }, cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !json.ok) { setMessage(json.message ?? "The evidence isn’t available."); return; }
    setEvidence(json);
  }

  async function askForMore() {
    if (!reason.trim()) { setMessage("Say what you need, in words the reporter will understand."); return; }
    setBusy(true); setMessage("");
    const res = await fetch(`/api/internal/admin/estate-cases/death-reports/${encodeURIComponent(report.id)}/actions`, {
      method: "POST", headers: { authorization: await bearer(), "content-type": "application/json" }, body: JSON.stringify({ action: "request_evidence", reason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || json.ok === false) { setMessage(json.message ?? "That didn’t save."); return; }
    setAsking(false); setReason("");
    setMessage("Asked for more evidence. The reporter has been told. Nothing unlocks until you approve.");
  }

  const canAsk = ["submitted", "under_review"].includes(report.status);
  return <article className="lf-admin-death-report">
    <header>
      <div><strong>Death report</strong><small>{report.role.replace(/_/g, " ")} · {when(report.submittedAt)} · {report.status.replace(/_/g, " ")}</small></div>
      {!evidence && canDecide ? <button type="button" className="lf-admin-row-button" disabled={busy} onClick={() => void open()}><Icon name="visibility" size={18} />{busy ? "Opening…" : "Review evidence"}</button> : null}
    </header>
    {evidence ? <>
      <dl className="lf-admin-keyvalues">
        <div><dt>Reported by</dt><dd>{evidence.report.reporterName}<small>{evidence.report.relationship ?? evidence.report.role.replace(/_/g, " ")}</small></dd></div>
        <div><dt>Date of death</dt><dd>{evidence.report.dateOfDeath ?? "Not given"}</dd></div>
      </dl>
      <h3>Death certificate and files</h3>
      {evidence.files.length ? <ul className="lf-admin-file-list">{evidence.files.map((file) => <li key={file.id}>
        <Icon name="description" size={18} /><span>{file.fileName}<small>{file.type.replace(/_/g, " ")}</small></span>
        {file.url ? <a className="lf-admin-row-button" href={file.url} target="_blank" rel="noopener noreferrer">Open</a> : <span>Unavailable</span>}
      </li>)}</ul> : <p className="lf-admin-muted">No files yet. Ask for the death certificate before releasing.</p>}
      <h3>Reporter’s fresh ID check</h3>
      {evidence.check ? (evidence.check.status === "review_required"
        ? <IdentityReviewCompare requestId={evidence.check.id} canDecide={canDecide} title="Reporter’s photos" />
        : <p className="lf-admin-muted">Check {evidence.check.status.replace(/_/g, " ")}. Its photos have been deleted.</p>)
        : <p className="lf-admin-muted">The reporter hasn’t done a fresh ID check yet. Ask for one before releasing.</p>}
    </> : null}
    {canDecide && canAsk ? (asking ? <div className="lf-admin-form-card">
      <label className="lf-admin-field">What do you need from the reporter?
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example, a clearer copy of the death certificate, or a fresh ID check." />
      </label>
      <div className="lf-admin-decision-footer"><button type="button" className="lf-admin-row-button" onClick={() => setAsking(false)}>Cancel</button><button type="button" className="lf-admin-primary-button" disabled={busy} onClick={() => void askForMore()}>{busy ? "Sending…" : "Ask for more evidence"}</button></div>
    </div> : <button type="button" className="lf-admin-row-button" onClick={() => setAsking(true)}><Icon name="mail" size={18} />Ask for more evidence</button>) : null}
    {message ? <p className="lf-admin-muted" role="status">{message}</p> : null}
  </article>;
}
