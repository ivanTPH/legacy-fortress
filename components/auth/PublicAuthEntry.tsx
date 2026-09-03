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
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user ?? (await waitForActiveUser(supabase, { attempts: 3, delayMs: 120 }));
        if (!mounted || !sessionUser) return;
        const roles = mergePlatformRoles(
          extractPlatformRolesFromMetadata(sessionUser.app_metadata),
          extractPlatformRolesFromMetadata(sessionUser.user_metadata),
          getMasterAdminRolesForEmail(sessionUser.email),
        );
        const pendingDestination = await findPendingInvitationDestination(supabase, nextPath);
        const bootstrap = await bootstrapAuthenticatedUser(supabase, {
          userId: sessionUser.id,
          nextPath,
          roles,
        });
        const destination = pendingDestination ?? await resolvePermissionedAdminDestination(supabase, {
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
              <h2>{activeMode === "sign-in" ? "Sign in" : "Create account"}</h2>
            </div>
            <Link href="/demo" className="lf-entry-demo-link">Demo</Link>
          </div>

          <p className="lf-entry-panel-subtext">
            {activeMode === "sign-in"
              ? "Sign in to your authorised workspace. Operational dashboards are opened only when account permissions allow them."
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
            <SignUpForm nextPath={nextPath} compact />
          )}

          <div className="lf-entry-footnote">
            <span><Icon name="lock" size={14} /> Private workspace</span>
            <span><Icon name="description" size={14} /> Guided setup after sign-up</span>
            <span><Icon name="admin_panel_settings" size={14} /> Admin access is role controlled</span>
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
