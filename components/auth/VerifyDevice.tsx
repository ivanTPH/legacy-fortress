"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "../../app/(app)/components/BrandMark";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";
import { rememberThisDevice } from "../../lib/auth/deviceTrustClient";

/**
 * "We've sent a code to your email" (owner decision 4 Nov 2026). Shown after the password on a phone or
 * computer we haven't seen before. Uses the sign-in service's own email code. Plain, large and step by step.
 */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, name.length - 1)))}@${domain}`;
}

export default function VerifyDevice() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/verify-device") ? rawNext : "/dashboard";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const sent = useRef(false);

  async function send(address: string) {
    setError("");
    const result = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (result.error) {
      setError(/rate|seconds|too many/i.test(result.error.message) ? "Please wait a minute before asking for another code." : "We couldn’t send a code just now. Try again in a moment.");
      return;
    }
    setMessage(`We’ve sent a 6-digit code to ${maskEmail(address)}.`);
    setCooldown(60);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!active) return;
      if (!session?.user.email) { router.replace(`/sign-in?next=${encodeURIComponent(next)}`); return; }
      setEmail(session.user.email);
      if (!sent.current) { sent.current = true; await send(session.user.email); }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await supabase.auth.verifyOtp({ email, token: code.replace(/\D/g, ""), type: "email" });
    if (result.error || !result.data.session) {
      setBusy(false);
      setError("That code isn’t right, or it has expired. Check the latest email, or ask for a new code.");
      return;
    }
    if (remember) await rememberThisDevice();
    router.replace(next);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <main className="lf-verify-device">
      <div className="lf-verify-card">
        <div className="lf-verify-brand"><BrandMark size={36} /><strong>Legacy Fortress</strong></div>
        <span className="lf-verify-icon" aria-hidden="true"><Icon name="mark_email_read" size={28} /></span>
        <h1>Check your email</h1>
        <p className="lf-verify-lead">This is a new phone or computer, so we need to check it’s you.</p>
        <p role="status" className="lf-verify-sent">{message || "Sending your code…"}</p>
        <form onSubmit={(event) => void confirm(event)}>
          <label className="lf-label">
            <span>6-digit code</span>
            <input className="lf-input lf-verify-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus
              value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} aria-describedby="lf-verify-help" />
          </label>
          <label className="lf-verify-remember">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span><strong>Remember this device</strong><small>We won’t ask again on this phone or computer. Don’t tick this on a shared or public computer.</small></span>
          </label>
          {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
          <button type="submit" className="lf-primary-btn" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Continue"}</button>
        </form>
        <p id="lf-verify-help" className="lf-verify-help">Can’t find it? Check your junk or spam folder. The email comes from Legacy Fortress.</p>
        <div className="lf-verify-actions">
          <button type="button" className="lf-link-button" disabled={cooldown > 0 || !email} onClick={() => void send(email)}>{cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}</button>
          <button type="button" className="lf-link-button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    </main>
  );
}
