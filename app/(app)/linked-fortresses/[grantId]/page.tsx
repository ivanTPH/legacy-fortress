"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PlatformChip, PlatformEmptyState, PlatformInfoTile, PlatformNotice, PlatformSection } from "../../../../components/ui/PlatformPrimitives";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { getLinkedFortressAccessLabel, getRoleLabel, loadLinkedFortressSummaries, setStoredLinkedGrantId, type LinkedFortressSummary } from "../../../../lib/access-control/viewerAccess";
import { supabase } from "../../../../lib/supabaseClient";

const ESTATE_ROLES = new Set(["executor", "trustee", "power_of_attorney"]);

export default function LinkedFortressDetailPage() {
  const params = useParams<{ grantId: string }>();
  const grantId = String(params?.grantId ?? "");
  const [fortress, setFortress] = useState<LinkedFortressSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [requestState, setRequestState] = useState<"idle" | "confirming" | "submitting" | "submitted" | "error">("idle");
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        if (mounted) setState("empty");
        return;
      }
      const next = (await loadLinkedFortressSummaries(supabase, user.id)).find((item) => item.grantId === grantId) ?? null;
      if (!mounted) return;
      setFortress(next);
      setState(next ? "ready" : "empty");
    }
    void load();
    return () => { mounted = false; };
  }, [grantId]);

  if (state === "loading") return <main className="lf-page-shell"><section className="lf-page-card"><h1>Opening linked Fortress</h1><p className="lf-muted-note">Checking the relationship and current access state...</p></section></main>;
  if (!fortress) return <main className="lf-page-shell"><section className="lf-page-card"><PlatformEmptyState icon="account_tree" title="Linked Fortress unavailable" detail="This relationship is no longer available to this account." action={<Link className="lf-link-btn" href="/linked-fortresses">Back to Linked Fortresses</Link>} /></section></main>;
  const linkedFortress = fortress;

  const canStartEstateRequest = ESTATE_ROLES.has(linkedFortress.role);

  async function startEstateAccessRequest() {
    if (requestState === "submitting") return;
    setRequestState("submitting");
    setRequestMessage("");
    try {
      const reportResponse = await fetch("/api/estate/death-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerUserId: linkedFortress.ownerUserId,
          claimantRole: linkedFortress.role,
          relationship: getRoleLabel(linkedFortress.role),
          declarationAccepted: true,
        }),
      });
      const reportBody = await reportResponse.json().catch(() => ({})) as { report?: { id?: string }; error?: string };
      if (!reportResponse.ok || !reportBody.report?.id) throw new Error(reportBody.error ?? "estate_request_failed");
      const claimResponse = await fetch(`/api/estate/death-reports/${encodeURIComponent(reportBody.report.id)}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleClaimed: linkedFortress.role }),
      });
      const claimBody = await claimResponse.json().catch(() => ({})) as { error?: string };
      if (!claimResponse.ok) throw new Error(claimBody.error ?? "estate_claim_failed");
      setRequestState("submitted");
      setRequestMessage("Your request has been submitted for evidence, identity, authority and approval checks. Estate access remains locked until those checks are complete.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "estate_request_failed";
      setRequestState("error");
      setRequestMessage(code === "level_3_required_for_death_report" ? "Complete the required identity check before starting this request." : "We could not start this estate access request. Please try again later.");
    }
  }

  return (
    <main className="lf-page-shell">
      <section className="lf-page-card">
        <div className="lf-page-header">
          <div>
            <p className="lf-eyebrow">Linked Fortress</p>
            <h1>{fortress.ownerName}&apos;s Legacy Fortress</h1>
            <p className="lf-muted-note">You are securely linked through a {getRoleLabel(fortress.role)} relationship. Your Personal Vault remains separate.</p>
          </div>
          <PlatformChip tone={fortress.accessState === "estate_locked" ? "warning" : "default"}>{getLinkedFortressAccessLabel(fortress)}</PlatformChip>
        </div>
      </section>

      <PlatformSection icon="verified_user" title="Relationship status" detail="Relationship, identity and access are separate decisions.">
        <div className="lf-dashboard-grid">
          <PlatformInfoTile label="Your role" value={getRoleLabel(fortress.role)} />
          <PlatformInfoTile label="Connection" value={fortress.activationStatus === "active" || fortress.activationStatus === "verified" ? "Linked" : "Accepted"} />
          <PlatformInfoTile label="Identity" value={fortress.identityAssuranceLevel >= fortress.requiredIdentityLevel ? "Verified" : "Verification required"} />
          <PlatformInfoTile label="Estate access" value={fortress.accessState === "estate_locked" ? "Locked" : getLinkedFortressAccessLabel(fortress)} />
        </div>
      </PlatformSection>

      <PlatformNotice icon="lock">
        Being linked does not by itself give you access to {fortress.ownerName}&apos;s private records or documents. Identity verification does not establish legal authority or activate estate access.
      </PlatformNotice>

      {fortress.sharedRecordCount > 0 && fortress.accessState === "records_shared" ? (
        <PlatformSection icon="visibility" title="Shared records" detail="Only records authorised through the existing owner grant and server-side access controls are available.">
          <Link className="lf-primary-btn" href={`/contact-wallet?grant=${encodeURIComponent(fortress.grantId)}`} onClick={() => setStoredLinkedGrantId(fortress.grantId)}>View shared records</Link>
        </PlatformSection>
      ) : (
        <PlatformSection icon="lock" title="Estate records locked" detail="No estate records are currently available to you.">
          {canStartEstateRequest ? (
            requestState === "submitted" ? <p className="lf-muted-note" role="status">{requestMessage}</p> : requestState === "confirming" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="lf-muted-note">This starts a review case. It does not upload evidence or unlock estate records.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="lf-primary-btn" type="button" onClick={() => void startEstateAccessRequest()}>Begin request</button>
                  <button className="lf-link-btn" type="button" onClick={() => setRequestState("idle")}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {requestMessage ? <p className="lf-muted-note" role="alert">{requestMessage}</p> : null}
                <button className="lf-primary-btn" type="button" disabled={requestState === "submitting"} onClick={() => setRequestState("confirming")}>
                  {requestState === "submitting" ? "Submitting request..." : "Report a death / begin estate access request"}
                </button>
              </div>
            )
          ) : <p className="lf-muted-note">If you need to act following {fortress.ownerName}&apos;s death, Legacy Fortress will guide you through the required evidence, identity, authority and approval checks.</p>}
        </PlatformSection>
      )}

      <Link className="lf-link-btn" href="/linked-fortresses">Back to Linked Fortresses</Link>
    </main>
  );
}
