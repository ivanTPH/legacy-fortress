"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import Icon from "../ui/Icon";
import OAuthButtons from "./OAuthButtons";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { waitForActiveUser } from "../../lib/auth/session";
import { supabase } from "../../lib/supabaseClient";

function toSignInErrorMessage(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return `Invalid email or password. If you just signed up, verify your email first and then sign in. (Supabase: ${raw})`;
  }
  if (message.includes("email not confirmed")) {
    return `Please verify your email before signing in. (Supabase: ${raw})`;
  }
  return `Authentication error: ${raw}`;
}

export default function SignInForm({
  nextPath,
  compact = false,
  initialStatus = "",
}: {
  nextPath?: string | null;
  compact?: boolean;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  async function signIn(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setStatus("");
    setSigningIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(`Sign in failed: ${toSignInErrorMessage(error.message)}`);
        return;
      }
      if (!data.session) {
        setStatus("Sign in failed: No active session returned.");
        return;
      }

      const confirmedUser = await waitForActiveUser(supabase, { attempts: 6, delayMs: 120 });
      if (!confirmedUser) {
        setStatus("Sign in failed: Session was not persisted in this browser.");
        return;
      }

      const bootstrap = await bootstrapAuthenticatedUser(supabase, {
        userId: confirmedUser.id,
        nextPath: nextPath ?? undefined,
      });
      router.replace(bootstrap.destination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Sign in failed: ${message}`);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: compact ? 10 : 12 }}>
      <form onSubmit={(event) => void signIn(event)} style={{ display: "grid", gap: compact ? 10 : 12 }}>
        <label className="lf-label">
          <span>Email *</span>
          <input
            className="lf-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        <label className="lf-label">
          <span>Password *</span>
          <span style={{ position: "relative", display: "block" }}>
            <input
              className="lf-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p className="lf-muted-note" style={{ margin: 0 }}>
            <Link className="lf-inline-link" href="/forgot-password">Forgot password?</Link>
          </p>
          <div className="lf-muted-note">Encrypted, role-aware, and private by default.</div>
        </div>

        <button className="lf-primary-btn" type="submit" disabled={!email || !password || signingIn}>
          <Icon name="login" size={16} />
          {signingIn ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 12 }}>
        <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        or
        <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
      </div>

      <OAuthButtons nextPath={nextPath || "/dashboard"} />

      {status ? <div className="lf-muted-note" role="alert">{status}</div> : null}

      {!compact ? (
        <div className="lf-muted-note" style={{ display: "grid", gap: 4 }}>
          <div>Your records stay in your private workspace until you choose to share them.</div>
          <div>Use the same sign-in to review profile details, legal documents, finances, trusted contact access, and overall readiness.</div>
        </div>
      ) : null}
    </div>
  );
}

const passwordToggleStyle = {
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
} satisfies CSSProperties;
