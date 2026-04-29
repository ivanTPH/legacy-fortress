"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  const requestedMode = searchParams.get("mode");
  const activeMode = useMemo<AuthMode>(
    () => requestedMode === "sign-in" || requestedMode === "sign-up" ? requestedMode : mode,
    [mode, requestedMode],
  );

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
          <div className="lf-entry-eyebrow">Private access</div>
          <h1>Your secure legacy vault.</h1>
          <p>
            Sign in to manage the records, documents, and trusted people your family may need later.
          </p>
        </div>

        <div className="lf-entry-brand-note" aria-hidden>
          <BrandMark size={40} />
          <strong>Legacy Fortress</strong>
          <p>Clear records, controlled access, and calm guidance for sensitive estate planning.</p>
        </div>
      </section>

      <section className="lf-entry-panel-wrap">
        <div className="lf-entry-panel">
          <div className="lf-entry-panel-top">
            <div>
              <div className="lf-entry-panel-kicker">Secure access</div>
              <h2>{activeMode === "sign-in" ? "Welcome back" : "Create your account"}</h2>
            </div>
            <Link href="/demo" className="lf-entry-demo-link">Demo</Link>
          </div>

          <p className="lf-entry-panel-subtext">
            {activeMode === "sign-in"
              ? "Open your workspace without leaving this page."
              : "Start here and continue straight into your guided setup."}
          </p>

          <div className="lf-entry-tabs" role="tablist" aria-label="Authentication options">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "sign-in"}
              className={activeMode === "sign-in" ? "lf-entry-tab active" : "lf-entry-tab"}
              onClick={() => setMode("sign-in")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "sign-up"}
              className={activeMode === "sign-up" ? "lf-entry-tab active" : "lf-entry-tab"}
              onClick={() => setMode("sign-up")}
            >
              Create account
            </button>
          </div>

          <Suspense fallback={null}>
            <ResetStatusSync onResetSuccess={() => setResetSuccess(true)} />
          </Suspense>

          {activeMode === "sign-in" ? (
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
