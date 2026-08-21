"use client";

import { useState } from "react";
import BrandMark from "../../(app)/components/BrandMark";
import Icon from "../../../components/ui/Icon";
import { supabase } from "../../../lib/supabaseClient";

export default function EstateDeathReportPageClient() {
  const [ownerUserId, setOwnerUserId] = useState("");
  const [claimantRole, setClaimantRole] = useState("executor");
  const [relationship, setRelationship] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [status, setStatus] = useState("Death reports require recent Level 3 presence and do not grant vault access.");
  const [reportId, setReportId] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function bearer() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function submitReport() {
    setBusy(true);
    setStatus("Submitting death report...");
    try {
      const token = await bearer();
      const res = await fetch("/api/estate/death-reports", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId, claimantRole, relationship, dateOfDeath: dateOfDeath || null, declarationAccepted }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Death report could not be submitted.");
      setReportId(json.report.id);
      setStatus("Report submitted for review. A protective lock may be applied, but estate access still requires separate authority approval.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Death report failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadEvidence() {
    if (!reportId || !evidenceFile) return;
    setBusy(true);
    setStatus("Uploading estate evidence...");
    try {
      const token = await bearer();
      const form = new FormData();
      form.set("file", evidenceFile);
      form.set("evidenceType", "death_certificate");
      const res = await fetch(`/api/estate/death-reports/${encodeURIComponent(reportId)}/evidence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Evidence upload failed.");
      setStatus("Evidence uploaded for review. It does not activate estate access by itself.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Estate transition</div>
          </div>
        </div>
        <div className="lf-auth-art-copy">
          <h2>Report a death without unlocking the vault.</h2>
          <p>A report can trigger protective review. Identity, authority, probate status and estate permissions are reviewed separately.</p>
        </div>
      </section>
      <section className="lf-auth-form-side">
        <div className="lf-auth-card" style={{ maxWidth: 640 }}>
          <h1>Report a death</h1>
          <div className="lf-muted-note" role="status">{status}</div>
          <label>Account owner user ID<input value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} /></label>
          <label>Claimant role
            <select value={claimantRole} onChange={(event) => setClaimantRole(event.target.value)}>
              <option value="executor">Executor</option>
              <option value="family_member">Family member</option>
              <option value="professional_representative">Professional representative</option>
              <option value="administrator">Administrator</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Relationship or appointment<input value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label>
          <label>Date of death if known<input type="date" value={dateOfDeath} onChange={(event) => setDateOfDeath(event.target.value)} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} />
            I understand this report does not grant estate access.
          </label>
          <button className="lf-primary-btn" type="button" onClick={() => void submitReport()} disabled={busy || !ownerUserId || !declarationAccepted}>
            <Icon name="gavel" size={16} />
            Submit report
          </button>
          {reportId ? (
            <section style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <strong>Death certificate or supporting evidence</strong>
              <input type="file" accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => setEvidenceFile(event.currentTarget.files?.[0] ?? null)} />
              <button type="button" className="lf-secondary-btn" onClick={() => void uploadEvidence()} disabled={busy || !evidenceFile}>
                <Icon name="upload_file" size={16} />
                Upload evidence
              </button>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
