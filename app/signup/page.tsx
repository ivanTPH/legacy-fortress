"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "../(app)/components/BrandMark";
import SignUpForm from "../../components/auth/SignUpForm";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { waitForActiveUser } from "../../lib/auth/session";
import { supabase } from "../../lib/supabaseClient";

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function guard() {
      const user = await waitForActiveUser(supabase, { attempts: 3, delayMs: 120 });
      if (!mounted) return;
      if (!user) return;
      const bootstrap = await bootstrapAuthenticatedUser(supabase, { userId: user.id });
      router.replace(bootstrap.destination);
    }
    void guard();
    return () => {
      mounted = false;
    };
  }, [router]);

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
          <h2>Create your secure legacy workspace.</h2>
          <p>Sign up, verify your account, and complete onboarding in clear guided steps.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Create account</h1>
          <p className="lf-auth-subtext">Email, Apple, or Google. Terms are reviewed during onboarding.</p>
          <SignUpForm />
          <p className="lf-muted-note">
            Already have an account? <Link className="lf-inline-link" href="/signin">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
