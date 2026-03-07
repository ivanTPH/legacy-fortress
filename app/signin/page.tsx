"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "../(app)/components/BrandMark";
import OAuthButtons from "../../components/auth/OAuthButtons";
import { getOrCreateOnboardingState } from "../../lib/onboarding";
import { supabase } from "../../lib/supabaseClient";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function guard() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data.user) router.replace("/dashboard");
    }
    void guard();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function signIn() {
    setSigningIn(true);
    setStatus("Signing in...");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(`Sign in failed: ${error.message}`);
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setStatus("Signed in but user session could not be loaded.");
        return;
      }

      const onboarding = await getOrCreateOnboardingState(supabase, data.user.id);
      router.replace(onboarding.is_completed ? "/dashboard" : "/onboarding");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Estate Vault Platform</div>
          </div>
        </div>

        <div className="lf-auth-art-copy">
          <h2>Access your secure estate workspace.</h2>
          <p>Sign in to manage records, permissions, and trusted contact access.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Sign in</h1>
          <p className="lf-auth-subtext">Use email/password or continue with a trusted provider.</p>

          <label className="lf-label">
            <span>Email</span>
            <input className="lf-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </label>

          <label className="lf-label">
            <span>Password</span>
            <input className="lf-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </label>

          <p className="lf-muted-note" style={{ marginTop: -4 }}>
            <Link className="lf-inline-link" href="/forgot-password">Forgot password?</Link>
          </p>

          <button className="lf-primary-btn" onClick={() => void signIn()} disabled={!email || !password || signingIn}>
            {signingIn ? "Signing in..." : "Sign in"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            or
            <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          <OAuthButtons nextPath="/dashboard" />

          {status ? <div className="lf-muted-note">{status}</div> : null}

          <p className="lf-muted-note">
            New to Legacy Fortress? <Link className="lf-inline-link" href="/signup">Create account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
