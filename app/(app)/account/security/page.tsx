"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Field,
  SettingsCard,
  SettingsPageShell,
  StatusNote,
  ghostBtn,
  inputStyle,
  primaryBtn,
} from "../../components/settings/SettingsPrimitives";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { getBrowserAuthRedirect } from "../../../../lib/auth/redirects";
import { supabase } from "../../../../lib/supabaseClient";
import { normalizePhone } from "../../../../lib/validation/profile";
import { enrollPasskey, isPasskeyEnrollmentEnabled, supportsPasskeyBrowser } from "../../../../lib/auth/passkeys";
import { forgetRememberedDevices } from "../../../../lib/auth/deviceTrustClient";
import Icon from "../../../../components/ui/Icon";
import TwoStepPanel, { loadTwoStepState, type TwoStepState } from "../../../../components/auth/TwoStepPanel";

function describeDevice() {
  if (typeof navigator === "undefined") return { name: "This browser", mobile: false };
  const agent = navigator.userAgent;
  const device = /iPhone/.test(agent) ? "iPhone" : /iPad/.test(agent) ? "iPad" : /Android/.test(agent) ? "Android phone" : /Macintosh/.test(agent) ? "Mac" : /Windows/.test(agent) ? "Windows PC" : "Computer";
  const browser = /Edg\//.test(agent) ? "Edge" : /CriOS|Chrome\//.test(agent) ? "Chrome" : /FxiOS|Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  return { name: `${device} · ${browser}`, mobile: /iPhone|Android/.test(agent) };
}

