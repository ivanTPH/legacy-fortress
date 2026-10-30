"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlatformChip, PlatformEmptyState, PlatformInfoTile, PlatformSection } from "../../../components/ui/PlatformPrimitives";
import { waitForActiveUser } from "../../../lib/auth/session";
import { getLinkedFortressAccessLabel, getRoleLabel, loadLinkedFortressSummaries, type LinkedFortressSummary } from "../../../lib/access-control/viewerAccess";
import { supabase } from "../../../lib/supabaseClient";

export default function LinkedFortressesPage() {
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [fortresses, setFortresses] = useState<LinkedFortressSummary[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        if (mounted) setState("empty");
        return;
      }
      const next = await loadLinkedFortressSummaries(supabase, user.id);
      if (!mounted) return;
      setFortresses(next);
      setState(next.length ? "ready" : "empty");
    }
    void load().catch(() => mounted && setState("error"));
    return () => { mounted = false; };
  }, []);

  if (state === "loading") {
    return <main className="lf-page-shell"><section className="lf-page-card"><h1>Linked Fortresses</h1><p className="lf-muted-note">Checking your accepted relationships...</p></section></main>;
  }

  if (!fortresses.length) {
    return (
      <main className="lf-page-shell">
        <section className="lf-page-card">
          <h1>Linked Fortresses</h1>
          <PlatformEmptyState icon="account_tree" title="No linked Fortresses yet" detail={state === "error" ? "We could not load your linked relationships." : "Accepted relationships to other Fortresses will appear here."} action={<Link className="lf-link-btn" href="/dashboard">Return to My Fortress</Link>} />
        </section>
      </main>
    );
  }

  return (
    <main className="lf-page-shell">
      <section className="lf-page-card">
        <div className="lf-page-header">
          <div>
            <h1>Linked Fortresses</h1>
            <p className="lf-muted-note">These are other people&apos;s Fortresses where you have an accepted relationship. A relationship does not by itself provide access to private records.</p>
          </div>
          <PlatformChip tone="default">{fortresses.length} linked</PlatformChip>
        </div>
      </section>

      <PlatformSection icon="account_tree" title="Your linked relationships" detail="Each Fortress remains separate from your own Personal Vault.">
        <div style={{ display: "grid", gap: 10 }}>
          {fortresses.map((fortress) => (
            <Link key={fortress.grantId} href={`/linked-fortresses/${fortress.grantId}`} style={cardLinkStyle}>
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <strong>{fortress.ownerName}&apos;s Fortress</strong>
                <span style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{getRoleLabel(fortress.role)}</span>
              </div>
              <div style={{ display: "grid", gap: 3, textAlign: "right" }}>
                <strong>{getLinkedFortressAccessLabel(fortress)}</strong>
                <span style={{ color: "var(--lf-text-secondary)", fontSize: 12 }}>{fortress.activationStatus === "active" || fortress.activationStatus === "verified" ? "Linked" : "Connection in progress"}</span>
              </div>
            </Link>
          ))}
        </div>
      </PlatformSection>
    </main>
  );
}

const cardLinkStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "14px 16px",
  border: "1px solid var(--lf-border)",
  borderRadius: 10,
  color: "var(--lf-text)",
  textDecoration: "none",
  background: "var(--lf-surface-card)",
};
