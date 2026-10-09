"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Icon from "../ui/Icon";
import { toSafeInternalPath } from "../../lib/auth/session";

const OAuthButtons = dynamic(() => import("./OAuthButtons"), {
  loading: () => <div className="lf-muted-note">Loading sign-in providers...</div>,
});

export default function SignUpForm({
  nextPath,
  compact = false,
}: {
  nextPath?: string | null;
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
    let accountCreated = false;
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
      const [{ createEphemeralBrowserAuthClient }, { supabase }, { bootstrapAuthenticatedUser }, { findPendingInvitationDestination }] = await Promise.all([
        import("../../lib/auth/browserAuthClient"),
        import("../../lib/supabaseClient"),
        import("../../lib/auth/bootstrap"),
        import("../../lib/auth/pendingInvitations"),
      ]);
      const safeNextPath = toSafeInternalPath(nextPath, "/onboarding");
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath)}` : undefined;
      const authClient = createEphemeralBrowserAuthClient("signup");
      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setError(toSafeSignupError(error.message));
        setStatus("");
        return;
      }

      accountCreated = Boolean(data.user?.id);
      if (data.user?.id && data.session) {
        // The signup client deliberately does not persist sessions. Transfer
        // the returned session before bootstrap/acceptance recovery uses the
        // canonical browser client.
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw sessionError;
        const pendingDestination = await findPendingInvitationDestination(supabase, safeNextPath);
        const bootstrap = await bootstrapAuthenticatedUser(supabase, { userId: data.user.id, nextPath: safeNextPath });
        router.replace(pendingDestination ?? bootstrap.destination);
        return;
      }

      setStatus("Account created. Verify your email from the link sent, then sign in to continue onboarding.");
    } catch (submitError) {
      setError(accountCreated
        ? "Your account was created, but we could not continue to the invitation. Sign in with this email to continue."
        : toSafeSignupError(submitError instanceof Error ? submitError.message : ""));
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

      <OAuthButtons nextPath={nextPath || "/onboarding"} />

      {status ? <div className="lf-muted-note">{status}</div> : null}
    </div>
  );
}

function toSafeSignupError(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account with this email already exists. Sign in to continue.";
  }
  if (message.includes("password") || message.includes("weak")) {
    return "Choose a stronger password and try again.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "We could not create your account. Check your details and try again.";
}

const passwordToggleStyle: CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  width: 40,
  height: 40,
  border: "none",
  background: "transparent",
  color: "#475569",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
