"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "../../app/(app)/components/BrandMark";
import WorkspaceSwitcher from "../navigation/WorkspaceSwitcher";
import Icon from "../ui/Icon";
import SignInForm from "./SignInForm";

type AuthMode = "sign-in" | "sign-up";

const SignUpForm = dynamic(() => import("./SignUpForm"), {
  loading: () => <div className="lf-muted-note">Loading account setup...</div>,
});

export default function PublicAuthEntry({
  initialMode = "sign-in",
}: {
  initialMode?: AuthMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [resetSuccess, setResetSuccess] = useState(false);
  // Signed in already, or been here before on a remembered device (owner decision 9 Nov 2026).
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [returning, setReturning] = useState<{ firstName: string | null; email: string } | null>(null);
  const nextPath = searchParams.get("next");
  const invitedEmail = searchParams.get("email");
  const requestedMode = searchParams.get("mode");
  const activeMode = useMemo<AuthMode>(
    () => requestedMode === "sign-in" || requestedMode === "sign-up" ? requestedMode : mode,
    [mode, requestedMode],
  );

  useEffect(() => {
    let mounted = true;
    async function guard() {
      try {
        const [
          { supabase },
          { waitForActiveUser },
          { bootstrapAuthenticatedUser },
          { findPendingInvitationDestination },
          { getMasterAdminRolesForEmail, mergePlatformRoles },
          { extractPlatformRolesFromMetadata },
          { resolvePermissionedAdminDestination },
        ] = await Promise.all([
          import("../../lib/supabaseClient"),
          import("../../lib/auth/session"),
          import("../../lib/auth/bootstrap"),
          import("../../lib/auth/pendingInvitations"),
          import("../../lib/auth/adminRoles"),
          import("../../lib/auth/platformRoles"),
          import("../../lib/auth/adminDestination"),
        ]);
        const { readReturningVisitor } = await import("../../lib/auth/deviceTrustClient");
        if (mounted) setReturning(readReturningVisitor());
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user ?? (await waitForActiveUser(supabase, { attempts: 3, delayMs: 120 }));
        if (!mounted || !sessionUser) return;
        // An existing personal session should not make /sign-in silently jump
        // to the dashboard. Only an actionable invitation needs an automatic
        // recovery redirect; otherwise leave the auth choice visible.
        if (!nextPath) {
          const pendingDestination = await findPendingInvitationDestination(supabase);
          if (pendingDestination) { router.replace(pendingDestination); return; }
          const { getUserDisplayName } = await import("../../lib/auth/user");
          if (mounted) setSignedInAs(getUserDisplayName(sessionUser));
          return;
        }
        const roles = mergePlatformRoles(
          extractPlatformRolesFromMetadata(sessionUser.app_metadata),
          extractPlatformRolesFromMetadata(sessionUser.user_metadata),
          getMasterAdminRolesForEmail(sessionUser.email),
        );
        const bootstrap = await bootstrapAuthenticatedUser(supabase, {
          userId: sessionUser.id,
          nextPath,
          roles,
        });
        const destination = await resolvePermissionedAdminDestination(supabase, {
          nextPath,
          fallbackDestination: bootstrap.destination,
          roles,
        });
        router.replace(destination);
      } catch {
        if (!mounted) return;
      }
    }
    void guard();
    return () => {
      mounted = false;
    };
  }, [nextPath, router]);

  async function signOutHere() {
    const { supabase } = await import("../../lib/supabaseClient");
    await supabase.auth.signOut();
    setSignedInAs(null);
  }

  async function forgetReturning() {
    const { clearReturningVisitor } = await import("../../lib/auth/deviceTrustClient");
    clearReturningVisitor();
    setReturning(null);
  }

  return (
    <main className="lf-entry-shell lf-trust-entry">
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
              <h2>{signedInAs ? "You’re signed in" : activeMode === "sign-in" ? (returning ? `Welcome back${returning.firstName ? `, ${returning.firstName}` : ""}` : "Sign in") : "Create account"}</h2>
            </div>
            <Link href="/demo" className="lf-entry-demo-link">Demo</Link>
          </div>

          <p className="lf-entry-panel-subtext">
            {signedInAs
              ? `You’re signed in on this device as ${signedInAs}.`
              : activeMode === "sign-in"
              ? (returning ? "Sign in to your Vault." : "Welcome back. Sign in to your Vault.")
              : "It takes a minute. We'll then help you set up your Vault, step by step."}
          </p>

          {signedInAs ? (
            <div style={{ display: "grid", gap: 12 }}>
              <Link className="lf-primary-btn" href="/dashboard" style={{ textAlign: "center", justifyContent: "center" }}>
                <Icon name="lock_open" size={16} /> Continue to my Vault
              </Link>
              <p className="lf-muted-note" style={{ margin: 0, textAlign: "center" }}>
                Not you?{" "}
                <button type="button" className="lf-inline-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontWeight: 700 }} onClick={() => void signOutHere()}>Sign out</button>
              </p>
            </div>
          ) : null}

          {signedInAs ? null : <>
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

          {activeMode === "sign-in" && returning && !invitedEmail ? (
            <p className="lf-muted-note" style={{ margin: 0 }}>
              Not {returning.firstName ?? returning.email}?{" "}
              <button type="button" className="lf-inline-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontWeight: 700 }} onClick={() => void forgetReturning()}>Use a different account</button>
            </p>
          ) : null}

          {activeMode === "sign-in" ? (
            <SignInForm
              key={returning?.email ?? "blank"}
              nextPath={nextPath}
              initialEmail={invitedEmail || returning?.email || ""}
              compact
              initialStatus={resetSuccess ? "Password updated successfully. Please sign in with your new password." : ""}
            />
          ) : (
            <SignUpForm nextPath={nextPath} expectedEmail={invitedEmail} compact />
          )}

          {/* New visitors need an obvious way in (owner feedback 9 Nov 2026). */}
          <p className="lf-entry-switch" style={{ margin: "4px 0 0", textAlign: "center", fontSize: 15 }}>
            {activeMode === "sign-in" ? (
              <>New to Legacy Fortress? <Link className="lf-inline-link" href={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"} style={{ fontWeight: 700 }}>Create an account</Link></>
            ) : (
              <>Already have an account? <Link className="lf-inline-link" href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"} style={{ fontWeight: 700 }}>Sign in</Link></>
            )}
          </p>

          </>}

          <div className="lf-entry-footnote">
            <span><Icon name="lock" size={14} /> Private workspace</span>
            <span><Icon name="description" size={14} /> Guided setup after sign-up</span>
            <span><Icon name="visibility_lock" size={14} /> Your family sees only what you choose</span>
          </div>

          <WorkspaceSwitcher
            currentPathname="/sign-in"
            compact
            showDetails
            governanceContext="/sign-in unified login entry"
          />
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
