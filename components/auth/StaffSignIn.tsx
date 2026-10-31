"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "../../app/(app)/components/BrandMark";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";

/**
 * Separate sign-in for Platform Admin and the Partner portal (ADMIN_PARTNER.md › Sign-in; AGENTS 16).
 * Email and password, then a 6-digit code from an authenticator app. Two-step verification is
 * always required here; first-time users set it up by scanning a QR code.
 */
type Portal = "admin" | "partner";
type Step = "password" | "enrol" | "code";

const COPY: Record<Portal, { title: string; badge: string; home: string; footer: string }> = {
  admin: { title: "Sign in to Platform Admin", badge: "ADMIN", home: "/admin", footer: "Not Legacy Fortress staff?" },
  partner: { title: "Sign in to the partner portal", badge: "PARTNER", home: "/enterprise", footer: "Looking for your own Vault?" },
};

export function safeNext(value: string | null, portal: Portal) {
  const prefix = portal === "admin" ? "/admin" : "/enterprise";
  return value && value.startsWith(prefix) && !value.startsWith("//") && !value.includes("/sign-in") ? value : prefix;
}

export default function StaffSignIn({ portal }: { portal: Portal }) {
  const router = useRouter();
  const params = useSearchParams();
  const copy = COPY[portal];
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"), portal);

  async function afterPassword() {
    const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level.data?.currentLevel === "aal2") { finish(); return; }
    const factors = await supabase.auth.mfa.listFactors();
    const totp = factors.data?.totp?.find((factor) => factor.status === "verified");
    if (totp) { setFactorId(totp.id); setStep("code"); return; }
    // First time: set up an authenticator app. Remove any half-finished set-ups first.
    for (const factor of factors.data?.all ?? []) {
      if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const enrol = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Legacy Fortress ${portal === "admin" ? "Admin" : "Partner"}` });
    if (enrol.error || !enrol.data) { setError("Two-step verification isn’t available right now. Contact your Legacy Fortress administrator."); return; }
    setFactorId(enrol.data.id);
    setQr(enrol.data.totp.qr_code);
    setSecret(enrol.data.totp.secret);
    setStep("enrol");
  }

  function finish() {
    try { window.sessionStorage.setItem(`lf:${portal}:last-activity`, String(Date.now())); } catch { /* optional */ }
    router.replace(next);
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError("That email and password don’t match an account."); return; }
      await afterPassword();
    } finally { setBusy(false); }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, "") });
      if (result.error) { setError("That code isn’t right. Codes change every 30 seconds; try the current one."); return; }
      finish();
    } finally { setBusy(false); }
  }

  useEffect(() => {
    // Already signed in with a password? Go straight to the code.
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !active) return;
      await afterPassword();
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <main className={`lf-staff-signin is-${portal}`}>
    <section className="lf-staff-signin-card">
      <div className="lf-staff-signin-brand">
        <span className="lf-staff-signin-logo"><BrandMark size={32} /></span>
        <strong>Legacy Fortress</strong>
        <span className={`lf-staff-badge is-${portal}`}>{copy.badge}</span>
      </div>
      <h1>{copy.title}</h1>

      {step === "password" ? <form onSubmit={(event) => void submitPassword(event)}>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error ? <p className="lf-staff-error" role="alert">{error}</p> : null}
        <button type="submit" className="lf-staff-primary" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
      </form> : null}

      {step === "enrol" ? <form onSubmit={(event) => void submitCode(event)}>
        <p>Two-step verification is required. Scan this QR code with an authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password), then enter the 6-digit code it shows.</p>
        {qr ? <img className="lf-staff-qr" src={qr} alt="QR code to set up your authenticator app" /> : null}
        <details><summary>Can’t scan it?</summary><p>Enter this key in your app instead: <code>{secret}</code></p></details>
        <label>6-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
        {error ? <p className="lf-staff-error" role="alert">{error}</p> : null}
        <button type="submit" className="lf-staff-primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Turn on and continue"}</button>
      </form> : null}

      {step === "code" ? <form onSubmit={(event) => void submitCode(event)}>
        <p>Enter the 6-digit code from your authenticator app.</p>
        <label>6-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
        {error ? <p className="lf-staff-error" role="alert">{error}</p> : null}
        <button type="submit" className="lf-staff-primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
        <button type="button" className="lf-staff-link" onClick={() => void supabase.auth.signOut().then(() => { setStep("password"); setCode(""); })}>Use a different account</button>
      </form> : null}

      <p className="lf-staff-footer"><Icon name="lock" size={16} />{copy.footer} <Link href="/sign-in">Go to the main sign-in</Link></p>
    </section>
  </main>;
}
