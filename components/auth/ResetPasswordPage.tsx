"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/app/(app)/components/BrandMark";
import { parseRecoveryParams, getRecoveryValidationMessage } from "@/lib/auth/recovery";
import { waitForActiveUser } from "@/lib/auth/session";
import { trackClientEvent } from "@/lib/observability/clientEvents";
import { supabase } from "@/lib/supabaseClient";

// Mirrors the checked-in local Auth configuration. TEST must be confirmed
// against its effective GoTrue settings before this UI is released.
const MIN_PASSWORD_LENGTH = 6;

function passwordUpdateError(message: string) {
  if (/password/i.test(message) && /(character|length|weak|require|minimum|at least)/i.test(message)) {
    return message;
  }
  return "Password reset failed. Please request a new reset email and try again.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Validating reset link...");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const confirmationValid = confirmPassword.length > 0 && password === confirmPassword;

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { code, tokenHash, type, accessToken, refreshToken, hasPkceCode } = parseRecoveryParams(window.location.href);

        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          trackClientEvent("auth.recovery.verify_otp.success");
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          trackClientEvent("auth.recovery.set_session.success");
        } else if (hasPkceCode && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          trackClientEvent("auth.recovery.exchange_code.success");
        }

        if (window.location.hash || window.location.search.includes("token_hash")) {
          window.history.replaceState({}, document.title, "/reset-password");
        }

        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 150 });
        if (!user) {
          setStatus("This recovery session is invalid or expired. Please request a new password reset email.");
          setReady(false);
          trackClientEvent("auth.recovery.invalid_session");
          return;
        }

        if (!mounted) return;
        setReady(true);
        setStatus("Recovery link verified. Enter your new password.");
        trackClientEvent("auth.recovery.ready");
      } catch (error) {
        if (!mounted) return;
        setReady(false);
        setStatus(getRecoveryValidationMessage(error));
        trackClientEvent("auth.recovery.validation_error");
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function updatePassword() {
    setPasswordTouched(true);
    setConfirmTouched(true);
    if (!passwordValid) {
      setStatus(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
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
      setStatus(passwordUpdateError(error.message));
      trackClientEvent("auth.recovery.update_password.error");
      return;
    }

    await supabase.auth.signOut();
    setPassword("");
    setConfirmPassword("");
    setCompleted(true);
    setReady(false);
    setStatus("Password updated successfully. Redirecting to sign in...");
    trackClientEvent("auth.recovery.update_password.success");
    window.setTimeout(() => {
      router.replace("/sign-in?reset=success");
    }, 1200);
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
              className="lf-input lf-reset-password-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => { setPassword(event.target.value); setPasswordTouched(true); }}
              onBlur={() => setPasswordTouched(true)}
              autoComplete="new-password"
              aria-invalid={passwordTouched && !passwordValid}
              aria-describedby="reset-password-requirement"
              disabled={!ready || saving}
            />
          </label>
          <p id="reset-password-requirement" className="lf-muted-note" role="status">
            {passwordValid ? "Password length met." : `At least ${MIN_PASSWORD_LENGTH - password.length} more character${MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} required.`}
          </p>
          <label className="lf-reset-password-visibility"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Show password</label>

          <label className="lf-label">
            <span>Confirm password</span>
            <input
              className="lf-input lf-reset-password-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setConfirmTouched(true); }}
              onBlur={() => setConfirmTouched(true)}
              autoComplete="new-password"
              aria-invalid={confirmTouched && !confirmationValid}
              aria-describedby="reset-password-match"
              disabled={!ready || saving}
            />
          </label>
          <p id="reset-password-match" className="lf-muted-note" role="status">{confirmTouched ? confirmationValid ? "Passwords match." : "Passwords do not match." : ""}</p>

          <button
            className="lf-primary-btn"
            type="button"
            onClick={() => void updatePassword()}
            disabled={!ready || saving || completed || !passwordValid || !confirmationValid}
          >
            {saving ? "Updating..." : "Update password"}
          </button>

          {status ? <div className="lf-muted-note">{status}</div> : null}

          <button
            className="lf-link-btn"
            type="button"
            onClick={() => router.push("/sign-in")}
            style={{ justifyContent: "center" }}
          >
            Go to sign in
          </button>

          <p className="lf-muted-note">
            Back to <Link className="lf-inline-link" href="/sign-in">Sign in</Link>
          </p>
          <p className="lf-muted-note">
            Need a new link? <Link className="lf-inline-link" href="/forgot-password">Request password reset</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
