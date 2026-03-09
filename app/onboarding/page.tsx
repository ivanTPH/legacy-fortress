"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { getOrCreateOnboardingState, saveOnboardingState } from "../../lib/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 150 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      const onboarding = await getOrCreateOnboardingState(supabase, user.id);
      if (!mounted) return;

      setTermsAccepted(onboarding.terms_accepted);
      setMarketingOptIn(onboarding.marketing_opt_in);

      if (onboarding.is_completed) {
        router.replace("/app/dashboard");
        return;
      }

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function completeOnboarding() {
    setStatus("");
    if (!termsAccepted) {
      setStatus("Please accept Terms and Conditions to continue.");
      return;
    }

    setSaving(true);
    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      await saveOnboardingState(supabase, user.id, {
        current_step: "complete",
        completed_steps: ["identity", "verification", "consent", "personal_details", "complete"],
        is_completed: true,
        terms_accepted: true,
        marketing_opt_in: marketingOptIn,
      });

      router.replace("/app/dashboard");
    } catch (error) {
      setStatus(`Could not complete onboarding: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="lf-auth">
        <section className="lf-auth-form-side">
          <div className="lf-auth-card">
            <h1>Preparing onboarding</h1>
            <p className="lf-auth-subtext">Validating your account and session...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-form-side">
        <div className="lf-auth-card">
          <h1>Welcome to Legacy Fortress</h1>
          <p className="lf-auth-subtext">
            Complete these essentials once to unlock your dashboard on mobile and desktop.
          </p>

          <label className="lf-label" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>I accept the Terms and Conditions</span>
          </label>

          <label className="lf-label" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(event) => setMarketingOptIn(event.target.checked)}
            />
            <span>Receive product updates and helpful reminders (optional)</span>
          </label>

          <button className="lf-primary-btn" onClick={() => void completeOnboarding()} disabled={saving}>
            {saving ? "Saving..." : "Go to dashboard"}
          </button>

          {status ? <div className="lf-muted-note">{status}</div> : null}
          <p className="lf-muted-note">
            Need a different account? <Link className="lf-inline-link" href="/signin">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
