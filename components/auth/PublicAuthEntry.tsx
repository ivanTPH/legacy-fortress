"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "../../app/(app)/components/BrandMark";
import Icon from "../ui/Icon";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { waitForActiveUser } from "../../lib/auth/session";
import { supabase } from "../../lib/supabaseClient";

type AuthMode = "sign-in" | "sign-up";

export default function PublicAuthEntry({
  initialMode = "sign-in",
}: {
  initialMode?: AuthMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [resetSuccess, setResetSuccess] = useState(false);
  const nextPath = searchParams.get("next");

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "sign-in" || requestedMode === "sign-up") {
      setMode(requestedMode);
      return;
    }
    setMode(initialMode);
  }, [initialMode, searchParams]);

  useEffect(() => {
    let mounted = true;
    async function guard() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user ?? (await waitForActiveUser(supabase, { attempts: 3, delayMs: 120 }));
        if (!mounted || !sessionUser) return;
        const bootstrap = await bootstrapAuthenticatedUser(supabase, {
          userId: sessionUser.id,
          nextPath,
        });
        router.replace(bootstrap.destination);
      } catch {
        if (!mounted) return;
      }
    }
    void guard();
    return () => {
      mounted = false;
    };
  }, [nextPath, router]);

  return (
    <main className="lf-entry-shell">
      <section className="lf-entry-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={40} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Private estate record vault</div>
          </div>
        </div>

        <div className="lf-entry-copy">
          <div className="lf-entry-eyebrow">Clear records. Controlled access. Calm when it matters.</div>
          <h1>One secure place for the accounts, documents, and people your family may need later.</h1>
          <p>
            Legacy Fortress gives you a bank-style home for essential estate records, with role-aware access for executors, family, and advisers when the time comes.
          </p>
        </div>

        <div className="lf-entry-trust-grid">
          <article className="lf-entry-trust-card">
            <span className="lf-entry-trust-icon">
              <Icon name="shield_lock" size={18} />
            </span>
            <div>
              <strong>Security first</strong>
              <p>Encrypted storage, controlled visibility, and private-by-default access rules.</p>
            </div>
          </article>
          <article className="lf-entry-trust-card">
            <span className="lf-entry-trust-icon">
              <Icon name="account_balance" size={18} />
            </span>
            <div>
              <strong>Bank-style clarity</strong>
              <p>Finances, legal records, contacts, and next actions held in one dependable workspace.</p>
            </div>
          </article>
          <article className="lf-entry-trust-card">
            <span className="lf-entry-trust-icon">
              <Icon name="verified_user" size={18} />
            </span>
            <div>
              <strong>Trustworthy sharing</strong>
              <p>Invite the right people when needed, without turning your account into a public folder.</p>
            </div>
          </article>
        </div>

        <div className="lf-entry-graphic" aria-hidden>
          <div className="lf-entry-orbit lf-entry-orbit-a" />
          <div className="lf-entry-orbit lf-entry-orbit-b" />
          <div className="lf-entry-core-card">
            <div className="lf-entry-core-title">Account readiness</div>
            <div className="lf-entry-core-meter">
              <span style={{ width: "74%" }} />
            </div>
            <div className="lf-entry-core-stats">
              <div>
                <strong>12</strong>
                <span>protected records</span>
              </div>
              <div>
                <strong>4</strong>
                <span>trusted contacts</span>
              </div>
              <div>
                <strong>1</strong>
                <span>secure workspace</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lf-entry-panel-wrap">
        <div className="lf-entry-panel">
          <div className="lf-entry-panel-top">
            <div>
              <div className="lf-entry-panel-kicker">Secure access</div>
              <h2>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2>
            </div>
            <Link href="/demo" className="lf-entry-demo-link">Demo</Link>
          </div>

          <p className="lf-entry-panel-subtext">
            {mode === "sign-in"
              ? "Open your workspace without leaving this page."
              : "Start here and continue straight into your guided setup."}
          </p>

          <div className="lf-entry-tabs" role="tablist" aria-label="Authentication options">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "sign-in"}
              className={mode === "sign-in" ? "lf-entry-tab active" : "lf-entry-tab"}
              onClick={() => setMode("sign-in")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "sign-up"}
              className={mode === "sign-up" ? "lf-entry-tab active" : "lf-entry-tab"}
              onClick={() => setMode("sign-up")}
            >
              Create account
            </button>
          </div>

          <Suspense fallback={null}>
            <ResetStatusSync onResetSuccess={() => setResetSuccess(true)} />
          </Suspense>

          {mode === "sign-in" ? (
            <SignInForm
              nextPath={nextPath}
              compact
              initialStatus={resetSuccess ? "Password updated successfully. Please sign in with your new password." : ""}
            />
          ) : (
            <SignUpForm nextPath={nextPath || "/onboarding"} compact />
          )}

          <div className="lf-entry-footnote">
            <span><Icon name="lock" size={14} /> Private workspace</span>
            <span><Icon name="description" size={14} /> Guided setup after sign-up</span>
            <span><Icon name="support_agent" size={14} /> Existing routes stay supported</span>
          </div>
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
