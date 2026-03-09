"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "../(app)/components/BrandMark";
import OAuthButtons from "../../components/auth/OAuthButtons";
import { waitForActiveUser } from "../../lib/auth/session";
import { supabase } from "../../lib/supabaseClient";

function toSignInErrorMessage(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return "Invalid email or password. If you just signed up, verify your email first and then sign in.";
  }
  if (message.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }
  return raw;
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function guard() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!sessionData.session?.user) return;
        router.replace("/app/dashboard");
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Sign in check failed: ${message}`);
      }
    }
    void guard();
    return () => {
      mounted = false;
    };
  }, [router]);

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

      const persistenceLocation = typeof window !== "undefined" && window.localStorage ? "localStorage" : "memory";
      console.info("[auth][signin] session established", {
        userId: confirmedUser.id,
        persistenceLocation,
      });

      router.replace("/app/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Sign in failed: ${message}`);
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
          <Suspense fallback={null}>
            <ResetStatusSync
              onResetSuccess={() => setStatus("Password updated successfully. Please sign in with your new password.")}
            />
          </Suspense>

          <h1>Sign in</h1>
          <p className="lf-auth-subtext">Use email/password or continue with a trusted provider.</p>

          <form
            onSubmit={(event) => {
              void signIn(event);
            }}
            style={{ display: "grid", gap: 12 }}
          >
            <label className="lf-label">
              <span>Email</span>
              <input className="lf-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            </label>

            <label className="lf-label">
              <span>Password</span>
              <input className="lf-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
            </label>

            <p className="lf-muted-note" style={{ marginTop: -4 }}>
              <Link className="lf-inline-link" href="/forgot-password">Forgot password?</Link>
            </p>

            <button className="lf-primary-btn" type="submit" disabled={!email || !password || signingIn}>
              {signingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            or
            <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          <OAuthButtons nextPath="/app/dashboard" />

          {status ? <div className="lf-muted-note" role="alert">{status}</div> : null}

          <p className="lf-muted-note">
            New to Legacy Fortress? <Link className="lf-inline-link" href="/sign-up">Create account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function ResetStatusSync({
  onResetSuccess,
}: {
  onResetSuccess: () => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("reset") === "success") onResetSuccess();
  }, [onResetSuccess, searchParams]);

  return null;
}
