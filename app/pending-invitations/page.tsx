"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { createPendingInvitationLink, loadPendingInvitations, type PendingInvitationSummary } from "../../lib/auth/pendingInvitations";
import { getRoleLabel } from "../../lib/access-control/viewerAccess";

export default function PendingInvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<PendingInvitationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState("");

  useEffect(() => {
    let mounted = true;
    void loadPendingInvitations(supabase).then((rows) => {
      if (!mounted) return;
      if (rows.length === 0) router.replace("/dashboard");
      setInvitations(rows);
    }).catch(() => {
      if (mounted) setError("Your invitations could not be loaded.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [router]);

  async function openInvitation(invitationId: string) {
    setOpening(invitationId);
    setError("");
    try {
      router.replace(await createPendingInvitationLink(supabase, invitationId));
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "This invitation could not be opened.");
      setOpening("");
    }
  }

  return (
    <main className="lf-auth" style={{ minHeight: "100vh", padding: 24 }}>
      <section className="lf-auth-form-side" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div className="lf-auth-card">
          <h1>Your invitations</h1>
          <p className="lf-auth-subtext">Choose the invited role you want to handle. Each invitation remains tied to its intended account and owner.</p>
          {loading ? <div className="lf-muted-note">Checking invitations...</div> : null}
          {error ? <div className="lf-muted-note" role="alert">{error}</div> : null}
          <div style={{ display: "grid", gap: 12 }}>
            {invitations.map((invitation) => (
              <article key={invitation.invitationId} style={invitationCardStyle}>
                <div>
                  <strong>{getRoleLabel(invitation.assignedRole as never)} for {invitation.ownerName}</strong>
                  <div className="lf-muted-note">Sent invitation · {invitation.contactEmail}</div>
                </div>
                <button className="lf-primary-btn" type="button" onClick={() => void openInvitation(invitation.invitationId)} disabled={opening === invitation.invitationId}>
                  {opening === invitation.invitationId ? "Opening..." : "View invitation"}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const invitationCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
} as const;
