"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import OAuthButtons from "./OAuthButtons";

export default function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signUp() {
    setSubmitting(true);
    setStatus("Creating account...");

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}` : undefined;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setStatus(`Sign up failed: ${error.message}`);
        return;
      }

      setStatus("Account created. Check your inbox to verify your email and continue onboarding.");
      router.push("/onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="lf-label">
        <span>Email</span>
        <input
          className="lf-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
        />
      </label>

      <label className="lf-label">
        <span>Password</span>
        <input
          className="lf-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a strong password"
          type="password"
          autoComplete="new-password"
        />
      </label>

      <button className="lf-primary-btn" onClick={() => void signUp()} disabled={!email || password.length < 8 || submitting}>
        {submitting ? "Creating..." : "Create account"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 12 }}>
        <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        or
        <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
      </div>

      <OAuthButtons nextPath="/onboarding" />

      {status ? <div className="lf-muted-note">{status}</div> : null}
    </div>
  );
}
