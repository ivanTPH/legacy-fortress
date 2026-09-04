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
import { enrollPasskey, getPasskeyCapability, isPasskeyEnrollmentEnabled, supportsPasskeyBrowser } from "../../../../lib/auth/passkeys";

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
  const [passkeyBusy, setPasskeyBusy] = useState(false);

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
      setPasskeyStatus("Passkey added. Your device keeps its biometric or PIN verification; Legacy Fortress receives only the public credential needed for authentication.");
    } catch (error) {
      setPasskeyStatus(error instanceof Error ? error.message : "Passkey could not be added.");
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <SettingsPageShell
      title="Security"
      subtitle="Secure your account credentials and maintain verified contact channels for recovery."
    >
      <SettingsCard title="Mobile verification" description="OTP verification is required before using this number for secure notifications.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

        <Field label="Mobile number">
          <input value={mobile} onChange={(e) => setMobile(normalizePhone(e.target.value))} style={inputStyle} placeholder="+447700900123" />
        </Field>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={primaryBtn} onClick={() => void sendOtp()}>
            Send verification code
          </button>
          <div style={{ color: verified ? "#047857" : "#6b7280", fontSize: 13 }}>
            {verified ? "Verified" : "Not verified"}
          </div>
        </div>

        <Field label="OTP code">
          <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} style={inputStyle} placeholder="6-digit code" />
        </Field>

        <button type="button" style={ghostBtn} onClick={() => void verifyOtp()}>
          Verify mobile number
        </button>
        <StatusNote message={status} />
      </SettingsCard>

      <SettingsCard title="Password" description="Send a secure reset link to your verified sign-in email.">
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" style={primaryBtn} onClick={() => void sendPasswordReset()}>
            Send password reset email
          </button>

          <Field label="New password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              placeholder="At least 10 characters"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <button type="button" style={ghostBtn} onClick={() => void changePassword()}>
            Change password now
          </button>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Recovery options: verified email reset and verified mobile OTP workflows.
          </div>
        </div>
      </SettingsCard>

      {isPasskeyEnrollmentEnabled() ? (
        <SettingsCard title="Passkeys" description="Use a device passkey for a faster, phishing-resistant step-up. Passkeys are separate from government-ID verification.">
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            Use your device's passkey, such as Face ID, fingerprint, Windows Hello or a device PIN. Legacy Fortress does not receive or store your biometric template.
          </p>
          <button type="button" style={primaryBtn} onClick={() => void addPasskey()} disabled={passkeyBusy || !supportsPasskeyBrowser()}>
            {passkeyBusy ? "Adding passkey..." : "Add passkey"}
          </button>
          {!supportsPasskeyBrowser() ? <StatusNote message="This browser does not support passkeys." /> : null}
          <StatusNote message={passkeyStatus} />
          <div style={{ color: "#6b7280", fontSize: 13 }}>Current client capability: {getPasskeyCapability().passwordlessSignIn ? "passwordless sign-in" : "enrollment and future step-up only"}.</div>
        </SettingsCard>
      ) : null}
    </SettingsPageShell>
  );
}
