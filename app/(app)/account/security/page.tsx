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
import { supabase } from "../../../../lib/supabaseClient";
import { normalizePhone } from "../../../../lib/validation/profile";

export default function SecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setStatus(`⚠️ ${authError.message}`);
        setLoading(false);
        return;
      }

      const user = userData.user;
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

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const { error } = await supabase.from("contact_details").upsert(
      {
        user_id: userData.user.id,
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
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user?.email) {
      setStatus("❌ Could not load signed-in email.");
      return;
    }

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(userData.user.email, { redirectTo });
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
    </SettingsPageShell>
  );
}
