"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "../../components/ui/Icon";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { getOrCreateOnboardingState, saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";

export default function OnboardingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        router.replace("/sign-in");
        return;
      }

      await bootstrapAuthenticatedUser(supabase, { userId: user.id });

      const onboarding = await getOrCreateOnboardingState(supabase, user.id);
      if (!mounted) return;

      setTermsAccepted(onboarding.terms_accepted);
      setMarketingOptIn(onboarding.marketing_opt_in);

      if (onboarding.is_completed) {
        router.replace("/dashboard");
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
        router.replace("/sign-in");
        return;
      }

      await bootstrapAuthenticatedUser(supabase, { userId: user.id });
      await saveTermsAcceptance(supabase, user.id, {
        accepted: true,
        source: "onboarding",
      });

      await saveOnboardingState(supabase, user.id, {
        current_step: "complete",
        completed_steps: ["identity", "verification", "consent", "personal_details", "complete"],
        is_completed: true,
        terms_accepted: true,
        marketing_opt_in: marketingOptIn,
      });

      router.replace("/profile?source=onboarding");
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
            Set up the essentials once so your record is clear, secure, and useful to the people who may need it later.
          </p>
          {searchParams.get("required") === "1" ? (
            <div className="lf-muted-note" role="status">
              Please complete these essentials before continuing into your working account.
            </div>
          ) : null}
          <div className="lf-muted-note" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="account_tree" size={16} />
            Your secure account structure is prepared in the background before you continue.
          </div>

          <section
            style={{
              border: "1px solid #dbe3eb",
              borderRadius: 14,
              background: "#f8fafc",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700 }}>A strong start looks like this</div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              Most owners begin by confirming identity details, adding finances, saving legal records, naming trusted contacts, and capturing the follow-up tasks their family should not have to guess.
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", display: "grid", gap: 6 }}>
              <li>Profile: confirm who you are and how someone should reach you.</li>
              <li>Finances: add bank accounts, pensions, insurance, and supporting statements.</li>
              <li>Legal: save wills, powers of attorney, and important documents in one place.</li>
              <li>Contacts: record executors, next of kin, trustees, and advisors clearly.</li>
              <li>Tasks &amp; Follow-up: capture what still needs attention so progress feels visible.</li>
            </ul>
          </section>

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
            <Icon name="arrow_forward" size={16} />
            {saving ? "Saving..." : "Continue into your secure record"}
          </button>

          {status ? <div className="lf-muted-note">{status}</div> : null}
          <div className="lf-muted-note" style={{ display: "grid", gap: 4 }}>
            <div>You can add the rest in stages. Good progress means the next person can quickly understand who to contact, what exists, and what still needs review.</div>
            <div>Profile, finances, legal records, contacts, and tasks will then guide the rest of your dashboard.</div>
          </div>
          <p className="lf-muted-note">
            Need a different account? <Link className="lf-inline-link" href="/sign-in">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
