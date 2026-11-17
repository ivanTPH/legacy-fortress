"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { answerEarlyAccessRequest, loadOpenEarlyAccessRequests, type EarlyAccessRequest } from "../../lib/vaultAccess/vaultAccess";

/**
 * "X asked for access now", answered where it's shown (owner, 17 Nov 2026): read the message, then "Not now" here,
 * or choose records on the person's page. Asking never shares anything; only a saved record selection does.
 */
export default function EarlyAccessActions({ requestId, name, onAnswered }: { requestId: string; name: string; onAnswered?: () => void }) {
  const [ownerId, setOwnerId] = useState("");
  const [request, setRequest] = useState<EarlyAccessRequest | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 200 });
        if (!active) return;
        if (!user) { setRequest(null); return; }
        setOwnerId(user.id);
        const open = await loadOpenEarlyAccessRequests(supabase, user.id);
        if (active) setRequest(open.find((item) => item.id === requestId) ?? null);
      } catch { if (active) setRequest(null); }
    })();
    return () => { active = false; };
  }, [requestId]);

  async function decline() {
    if (!ownerId) return;
    setBusy(true); setError("");
    try { await answerEarlyAccessRequest(supabase, ownerId, requestId, "declined"); setDone(true); onAnswered?.(); }
    catch { setError("That didn’t save. Nothing has changed. Try again."); }
    finally { setBusy(false); }
  }

  if (request === undefined) return <p className="lf-invite-note">Loading the request…</p>;
  if (done) return <p className="lf-invite-note" role="status">Answered. Nothing was shared with {name}.</p>;
  if (!request) return <p className="lf-invite-note">This request has already been answered.</p>;
  return (
    <div className="lf-inbox-early-access">
      {request.message ? <blockquote className="lf-va-request-message"><small>{name}’s message · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(request.createdAt))}</small>{request.message}</blockquote> : null}
      <p className="lf-invite-note">Nothing changes unless you share something. If you do, you choose exactly which records.</p>
      {error ? <p className="lf-named-error" role="alert">{error}</p> : null}
      <div className="lf-invite-buttons">
        <Link className="lf-inbox-primary" href={`/people-access?view=people&contact=${encodeURIComponent(request.personId)}`}>Choose records to share</Link>
        <button type="button" className="lf-inbox-secondary" disabled={busy} onClick={() => void decline()}>{busy ? "Saving…" : "Not now"}</button>
      </div>
    </div>
  );
}
