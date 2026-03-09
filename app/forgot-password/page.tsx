"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import BrandMark from "../(app)/components/BrandMark";
import { publicEnv } from "../../lib/env";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  async function sendReset() {
    if (!email.trim()) {
      setStatus("Please enter your email.");
      return;
    }

    setSending(true);
    setIsSuccess(false);
    const redirectTo = "https://legacy-fortress-web.vercel.app/reset-password";
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
      setStatus(`Reset request failed: ${error.message}`);
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
                <input className="lf-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </label>

              <button className="lf-primary-btn" onClick={() => void sendReset()} disabled={sending || !email.trim()}>
                {sending ? "Sending..." : "Send reset link"}
              </button>
            </>
          ) : null}

          {status ? <div className="lf-muted-note">{status}</div> : null}
          <p className="lf-muted-note">
            Back to <Link className="lf-inline-link" href="/signin">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
