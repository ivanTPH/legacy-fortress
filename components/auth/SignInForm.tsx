"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import Icon from "../ui/Icon";
import { getConfiguredAuthProviders } from "../../lib/auth/authProviders";
import FounderTestLauncher from "../navigation/FounderTestLauncher";

const OAuthButtons = dynamic(() => import("./OAuthButtons"), {
  loading: () => <div className="lf-muted-note">Loading sign-in providers...</div>,
});

function toSignInErrorMessage(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return `Invalid email or password. If you just signed up, verify your email first and then sign in. (Supabase: ${raw})`;
  }
  if (message.includes("email not confirmed")) {
    return `Please verify your email before signing in. (Supabase: ${raw})`;
  }
  return `Authentication error: ${raw}`;
}

export default function SignInForm({
  nextPath,
  compact = false,
  initialStatus = "",
  initialEmail = "",
}: {
  nextPath?: string | null;
  compact?: boolean;
  initialStatus?: string;
  initialEmail?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [showFounderChoice, setShowFounderChoice] = useState(false);
  // Two-step verification (Settings › Security): people who turned it on enter a 6-digit code.
  const [codeFactorId, setCodeFactorId] = useState("");
  const [code, setCode] = useState("");

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setSigningIn(true);
    try {
      const { supabase } = await import("../../lib/supabaseClient");
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: codeFactorId, code: code.replace(/\D/g, "") });
      if (result.error) { setStatus("That code isn’t right. Codes change every 30 seconds; try the current one."); return; }
    } finally { setSigningIn(false); }
    await signIn(undefined, true);
  }

  async function signIn(event?: FormEvent<HTMLFormElement>, afterCode = false) {
    event?.preventDefault();
    setStatus("");
    setShowFounderChoice(false);
    setSigningIn(true);

    try {
      const [
        { supabase },
        { waitForActiveUser },
        { bootstrapAuthenticatedUser },
        { findPendingInvitationDestination },
        { getMasterAdminRolesForEmail, mergePlatformRoles },
        { extractPlatformRolesFromMetadata },
        { resolvePermissionedAdminDestination },
        { hasFounderTestLauncherAccess, shouldOfferFounderSignInChoice },
      ] = await Promise.all([
        import("../../lib/supabaseClient"),
        import("../../lib/auth/session"),
        import("../../lib/auth/bootstrap"),
        import("../../lib/auth/pendingInvitations"),
        import("../../lib/auth/adminRoles"),
        import("../../lib/auth/platformRoles"),
        import("../../lib/auth/adminDestination"),
        import("../../lib/testLauncher/client"),
      ]);
      const { data, error } = afterCode
        ? await supabase.auth.getSession().then((result) => ({ data: { session: result.data.session }, error: result.error }))
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(`Sign in failed: ${toSignInErrorMessage(error.message)}`);
        return;
      }
      if (!data.session) {
        setStatus("Sign in failed: No active session returned.");
        return;
      }
      if (!codeFactorId) {
        const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (level.data?.nextLevel === "aal2" && level.data.currentLevel !== "aal2") {
          const factors = await supabase.auth.mfa.listFactors();
          const totp = factors.data?.totp?.find((factor) => factor.status === "verified");
          if (totp) { setCodeFactorId(totp.id); return; }
        }
      }

      const confirmedUser = await waitForActiveUser(supabase, { attempts: 6, delayMs: 120 });
      if (!confirmedUser) {
        setStatus("Sign in failed: Session was not persisted in this browser.");
        return;
      }

      // New phone or computer? Check it's them with an emailed code first (4 Nov 2026).
      const { checkDeviceTrust, verifyDeviceHref, readReturningVisitor, saveReturningVisitor } = await import("../../lib/auth/deviceTrustClient");
      const device = await checkDeviceTrust();
      if (device.enforced && !device.trusted) {
        router.replace(verifyDeviceHref(nextPath ?? "/dashboard"));
        return;
      }
      // A remembered device keeps its "Welcome back" details up to date.
      if (readReturningVisitor()) saveReturningVisitor(data.session.user);

      const roles = mergePlatformRoles(
        extractPlatformRolesFromMetadata(confirmedUser.app_metadata),
        extractPlatformRolesFromMetadata(confirmedUser.user_metadata),
        getMasterAdminRolesForEmail(confirmedUser.email),
      );
      const pendingDestination = await findPendingInvitationDestination(supabase, nextPath);
      const bootstrap = await bootstrapAuthenticatedUser(supabase, {
        userId: confirmedUser.id,
        nextPath: nextPath ?? undefined,
        roles,
      });
      const verifiedFounder = !nextPath && !pendingDestination && bootstrap.onboardingComplete
        ? await hasFounderTestLauncherAccess(data.session.access_token)
        : false;
      if (shouldOfferFounderSignInChoice({
        nextPath,
        pendingDestination,
        onboardingComplete: bootstrap.onboardingComplete,
        verifiedFounder,
      })) {
        setShowFounderChoice(true);
        return;
      }
      const destination = pendingDestination ?? await resolvePermissionedAdminDestination(supabase, {
        nextPath,
        fallbackDestination: bootstrap.destination,
        roles,
      });
      router.replace(destination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Sign in failed: ${message}`);
    } finally {
      setSigningIn(false);
    }
  }

  if (showFounderChoice) return <FounderTestLauncher current={null} available mode="post-login" />;

  if (codeFactorId) {
    return (
      <form onSubmit={(event) => void submitCode(event)} style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0 }}>Enter the 6-digit code from your authenticator app.</p>
        <label className="lf-label">
          <span>6-digit code</span>
          <input className="lf-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
        </label>
        {status ? <p className="lf-va-error" role="alert">{status}</p> : null}
        <button type="submit" className="lf-primary-btn" disabled={signingIn || code.length !== 6}>{signingIn ? "Checking…" : "Sign in"}</button>
      </form>
    );
  }

  return (
    <div style={{ display: "grid", gap: compact ? 10 : 12 }}>
      <form onSubmit={(event) => void signIn(event)} style={{ display: "grid", gap: compact ? 10 : 12 }}>
        <label className="lf-label">
          <span>Email *</span>
          <input
            className="lf-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        <label className="lf-label">
          <span>Password *</span>
          <span style={{ position: "relative", display: "block" }}>
            <input
              className="lf-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={passwordToggleStyle}
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} size={18} />
            </button>
          </span>
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p className="lf-muted-note" style={{ margin: 0 }}>
            <Link className="lf-inline-link" href="/forgot-password">Forgot password?</Link>
          </p>
          <div className="lf-muted-note">Encrypted, role-aware, and private by default.</div>
        </div>

        <button className="lf-primary-btn" type="submit" disabled={!email || !password || signingIn}>
          <Icon name="login" size={16} />
          {signingIn ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Only show "or" when Apple or Google sign-in is switched on. */}
      {getConfiguredAuthProviders().length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lf-text-secondary)", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "var(--lf-surface-subtle)" }} />
          or
          <span style={{ flex: 1, height: 1, background: "var(--lf-surface-subtle)" }} />
        </div>
      ) : null}

      <OAuthButtons nextPath={nextPath || "/dashboard"} />

      {status ? <div className="lf-muted-note" role="alert">{status}</div> : null}

      {!compact ? (
        <div className="lf-muted-note" style={{ display: "grid", gap: 4 }}>
          <div>Your records stay in your private workspace until you choose to share them.</div>
          <div>Use the same sign-in to review profile details, legal documents, finances, trusted contact access, and overall readiness.</div>
        </div>
      ) : null}
    </div>
  );
}

const passwordToggleStyle = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  width: 40,
  height: 40,
  border: "none",
  background: "transparent",
  color: "var(--lf-text-secondary)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} satisfies CSSProperties;
