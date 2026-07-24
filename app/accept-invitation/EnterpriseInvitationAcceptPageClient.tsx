"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import BrandMark from "../(app)/components/BrandMark";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type Preview = {
  invitation: {
    email: string;
    fullName: string | null;
    invitationType: string;
    roleTemplate: string;
    expiresAt: string;
    requireMfa: boolean;
  };
  organisation: {
    name: string;
    status: string;
  };
};

export default function EnterpriseInvitationAcceptPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const type = searchParams.get("type") === "enrolment" ? "enrolment" : "enterprise";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [message, setMessage] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [reportingConsent, setReportingConsent] = useState(true);
  const [adviserInsightConsent, setAdviserInsightConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [communicationEmail, setCommunicationEmail] = useState(true);

  const nextPath = useMemo(() => `/accept-invitation?type=${encodeURIComponent(type)}&token=${encodeURIComponent(token)}`, [token, type]);

  const loadPreview = useCallback(async () => {
    setState("checking");
    setMessage("");
    if (!token) {
      setState("invalid");
      setMessage("This invitation link is missing its secure token.");
      return;
    }
    if (type === "enrolment") {
      setPreview(null);
      setState("ready");
      return;
    }
    const res = await fetch(`/api/enterprise/invitations/accept?token=${encodeURIComponent(token)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; preview?: Preview; message?: string };
    if (!res.ok || !json.ok || !json.preview) {
      setPreview(null);
      setState("invalid");
      setMessage(json.message || "This invitation cannot be opened.");
      return;
    }
    setPreview(json.preview);
    setState("ready");
  }, [token, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPreview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPreview]);

  async function accept() {
    setMessage("");
    const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    if (!termsAccepted) {
      setMessage("Accept the organisation terms to continue.");
      return;
    }
    setAccepting(true);
    const session = await supabase.auth.getSession();
    const tokenHeader = session.data.session?.access_token ?? "";
    const res = await fetch("/api/enterprise/invitations/accept", {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenHeader}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token,
        type,
        organisationTermsAccepted: termsAccepted,
        reportingConsent,
        adviserInsightConsent,
        marketingConsent,
        communicationPreferences: { email: communicationEmail },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    setAccepting(false);
    if (!res.ok || !json.ok) {
      setMessage(json.message || "This invitation could not be accepted.");
      return;
    }
    setMessage("Access accepted. Redirecting to Enterprise Operations...");
    router.replace("/application/enterprise");
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Enterprise access invitation</div>
          </div>
        </div>
        <div className="lf-auth-art-copy">
          <h2>Accept secure organisation access.</h2>
          <p>Sign in with the invited email address, review the organisation role, and accept only the consent settings you choose.</p>
        </div>
      </section>
      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Accept invitation</h1>
          {state === "checking" ? <p className="lf-auth-subtext">Checking the secure invitation link.</p> : null}
          {state === "invalid" ? (
            <section style={panelStyle}>
              <strong>This invitation cannot be opened.</strong>
              <p>{message}</p>
              <div style={rowStyle}>
                <Link className="lf-primary-btn" href="/sign-in">Go to sign in</Link>
                <Link className="lf-link-btn" href="/support">Contact support</Link>
              </div>
            </section>
          ) : null}
          {state === "ready" ? (
            <section style={{ display: "grid", gap: 14 }}>
              <div style={panelStyle}>
                <strong>{preview?.organisation.name ?? "Organisation enrolment"}</strong>
                <span>Role: {labelise(preview?.invitation.roleTemplate ?? "organisation_member")}</span>
                <span>Expires: {preview?.invitation.expiresAt ? formatDate(preview.invitation.expiresAt) : "Controlled enrolment link"}</span>
                <span>MFA required: {preview?.invitation.requireMfa ? "Yes" : "Not for this staged flow"}</span>
              </div>
              <label style={checkStyle}><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> I accept the organisation terms for this access.</label>
              <label style={checkStyle}><input type="checkbox" checked={reportingConsent} onChange={(event) => setReportingConsent(event.target.checked)} /> Allow organisation-level reporting metadata.</label>
              <label style={checkStyle}><input type="checkbox" checked={adviserInsightConsent} onChange={(event) => setAdviserInsightConsent(event.target.checked)} /> Allow adviser insight metadata.</label>
              <label style={checkStyle}><input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} /> Allow optional marketing communications.</label>
              <label style={checkStyle}><input type="checkbox" checked={communicationEmail} onChange={(event) => setCommunicationEmail(event.target.checked)} /> Email communication preference.</label>
              <p style={privacyStyle}>Enterprise access does not give the organisation your private vault contents, uploaded documents, legal document contents or individual financial values.</p>
              {message ? <p style={alertStyle}>{message}</p> : null}
              <button className="lf-primary-btn" type="button" onClick={() => void accept()} disabled={accepting}>{accepting ? "Accepting..." : "Accept organisation access"}</button>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function labelise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

const panelStyle = { display: "grid", gap: 8, border: "1px solid #dbe3ef", borderRadius: 8, padding: 12, background: "#f8fafc" };
const rowStyle = { display: "flex", gap: 8, flexWrap: "wrap" as const };
const checkStyle = { display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.45 };
const privacyStyle = { margin: 0, color: "#334155", background: "#f1f5f9", border: "1px solid #dbe3ef", borderRadius: 6, padding: 10 };
const alertStyle = { margin: 0, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: 10 };
