"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "../../(app)/components/BrandMark";
import Icon from "../../../components/ui/Icon";
import { supabase } from "../../../lib/supabaseClient";
import { waitForActiveUser } from "../../../lib/auth/session";
import {
  getRoleLabel,
  setStoredLinkedGrantId,
} from "../../../lib/access-control/viewerAccess";

type InvitationSummary = {
  invitation_id: string;
  contact_id: string | null;
  contact_name: string;
  contact_email: string;
  assigned_role: string;
  invitation_status: string;
  activation_status: string;
  account_holder_name: string;
  relationship: string | null;
};

type AcceptResult = {
  grant_id: string;
  owner_user_id: string;
  linked_user_id: string;
  contact_id: string | null;
  assigned_role: string;
  activation_status: string;
  account_holder_name: string;
  contact_name: string;
};

export default function InvitationAcceptPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitation") ?? "";
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<InvitationSummary | null>(null);
  const [sessionUserId, setSessionUserId] = useState("");

  const nextAuthPath = useMemo(() => {
    const params = new URLSearchParams({
      invitation: invitationId,
      token,
    });
    return `/invite/accept?${params.toString()}`;
  }, [invitationId, token]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      if (!invitationId || !token) {
        if (!mounted) return;
        setStatus("Invitation link is incomplete.");
        setLoading(false);
        return;
      }

      const [summaryRes, user] = await Promise.all([
        supabase.rpc("get_public_contact_invitation", {
          p_invitation_id: invitationId,
          p_token: token,
        }),
        waitForActiveUser(supabase, { attempts: 3, delayMs: 100 }),
      ]);

      if (!mounted) return;

      if (summaryRes.error || !(summaryRes.data?.[0])) {
        setStatus(summaryRes.error?.message || "This invitation link is invalid or has expired.");
        setSummary(null);
      } else {
        setSummary(summaryRes.data[0] as InvitationSummary);
      }

      setSessionUserId(user?.id ?? "");
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [invitationId, token]);

  async function acceptInvitation() {
    if (!invitationId || !token) {
      setStatus("Invitation link is incomplete.");
      return;
    }

    setAccepting(true);
    setStatus("");

    try {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        router.replace(`/sign-in?next=${encodeURIComponent(nextAuthPath)}`);
        return;
      }

      const acceptRes = await supabase.rpc("accept_contact_invitation", {
        p_invitation_id: invitationId,
        p_token: token,
      });

      if (acceptRes.error || !(acceptRes.data?.[0])) {
        setStatus(acceptRes.error?.message || "Could not accept this invitation.");
        return;
      }

      const result = acceptRes.data[0] as AcceptResult;
      setStoredLinkedGrantId(result.grant_id);
      setStatus(`Access accepted. Redirecting you to ${result.account_holder_name}'s records...`);
      router.replace("/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not accept this invitation.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Trusted access invitation</div>
          </div>
        </div>

        <div className="lf-auth-art-copy">
          <h2>Secure access for a trusted role.</h2>
          <p>Review the role you have been invited to, then sign in or create an account to open a protected, view-only version of the estate record.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Accept invitation</h1>
          <p className="lf-auth-subtext">
            {summary
              ? `You have been invited as ${getRoleLabel(summary.assigned_role as never)} for ${summary.account_holder_name}.`
              : "We are validating the secure invitation link."}
          </p>

          {loading ? <div className="lf-muted-note">Checking invitation...</div> : null}

          {!loading && summary ? (
            <section style={{ display: "grid", gap: 12 }}>
              <div style={invitePanelStyle}>
                <div style={{ fontWeight: 700 }}>{summary.account_holder_name}</div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  Role: {getRoleLabel(summary.assigned_role as never)}
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  Access: view-only, role-based review of shared estate records and documents
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  Email: {summary.contact_email}
                </div>
                {summary.relationship ? (
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    Relationship: {summary.relationship}
                  </div>
                ) : null}
              </div>

              {sessionUserId ? (
                <button className="lf-primary-btn" type="button" onClick={() => void acceptInvitation()} disabled={accepting}>
                  <Icon name="verified_user" size={16} />
                  {accepting ? "Accepting..." : "Accept and continue"}
                </button>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <Link className="lf-primary-btn" href={`/sign-in?next=${encodeURIComponent(nextAuthPath)}`}>
                    <Icon name="login" size={16} />
                    Sign in to accept
                  </Link>
                  <Link className="lf-link-btn" href={`/sign-up?next=${encodeURIComponent(nextAuthPath)}`}>
                    <Icon name="person_add" size={16} />
                    Create account to accept
                  </Link>
                </div>
              )}

              <div className="lf-muted-note" style={{ display: "grid", gap: 4 }}>
                <div>You will be able to open records, review attachments, and download documents that have been shared with your role.</div>
                <div>This access is intentionally view-only so the account holder remains in control of their record.</div>
                <div>If you later want your own private workspace, you can create a separate Legacy Fortress account without affecting this invitation.</div>
              </div>
            </section>
          ) : null}

          {status ? <div className="lf-muted-note" role="alert">{status}</div> : null}
        </div>
      </section>
    </main>
  );
}

const invitePanelStyle = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 6,
} as const;
