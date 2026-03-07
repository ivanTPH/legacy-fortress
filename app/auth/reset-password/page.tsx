"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/(app)/components/BrandMark";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Validating reset link...");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 150 });
        if (!user) {
          setStatus("Reset session is invalid or expired. Request a new reset link.");
          setReady(false);
          return;
        }

        if (!mounted) return;
        setReady(true);
        setStatus("");
      } catch (error) {
        if (!mounted) return;
        setReady(false);
        setStatus(`Could not validate reset link: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  async function updatePassword() {
    if (password.length < 10) {
      setStatus("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Password confirmation does not match.");
      return;
    }

    setSaving(true);
    setStatus("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setStatus(`Could not reset password: ${error.message}`);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatus("Password updated. You can now sign in.");
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
          <h1>Reset password</h1>
          <p className="lf-auth-subtext">Set a new account password for your Legacy Fortress sign-in.</p>

          <label className="lf-label">
            <span>New password</span>
            <input
              className="lf-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={!ready || saving}
            />
          </label>

          <label className="lf-label">
            <span>Confirm password</span>
            <input
              className="lf-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={!ready || saving}
            />
          </label>

          <button
            className="lf-primary-btn"
            type="button"
            onClick={() => void updatePassword()}
            disabled={!ready || saving || !password || !confirmPassword}
          >
            {saving ? "Updating..." : "Update password"}
          </button>

          {status ? <div className="lf-muted-note">{status}</div> : null}

          <p className="lf-muted-note">
            Back to <Link className="lf-inline-link" href="/signin">Sign in</Link>
          </p>
          <p className="lf-muted-note">
            Need a new link? <Link className="lf-inline-link" href="/forgot-password">Request password reset</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
