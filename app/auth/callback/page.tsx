
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackClientEvent } from "@/lib/observability/clientEvents";
import { supabase } from "@/lib/supabaseClient";
import { waitForActiveUser } from "@/lib/auth/session";
import { bootstrapAuthenticatedUser } from "@/lib/auth/bootstrap";
import { getMasterAdminRolesForEmail, mergePlatformRoles } from "@/lib/auth/adminRoles";
import { extractPlatformRolesFromMetadata } from "@/lib/auth/platformRoles";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function toEmailOtpType(type: string | null) {
  if (type === "signup" || type === "email" || type === "magiclink" || type === "invite") {
    return type;
  }
  return null;
}

function toFriendlyAuthError(error: unknown) {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("pkce") || normalized.includes("code verifier")) {
    return "This verification link was opened in a different browser or has expired. Please sign in, or request a fresh verification email and open it in the same browser.";
  }
  if (normalized.includes("otp") || normalized.includes("token") || normalized.includes("expired")) {
    return "This verification link is invalid or expired. Please request a fresh email and try again.";
  }
  if (normalized.includes("no active session")) {
    return "Your email was reached, but the browser session was not created. Please sign in with the email and password you used to register.";
  }
  return message;
}

function classifyAuthCallbackError(error: unknown) {
  const normalized = getErrorMessage(error).toLowerCase();
  if (normalized.includes("pkce") || normalized.includes("code verifier")) return "pkce_or_browser_mismatch";
  if (normalized.includes("expired")) return "expired_link";
  if (normalized.includes("otp") || normalized.includes("token")) return "invalid_token";
  if (normalized.includes("no active session")) return "missing_session";
  return "unknown";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // PKCE flow: ?code=...
        const url = new URL(window.location.href);
        const next = url.searchParams.get("next");
        const tokenHash = url.searchParams.get("token_hash");
        const otpType = toEmailOtpType(url.searchParams.get("type"));

        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) throw error;
          trackClientEvent("auth.callback.verify_otp.success");
        }

        const code = url.searchParams.get("code");
        if (!tokenHash && code) {
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
            router.replace("/reset-password");
            return;
          }
        }

        if (window.location.hash || tokenHash || code) {
          const cleanUrl = new URL(window.location.origin + window.location.pathname);
          if (next) cleanUrl.searchParams.set("next", next);
          window.history.replaceState({}, document.title, cleanUrl.toString());
        }

        const user = await waitForActiveUser(supabase, { attempts: 8, delayMs: 160 });
        if (!user) {
          trackClientEvent("auth.callback.missing_session", {
            hasTokenHash: Boolean(tokenHash),
            hasCode: Boolean(code),
            hasHash: Boolean(window.location.hash),
          });
          throw new Error("No active session found after authentication.");
        }

        const roles = mergePlatformRoles(
          extractPlatformRolesFromMetadata(user.app_metadata),
          extractPlatformRolesFromMetadata(user.user_metadata),
          getMasterAdminRolesForEmail(user.email),
        );
        const bootstrap = await bootstrapAuthenticatedUser(supabase, {
          userId: user.id,
          nextPath: next,
          roles,
        });
        const destination = bootstrap.destination;
        trackClientEvent("auth.callback.redirect", {
          destination,
          onboardingComplete: bootstrap.onboardingComplete,
        });

        setMsg("Signed in! Redirecting...");
        router.replace(destination);
      } catch (error: unknown) {
        trackClientEvent("auth.callback.error", {
          reason: classifyAuthCallbackError(error),
        });
        setFailed(true);
        setMsg(`Sign-in failed: ${toFriendlyAuthError(error)}`);
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
          {failed ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link className="lf-primary-btn" href="/sign-in">
                Go to sign in
              </Link>
              <Link className="lf-primary-btn" style={{ background: "#fff", color: "#111827", border: "1px solid #d1d5db" }} href="/sign-up">
                Create account
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
