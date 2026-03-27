"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { supabase } from "../../lib/supabaseClient";
import OAuthButtons from "./OAuthButtons";

export default function SignUpForm({
  nextPath = "/onboarding",
  compact = false,
}: {
  nextPath?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = useMemo(() => /\S+@\S+\.\S+/.test(email) && password.length >= 8 && !submitting, [email, password, submitting]);

  async function signUp() {
    setError("");
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setStatus("Creating account...");

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` : undefined;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setError(error.message);
        setStatus("");
        return;
      }

      if (data.user?.id && data.session) {
        const bootstrap = await bootstrapAuthenticatedUser(supabase, { userId: data.user.id, nextPath });
        router.replace(bootstrap.destination);
        return;
      }

      setStatus("Account created. Verify your email from the link sent, then sign in to continue onboarding.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create account.");
      setStatus("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: compact ? 10 : 12 }}>
      <label className="lf-label">
        <span>Email *</span>
        <input
          className="lf-input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(error && !/\S+@\S+\.\S+/.test(email))}
        />
      </label>

      <label className="lf-label">
        <span>Password *</span>
        <span style={{ position: "relative", display: "block" }}>
          <input
            className="lf-input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Create a strong password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={Boolean(error && password.length < 8)}
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={passwordToggleStyle}
          >
            <Icon name={showPassword ? "visibility_off" : "visibility"} size={18} />
          </button>
        </span>
      </label>

      {error ? <div className="lf-muted-note" role="alert">{error}</div> : null}

      <button className="lf-primary-btn" onClick={() => void signUp()} disabled={!canSubmit}>
        {submitting ? "Creating..." : "Create account"}
      </button>

      {!compact ? (
        <div className="lf-muted-note" style={{ marginTop: -2 }}>
          After sign-up you will be guided through a short setup so your dashboard starts with clear, meaningful progress.
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 12 }}>
        <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        or
        <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
      </div>

      <OAuthButtons nextPath={nextPath} />

      {status ? <div className="lf-muted-note">{status}</div> : null}
    </div>
  );
}

const passwordToggleStyle: CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "#475569",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
