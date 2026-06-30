"use client";

import { useState } from "react";
import Link from "next/link";
import BrandMark from "../(app)/components/BrandMark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const emailReady = Boolean(email.trim());

  async function sendReset() {
    if (!email.trim()) {
      setStatus("Please enter your email.");
      return;
    }

    setSending(true);
    setIsSuccess(false);
    const [{ createClient }, { getBrowserAuthRedirect }, { publicEnv }] = await Promise.all([
      import("@supabase/supabase-js"),
      import("../../lib/auth/redirects"),
      import("../../lib/env"),
    ]);
    const redirectTo = getBrowserAuthRedirect("/reset-password");
    const recoveryClient = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        flowType: "implicit",
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { error } = await recoveryClient.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setSending(false);
    if (error) {
      setStatus(`Reset request failed: ${error.message}. Check the email address and try again, or contact support if the account should exist.`);
      return;
    }

    setIsSuccess(true);
    setStatus("Password reset link sent. Please check your email.");
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Estate Vault Platform</div>
          </div>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Forgot password</h1>
          <p className="lf-auth-subtext">Send a secure password reset link to your sign-in email.</p>

          {!isSuccess ? (
            <>
              <label className="lf-label">
                <span>Email</span>
                <input
                  className="lf-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  aria-describedby="forgot-password-email-help"
                />
              </label>
              <p className="lf-muted-note" id="forgot-password-email-help" style={{ marginTop: -4 }}>
                {emailReady ? "We will send the reset link to this email address." : "Enter your email address to enable the reset link button."}
              </p>

              <button className="lf-primary-btn" onClick={() => void sendReset()} disabled={sending || !emailReady}>
                {sending ? "Sending..." : "Send reset link"}
              </button>
            </>
          ) : null}

          {status ? <div className="lf-muted-note">{status}</div> : null}
          <p className="lf-muted-note">
            Back to <Link className="lf-inline-link" href="/sign-in">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
