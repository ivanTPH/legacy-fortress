"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BrandMark from "../../(app)/components/BrandMark";
import Icon from "../../../components/ui/Icon";
import { loadLinkedFortressSummaries } from "../../../lib/access-control/viewerAccess";
import { supabase } from "../../../lib/supabaseClient";
import { loadMyNominations } from "../../../lib/vaultAccess/vaultAccess";

/**
 * Report a death (Journeys 6a–6b; owner decision 30 Oct: any nominee or executor may report).
 * Reporting never opens anything. It starts the release checks: evidence, verification, approval.
 */

type Subject = { key: string; label: string; detail: string; ownerUserId?: string; nominationRef?: string };

const ERRORS: Record<string, string> = {
  estate_relationship_required: "You can report a death only for someone who nominated you or named you as executor, trustee or attorney.",
  level_3_required_for_death_report: "Before reporting a death we need a fresh check that it’s you. It takes about a minute.",
  death_report_declaration_required: "Tick the declaration to continue.",
  owner_dispute_flow_required_for_self_report: "You can’t report your own death.",
};

export default function EstateDeathReportPageClient() {
  const params = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectKey, setSubjectKey] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDone, setEvidenceDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [maxDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id ?? "";
      if (!userId) { if (active) setSubjects([]); return; }
      const [nominations, linked] = await Promise.all([loadMyNominations(supabase), loadLinkedFortressSummaries(supabase, userId).catch(() => [])]);
      const list: Subject[] = [
        ...nominations.filter((item) => item.releaseStage === "none").map((item) => ({ key: `n:${item.ref}`, label: item.ownerName, detail: "You’re nominated for their Vault", nominationRef: item.ref })),
        ...linked.filter((item) => ["executor", "trustee", "power_of_attorney"].includes(String(item.role))).map((item) => ({ key: `o:${item.ownerUserId}`, label: item.ownerName, detail: `You’re their ${String(item.role).replace(/_/g, " ")}`, ownerUserId: item.ownerUserId })),
      ];
      const unique = list.filter((item, index) => list.findIndex((other) => other.label === item.label && other.ownerUserId === item.ownerUserId) === index);
      if (!active) return;
      setSubjects(unique);
      const preset = params.get("nomination");
      const presetKey = preset ? `n:${preset}` : "";
      setSubjectKey(unique.some((item) => item.key === presetKey) ? presetKey : unique.length === 1 ? unique[0].key : "");
    })();
    return () => { active = false; };
  }, [params]);

  const subject = useMemo(() => subjects?.find((item) => item.key === subjectKey), [subjects, subjectKey]);

  async function bearer() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function submitReport() {
    if (!subject) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/estate/death-reports", {
        method: "POST",
        headers: { Authorization: `Bearer ${await bearer()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId: subject.ownerUserId, nominationRef: subject.nominationRef, dateOfDeath: dateOfDeath || null, declarationAccepted }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error ?? "death_report_failed"));
      setReportId(json.report.id);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(ERRORS[code] ?? "The report wasn’t sent. Try again, or contact support.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadEvidence() {
    if (!reportId || !evidenceFile) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("file", evidenceFile);
      form.set("evidenceType", "death_certificate");
      const res = await fetch(`/api/estate/death-reports/${encodeURIComponent(reportId)}/evidence`, { method: "POST", headers: { Authorization: `Bearer ${await bearer()}` }, body: form });
      if (!res.ok) throw new Error("upload");
      setEvidenceDone(true);
    } catch {
      setError("The file didn’t upload. Try a PDF or photo under 10 MB.");
    } finally {
      setBusy(false);
    }
  }

  const needsPresence = error === ERRORS.level_3_required_for_death_report;

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Report a death</div>
          </div>
        </div>
        <div className="lf-auth-art-copy">
          <h2>We’re sorry for your loss.</h2>
          <p>Reporting a death starts the release checks. It doesn’t open anyone’s Vault. Our team checks the evidence first, and nothing is shared until the release is approved.</p>
        </div>
      </section>
      <section className="lf-auth-form-side">
        <div className="lf-auth-card lf-death-report" style={{ maxWidth: 640 }}>
          <button type="button" className="lf-va-back" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/dashboard")}><Icon name="chevron_left" size={20} />Back</button>
          {!reportId ? <>
            <h1>Report a death</h1>
            {subjects === null ? <p className="lf-va-muted">Loading…</p> : subjects.length === 0 ? <p>You can report a death for someone who nominated you or named you as executor, trustee or attorney. There’s no one like that linked to your account. If you think this is wrong, <Link href="/support">contact support</Link>.</p> : <>
              <fieldset className="lf-death-report-subjects">
                <legend>Whose death are you reporting?</legend>
                {subjects.map((item) => <label key={item.key} className={subjectKey === item.key ? "is-selected" : ""}>
                  <input type="radio" name="death-subject" checked={subjectKey === item.key} onChange={() => setSubjectKey(item.key)} />
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                </label>)}
              </fieldset>
              <label>Date of death · Optional<input type="date" max={maxDate} value={dateOfDeath} onChange={(event) => setDateOfDeath(event.target.value)} /></label>
              <label className="lf-death-report-declaration">
                <input type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} />
                <span>I’m reporting this in good faith. I understand that reporting doesn’t give me access to anything, and that a false report is taken seriously.</span>
              </label>
              {error ? <p className="lf-va-error" role="alert">{error}{needsPresence ? <> <Link href={`/identity/verify?purpose=step_up_presence`}>Check it’s you</Link></> : null}</p> : null}
              <button className="lf-primary-btn" type="button" onClick={() => void submitReport()} disabled={busy || !subject || !declarationAccepted}>
                {busy ? "Sending…" : "Report the death"}
              </button>
            </>}
          </> : <>
            <h1>Thank you</h1>
            <p>We’ve started the release checks. Nothing in {subject?.label ?? "their"}’s Vault is shared until the death is verified and the release is approved.</p>
            <ol className="lf-va-release-steps" aria-label="Release steps">
              <li className="is-done"><span aria-hidden="true"><Icon name="check" size={16} /></span><div><strong>Death reported</strong></div></li>
              <li className={evidenceDone ? "is-done" : "is-current"}><span aria-hidden="true">{evidenceDone ? <Icon name="check" size={16} /> : 2}</span><div><strong>Add the death certificate</strong><small>{evidenceDone ? "Received. Our team will review it." : "A photo or PDF is fine."}</small></div></li>
              <li><span aria-hidden="true">3</span><div><strong>Death verified</strong></div></li>
              <li><span aria-hidden="true">4</span><div><strong>Release approved</strong></div></li>
            </ol>
            {!evidenceDone ? <>
              <label>Death certificate<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setEvidenceFile(event.currentTarget.files?.[0] ?? null)} /></label>
              {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
              <button type="button" className="lf-primary-btn" onClick={() => void uploadEvidence()} disabled={busy || !evidenceFile}>
                <Icon name="upload_file" size={16} />{busy ? "Uploading…" : "Upload certificate"}
              </button>
            </> : <Link className="lf-primary-btn" href="/vault-nominations">Done</Link>}
          </>}
        </div>
      </section>
    </main>
  );
}
