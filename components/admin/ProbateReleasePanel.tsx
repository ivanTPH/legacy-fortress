"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Probate case › Release to nominees (step 4 of the release). Available once the case is
 * approved with the grant of probate. Only ID-verified nominees are released; the rest wait.
 */
type Readiness = { activeNominations: number; releasedNominations: number; idVerified: number; notJoined: number };

export default function ProbateReleasePanel({ caseId, canDecide }: { caseId: string; canDecide: boolean }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [hasGrant, setHasGrant] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const call = useCallback(async (init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(init?.headers ?? {});
    headers.set("authorization", `Bearer ${data.session?.access_token ?? ""}`);
    if (init?.body) headers.set("content-type", "application/json");
    const res = await fetch(`/api/internal/admin/probate-cases/${encodeURIComponent(caseId)}/release`, { ...init, headers });
    return { res, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  }, [caseId]);

  const load = useCallback(async () => {
    const { res, json } = await call();
    if (res.ok && json.ok) { setReadiness(json.readiness as Readiness); setHasGrant(Boolean(json.hasGrantOfProbate)); }
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  async function release() {
    setBusy(true); setMessage("");
    const { res, json } = await call({ method: "POST", body: JSON.stringify({ reason }) });
    setBusy(false);
    if (!res.ok || !json.ok) { setMessage(String(json.message ?? "The release didn’t go through.")); return; }
    const released = Number(json.released ?? 0);
    const waiting = Number(json.waitingForId ?? 0);
    setMessage(`${released} nominee${released === 1 ? "" : "s"} released.${waiting ? ` ${waiting} waiting for their ID check.` : ""}`);
    setReason("");
    await load();
  }

  if (!readiness) return null;
  const total = readiness.activeNominations + readiness.releasedNominations;
  return <section className="lf-admin-table-card lf-admin-form-card" aria-label="Release to nominees">
    <h2>Release to nominees</h2>
    {total === 0 ? <p className="lf-admin-muted">The owner didn’t nominate anyone for later.</p> : <>
      <dl className="lf-admin-keyvalues">
        <div><dt>Nominated</dt><dd>{total}</dd></div>
        <div><dt>Released</dt><dd>{readiness.releasedNominations}</dd></div>
        <div><dt>Ready (ID verified)</dt><dd>{readiness.idVerified}</dd></div>
        <div><dt>Not joined yet</dt><dd>{readiness.notJoined}</dd></div>
      </dl>
      {!hasGrant ? <p className="lf-admin-muted">Release waits for the grant of probate. Add it to this case’s evidence first.</p> : null}
      {message ? <p className="lf-admin-muted" role="status">{message}</p> : null}
      {canDecide && hasGrant && readiness.activeNominations > 0 ? <>
        <label className="lf-admin-field">Decision notes (required)
          <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What you checked before releasing" />
        </label>
        <button type="button" className="lf-admin-primary-button" disabled={busy || !reason.trim() || readiness.idVerified === 0} onClick={() => void release()}>
          {busy ? "Releasing…" : `Release to ${readiness.idVerified} nominee${readiness.idVerified === 1 ? "" : "s"}`}
        </button>
        {readiness.idVerified < readiness.activeNominations ? <p className="lf-admin-muted">Nominees without a verified ID stay locked. Run the release again once they’ve verified.</p> : null}
      </> : null}
    </>}
  </section>;
}
