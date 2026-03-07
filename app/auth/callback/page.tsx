
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackClientEvent } from "@/lib/observability/clientEvents";
import { supabase } from "@/lib/supabaseClient";
import { toSafeInternalPath, waitForActiveUser } from "@/lib/auth/session";
import { getOrCreateOnboardingState } from "@/lib/onboarding";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in...");

  useEffect(() => {
    (async () => {
      try {
        // PKCE flow: ?code=...
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          trackClientEvent("auth.callback.exchange_code.success");
        }

        // Implicit flow: #access_token=...
        if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          const type = hash.get("type");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;
            trackClientEvent("auth.callback.set_session.success");
          }
          if (type === "recovery") {
            trackClientEvent("auth.callback.recovery");
            router.replace("/auth/reset-password");
            return;
          }
        }

        const user = await waitForActiveUser(supabase, { attempts: 8, delayMs: 160 });
        if (!user) {
          throw new Error("No active session found after authentication.");
        }

        const onboarding = await getOrCreateOnboardingState(supabase, user.id);
        const next = new URL(window.location.href).searchParams.get("next");
        const destination = onboarding.is_completed
          ? toSafeInternalPath(next, "/dashboard")
          : "/onboarding";
        trackClientEvent("auth.callback.redirect", {
          destination,
          onboardingComplete: onboarding.is_completed,
        });

        setMsg("Signed in! Redirecting...");
        router.replace(destination);
      } catch (error: unknown) {
        console.error(error);
        trackClientEvent("auth.callback.error");
        setMsg(`Sign-in failed: ${getErrorMessage(error)}`);
      }
    })();
  }, [router]);

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-art-copy">
          <h2>Finalizing secure sign-in</h2>
          <p>Please wait while we validate your session with Legacy Fortress.</p>
        </div>
      </section>
      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Authentication</h1>
          <p className="lf-auth-subtext">{msg}</p>
        </div>
      </section>
    </main>
  );
}