export default function SecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passkeyStatus, setPasskeyStatus] = useState("");
  const [rememberedStatus, setRememberedStatus] = useState("");
  const [devicesBusy, setDevicesBusy] = useState(false);
  const forgetDevices = async () => {
    setDevicesBusy(true);
    const ok = await forgetRememberedDevices();
    setRememberedStatus(ok ? "Done. Each phone or computer will ask for an emailed code next time." : "That didn’t work. Please try again.");
    setDevicesBusy(false);
  };
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [open, setOpen] = useState<"password" | "two-step" | "mobile" | null>(null);
  // "Turn on two-step" from the Protect your access card opens set-up straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("setup") === "two-step") setOpen("two-step");
  }, []);
  const [twoStep, setTwoStep] = useState<TwoStepState>({ factorId: null, loading: true });
  const [devicesStatus, setDevicesStatus] = useState("");
  const [deviceLabel] = useState(describeDevice);
  const reloadTwoStep = async () => setTwoStep(await loadTwoStepState());
  useEffect(() => { void loadTwoStepState().then(setTwoStep); }, []);

  const signOutOthers = async () => {
    setDevicesStatus("");
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setDevicesStatus(error ? `Couldn’t sign out other devices: ${error.message}` : "Signed out everywhere except this device.");
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      const { data, error } = await supabase
        .from("contact_details")
        .select("mobile_number,mobile_verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!error && data) {
        setMobile((data as { mobile_number?: string | null }).mobile_number ?? "");
        setVerified(Boolean((data as { mobile_verified?: boolean | null }).mobile_verified));
      }

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const sendOtp = async () => {
    setStatus("");
    const value = normalizePhone(mobile);
    if (!value) {
      setStatus("❌ Enter a mobile number first.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: value,
      options: { shouldCreateUser: false },
    });

    if (error) {
      setStatus(`❌ Could not send OTP: ${error.message}`);
      return;
    }

    setStatus("✅ Verification code sent.");
  };

  const verifyOtp = async () => {
    setStatus("");
    const value = normalizePhone(mobile);
    if (!value || !otp.trim()) {
      setStatus("❌ Enter your mobile number and OTP code.");
      return;
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: value,
      token: otp.trim(),
      type: "sms",
    });

    if (verifyError) {
      setStatus(`❌ Verification failed: ${verifyError.message}`);
      return;
    }

    const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
    if (!user) {
      router.replace("/signin");
      return;
    }

    const { error } = await supabase.from("contact_details").upsert(
      {
        user_id: user.id,
        mobile_number: value,
        mobile_verified: true,
        mobile_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      setStatus(`❌ Verified but could not persist status: ${error.message}`);
      return;
    }

    setVerified(true);
    setOtp("");
    setStatus("✅ Mobile number verified.");
  };

  const sendPasswordReset = async () => {
    const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
    if (!user?.email) {
      setStatus("❌ Could not load signed-in email.");
      return;
    }

    const redirectTo = getBrowserAuthRedirect("/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
    setStatus(error ? `❌ Password reset failed: ${error.message}` : "✅ Password reset email sent.");
  };

  const changePassword = async () => {
    if (newPassword.length < 10) {
      setStatus("❌ New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("❌ Password confirmation does not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setStatus(`❌ Password change failed: ${error.message}`);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setStatus("✅ Password changed.");
  };

  const addPasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyStatus("");
    try {
      const result = await enrollPasskey(supabase, "This device");
      if (result.error) throw result.error;
      setPasskeyStatus("Added. Your face or fingerprint never leaves your device.");
    } catch (error) {
      setPasskeyStatus(error instanceof Error ? error.message : "Passkey could not be added.");
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <SettingsPageShell title="Security" subtitle="How you sign in, and where you’re signed in." compact>
      {/* V5.2 Settings › Security (p5m): grouped rows; details open in place. */}
      <section className="lf-sec-group" aria-labelledby="sec-sign-in">
        <h2 id="sec-sign-in">Sign-in</h2>
        <div className="lf-sec-card">
          {isPasskeyEnrollmentEnabled() && supportsPasskeyBrowser() ? <div className="lf-sec-row">
            <span className="lf-sec-icon"><Icon name="face" size={22} /></span>
            <span className="lf-sec-text"><strong>Face ID or fingerprint</strong><small>{passkeyStatus || "Use your device to confirm it’s you"}</small></span>
            <button type="button" className="lf-sec-action" onClick={() => void addPasskey()} disabled={passkeyBusy}>{passkeyBusy ? "Adding…" : "Add"}</button>
          </div> : null}
          <button type="button" className="lf-sec-row" aria-expanded={open === "password"} onClick={() => setOpen(open === "password" ? null : "password")}>
            <span className="lf-sec-icon"><Icon name="password" size={22} /></span>
            <span className="lf-sec-text"><strong>Password</strong><small>Change it, or get a reset link by email</small></span>
            <Icon name={open === "password" ? "expand_less" : "chevron_right"} size={22} />
          </button>
          {open === "password" ? <div className="lf-sec-panel">
            <Field label="New password"><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} placeholder="At least 10 characters" /></Field>
            <Field label="Confirm new password"><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} /></Field>
            <div className="lf-sec-buttons"><button type="button" style={primaryBtn} onClick={() => void changePassword()}>Change password</button><button type="button" style={ghostBtn} onClick={() => void sendPasswordReset()}>Email me a reset link</button></div>
          </div> : null}
          <div className="lf-sec-row">
            <span className="lf-sec-icon"><Icon name="phonelink_lock" size={22} /></span>
            <span className="lf-sec-text"><strong id="sec-two-step-label">Two-step verification</strong><small>{twoStep.loading ? "Checking…" : twoStep.factorId ? "On · authenticator app" : "Off"}</small></span>
            {/* A switch like the design's Face ID row: turning it on starts set-up, turning it off asks to confirm. */}
            <button type="button" role="switch" className="lf-sec-switch" aria-checked={Boolean(twoStep.factorId)} aria-labelledby="sec-two-step-label" disabled={twoStep.loading} onClick={() => setOpen(open === "two-step" ? null : "two-step")}><span aria-hidden="true" /></button>
          </div>
          <div className="lf-sec-row">
            <span className="lf-sec-icon"><Icon name="devices" size={22} /></span>
            <span className="lf-sec-text"><strong>Remembered devices</strong><small>{rememberedStatus || "Phones and computers that don’t ask for an emailed code"}</small></span>
            <button type="button" className="lf-sec-action" disabled={devicesBusy} onClick={() => void forgetDevices()}>{devicesBusy ? "Forgetting…" : "Forget all"}</button>
          </div>
          {open === "two-step" ? <div className="lf-sec-panel"><TwoStepPanel state={twoStep} autoStart onChanged={async () => { await reloadTwoStep(); setOpen(null); }} onCancel={() => setOpen(null)} /></div> : null}
        </div>
      </section>

      <section className="lf-sec-group" aria-labelledby="sec-devices">
        <h2 id="sec-devices">Signed-in devices</h2>
        <div className="lf-sec-card">
          <div className="lf-sec-row">
            <span className="lf-sec-icon"><Icon name={deviceLabel.mobile ? "smartphone" : "laptop_mac"} size={22} /></span>
            <span className="lf-sec-text"><strong>{deviceLabel.name}</strong><small>This device</small></span>
          </div>
        </div>
        <button type="button" className="lf-sec-danger" onClick={() => void signOutOthers()}>Sign out of all other devices</button>
        {devicesStatus ? <p className="lf-sec-status" role="status">{devicesStatus}</p> : null}
      </section>

      <section className="lf-sec-group" aria-labelledby="sec-recovery">
        <h2 id="sec-recovery">Recovery</h2>
        <div className="lf-sec-card">
          <button type="button" className="lf-sec-row" aria-expanded={open === "mobile"} onClick={() => setOpen(open === "mobile" ? null : "mobile")}>
            <span className="lf-sec-icon"><Icon name="sms" size={22} /></span>
            <span className="lf-sec-text"><strong>Mobile number</strong><small>{loading ? "Loading…" : mobile ? `${mobile} · ${verified ? "Verified" : "Not verified"}` : "Not added"}</small></span>
            <Icon name={open === "mobile" ? "expand_less" : "chevron_right"} size={22} />
          </button>
          {open === "mobile" ? <div className="lf-sec-panel">
            <Field label="Mobile number"><input value={mobile} onChange={(e) => setMobile(normalizePhone(e.target.value))} style={inputStyle} placeholder="+447700900123" /></Field>
            <button type="button" style={ghostBtn} onClick={() => void sendOtp()}>Send verification code</button>
            <Field label="Code"><input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} style={inputStyle} placeholder="6-digit code" /></Field>
            <button type="button" style={primaryBtn} onClick={() => void verifyOtp()}>Verify mobile number</button>
          </div> : null}
        </div>
      </section>
      <StatusNote message={status} />
    </SettingsPageShell>
  );
}
