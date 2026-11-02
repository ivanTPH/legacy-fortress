"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/**
 * Settings › Security: turn two-step verification on with an authenticator app, or off.
 * Once on, the main sign-in asks for the 6-digit code after the password.
 */
export type TwoStepState = { factorId: string | null; loading: boolean };

export async function loadTwoStepState(): Promise<TwoStepState> {
  const factors = await supabase.auth.mfa.listFactors();
  const verified = factors.data?.totp?.find((factor) => factor.status === "verified");
  return { factorId: verified?.id ?? null, loading: false };
}

export default function TwoStepPanel({ state, onChanged, onCancel, autoStart = false }: { state: TwoStepState; onChanged: () => Promise<void>; onCancel?: () => void; autoStart?: boolean }) {
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || state.loading || state.factorId || started.current) return;
    started.current = true;
    queueMicrotask(() => { void begin(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, state.loading, state.factorId]);

  async function begin() {
    setBusy(true); setMessage("");
    try {
      const factors = await supabase.auth.mfa.listFactors();
      for (const factor of factors.data?.all ?? []) if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      const enrol = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Legacy Fortress" });
      if (enrol.error || !enrol.data) { setMessage("Two-step verification isn’t available right now."); return; }
      setSetup({ factorId: enrol.data.id, qr: enrol.data.totp.qr_code, secret: enrol.data.totp.secret });
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!setup) return;
    setBusy(true); setMessage("");
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code });
      if (result.error) { setMessage("That code isn’t right. Codes change every 30 seconds; try the current one."); return; }
      setSetup(null); setCode("");
      await onChanged();
    } finally { setBusy(false); }
  }

  async function turnOff() {
    if (!state.factorId) return;
    setBusy(true); setMessage("");
    try {
      const result = await supabase.auth.mfa.unenroll({ factorId: state.factorId });
      if (result.error) { setMessage("To turn it off, sign out and sign in again with your code first."); return; }
      await onChanged();
    } finally { setBusy(false); }
  }

  if (state.loading) return <p className="lf-sec-status">Loading…</p>;
  if (state.factorId) return <div className="lf-sec-stack">
    <p><strong>Turn off two-step verification?</strong> You’ll sign in with just your password.</p>
    <div className="lf-sec-buttons"><button type="button" className="lf-sec-danger" disabled={busy} onClick={() => void turnOff()}>{busy ? "Turning off…" : "Turn off"}</button>{onCancel ? <button type="button" className="lf-sec-action" onClick={onCancel}>Keep it on</button> : null}</div>
    {message ? <p className="lf-sec-status" role="status">{message}</p> : null}
  </div>;
  if (!setup) return <div className="lf-sec-stack">
    <p>Add a second step when you sign in: a 6-digit code from an app such as Google Authenticator, Microsoft Authenticator or 1Password.</p>
    <button type="button" className="lf-primary-btn" disabled={busy} onClick={() => void begin()}>{busy ? "Starting…" : "Turn on"}</button>
    {message ? <p className="lf-sec-status" role="status">{message}</p> : null}
  </div>;
  return <div className="lf-sec-stack">
    <p><strong>On a computer:</strong> scan this with your phone’s authenticator app.</p>
    <img className="lf-sec-qr" src={setup.qr} alt="QR code to set up your authenticator app" />
    <p><strong>On this phone:</strong> copy this key into your authenticator app (“Enter a setup key”).</p>
    <code className="lf-sec-secret">{setup.secret}</code>
    <label className="lf-sec-field">6-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
    <div className="lf-sec-buttons"><button type="button" className="lf-primary-btn" disabled={busy || code.length !== 6} onClick={() => void confirm()}>{busy ? "Checking…" : "Turn on"}</button>{onCancel ? <button type="button" className="lf-sec-action" onClick={onCancel}>Cancel</button> : null}</div>
    {message ? <p className="lf-sec-status" role="alert">{message}</p> : null}
  </div>;
}
