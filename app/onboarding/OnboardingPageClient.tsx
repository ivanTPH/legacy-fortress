"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "../../components/ui/Icon";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { getOrCreateOnboardingState, getTermsAcceptanceState, isCurrentTermsAcceptance, saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";
import {
  loadVaultPreferences,
  saveVaultPreferences,
  type VaultPreferences,
} from "../../lib/vaultPreferences";
import type { OnboardingStepId } from "../../config/onboarding.config";
import {
  loadProfileWorkspace,
  saveProfileWorkspace,
  type LoadedProfileWorkspace,
} from "../../lib/profile/workspace";

// Guided set-up (UX review, agreed by the owner 10 Nov 2026; design: Onboarding board on the design canvas).
// Few steps, one question per screen. Two exits worded the same everywhere: "Skip this step" under each step and
// "Skip set-up" (top right, and on Welcome) to go straight to Home with all six areas.
// Nothing here shares anything or emails anyone: the person steps hand over to the normal People pages.

// Owner decision 10 Nov 2026: start with everyday things (bank and savings, pensions, home), which feel less
// intrusive. The Will and Power of Attorney come later, through Your next steps, once the Vault is established.
type KeepKey = "bank" | "pensions" | "home" | "investments";
type Step = "name" | "welcome" | "keep" | "first" | "person";

const KEEP_OPTIONS: Array<{ key: KeepKey; icon: string; title: string; help: string; first: { title: string; help: string; href: string } }> = [
  { key: "bank", icon: "account_balance", title: "Bank and savings accounts", help: "Current accounts, savings and cash ISAs.",
    first: { title: "A bank or savings account", help: "Just the bank and account name to start.", href: "/finances/bank?add=1" } },
  { key: "pensions", icon: "savings", title: "Pensions", help: "Workplace, personal and the State Pension.",
    first: { title: "A pension", help: "The provider’s name is enough to start.", href: "/finances/pensions?add=1" } },
  { key: "home", icon: "home", title: "Your home", help: "Owned outright, jointly, or with a mortgage.",
    first: { title: "Your home", help: "The address, and where the deeds are kept.", href: "/vault/property?add=1" } },
  { key: "investments", icon: "trending_up", title: "Investments", help: "Shares, funds and stocks and shares ISAs.",
    first: { title: "An investment", help: "The platform or fund name to start.", href: "/finances/investments?add=1" } },
];

const COMPLETED_STEPS: OnboardingStepId[] = ["identity", "verification", "consent", "personal_details", "vault_categories", "guided_tour", "complete"];

export default function OnboardingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [step, setStep] = useState<Step>("name");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameKnown, setNameKnown] = useState(false);
  const [keep, setKeep] = useState<KeepKey[]>([]);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const preferencesRef = useRef<VaultPreferences | null>(null);
  const profileRef = useRef<LoadedProfileWorkspace | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

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
      if (onboarding.is_completed) {
        router.replace("/dashboard");
        return;
      }
      const [preferences, profile] = await Promise.all([
        loadVaultPreferences(supabase, user.id),
        loadProfileWorkspace(supabase, { userId: user.id, baseEmail: user.email ?? "" }).catch(() => null),
      ]);
      if (!mounted) return;

      preferencesRef.current = preferences;
      profileRef.current = profile;
      setMarketingOptIn(onboarding.marketing_opt_in);
      const first = profile?.form.first_name || String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? "");
      const last = profile?.form.last_name || String(user.user_metadata?.last_name ?? user.user_metadata?.family_name ?? "");
      setFirstName(first.trim());
      setLastName(last.trim());
      const known = Boolean(first.trim() && last.trim());
      setNameKnown(known);
      // Back from the tour (/how-it-works?from=setup): pick up at Welcome if the name and terms are already done.
      if (searchParams.get("step") === "welcome" && known && isCurrentTermsAcceptance(await getTermsAcceptanceState(supabase, user.id).catch(() => null))) {
        if (!mounted) return;
        setStep("welcome");
      }
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  // Move focus to each new screen's heading so screen readers announce it.
  useEffect(() => {
    if (!loading) headingRef.current?.focus();
  }, [step, loading]);

  async function activeUserOrSignIn() {
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) router.replace("/sign-in");
    return user;
  }

  // Continuing or skipping from the first screen is the terms acceptance ("By continuing or skipping, you agree…"),
  // recorded as before. The name is saved when both parts are there.
  async function saveNameAndTerms(userId: string) {
    await saveTermsAcceptance(supabase, userId, { accepted: true, source: "onboarding" });
    const first = firstName.trim();
    const last = lastName.trim();
    const profile = profileRef.current;
    if (first && last && profile && (profile.form.first_name !== first || profile.form.last_name !== last)) {
      await saveProfileWorkspace(supabase, {
        userId,
        form: { ...profile.form, first_name: first, last_name: last },
        support: profile.support,
      });
    }
  }

  async function confirmName() {
    setStatus("");
    if (!firstName.trim() || !lastName.trim()) {
      setStatus("Please add your first and last name, or tap Skip set-up.");
      return;
    }
    setSaving(true);
    try {
      const user = await activeUserOrSignIn();
      if (!user) return;
      await saveNameAndTerms(user.id);
      setStep("welcome");
    } catch (error) {
      setStatus(`Could not save that: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  // "Skip set-up" is the same everywhere: straight to Home with all six areas.
  async function skipSetUp() {
    if (step === "name") {
      setSaving(true);
      try {
        const user = await activeUserOrSignIn();
        if (!user) return;
        await saveNameAndTerms(user.id);
      } catch (error) {
        setStatus(`Could not save that: ${error instanceof Error ? error.message : "Unknown error"}`);
        setSaving(false);
        return;
      }
    }
    await finish("/dashboard");
  }

  async function finish(destination: string) {
    setStatus("");
    setSaving(true);
    try {
      const user = await activeUserOrSignIn();
      if (!user) return;
      // All six areas stay on (the default). What was ticked only decides which first record to suggest.
      await saveVaultPreferences(supabase, user.id, preferencesRef.current ?? await loadVaultPreferences(supabase, user.id));
      await saveOnboardingState(supabase, user.id, {
        current_step: "complete",
        completed_steps: COMPLETED_STEPS,
        is_completed: true,
        terms_accepted: true,
        marketing_opt_in: marketingOptIn,
      });
      router.replace(destination);
    } catch (error) {
      setStatus(`Could not finish setting up: ${error instanceof Error ? error.message : "Unknown error"}`);
      setSaving(false);
    }
  }

  function toggleKeep(key: KeepKey) {
    setKeep((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  if (loading) {
    return (
      <main className="lf-setup">
        <div className="lf-setup-card"><p className="lf-setup-help">Getting your Vault ready…</p></div>
      </main>
    );
  }

  const guidedStep = step === "keep" ? 1 : step === "first" ? 2 : step === "person" ? 3 : 0;
  const back: Record<Step, Step | null> = { name: null, welcome: "name", keep: "welcome", first: "keep", person: "first" };
  const picked = KEEP_OPTIONS.filter((option) => keep.includes(option.key));
  const firstChoices = [
    ...(picked.length ? picked : KEEP_OPTIONS.filter((option) => option.key === "bank" || option.key === "home")).map((option) => ({ icon: option.icon, ...option.first })),
    { icon: "add_circle", title: "Something else", help: "Choose from all six areas of your Vault.", href: "/add" },
  ];

  return (
    <main className="lf-setup">
      <div className="lf-setup-frame">
      {/* Laptops and tablets only: a short reassurance beside the card. Phones show the card alone. */}
      <aside className="lf-setup-aside" aria-label="About your Vault">
        <span className="lf-setup-aside-brand"><Icon name="shield" size={24} />Legacy Fortress</span>
        <p className="lf-setup-aside-title">Everything your family will need, in one safe place.</p>
        <ul>
          <li><Icon name="lock" size={22} /><span>Private to you. Nothing is shared until you choose.</span></li>
          <li><Icon name="schedule" size={22} /><span>About 5 minutes. Skip any step, or skip set-up.</span></li>
          <li><Icon name="edit_note" size={22} /><span>A name is enough to start. Add details whenever you like.</span></li>
        </ul>
      </aside>
      <div className="lf-setup-card">
        <div className="lf-setup-top">
          {back[step] && !saving ? (
            <button type="button" className="lf-setup-back" onClick={() => setStep(back[step] as Step)}>
              <Icon name="arrow_back" size={20} />Back
            </button>
          ) : <span className="lf-setup-brand"><Icon name="shield" size={20} />Legacy Fortress</span>}
          {step !== "welcome" ? (
            <button type="button" className="lf-setup-skip" onClick={() => void skipSetUp()} disabled={saving}>Skip set-up</button>
          ) : null}
        </div>
        {guidedStep ? (
          <div className="lf-setup-steps">
            <span className="lf-setup-steplabel">Step {guidedStep} of 3</span>
            <div className="lf-setup-progress" aria-hidden="true"><span style={{ width: `${Math.round((guidedStep / 3) * 100)}%` }} /></div>
          </div>
        ) : null}

        {step === "name" ? (
          <form className="lf-setup-body" onSubmit={(event) => { event.preventDefault(); void confirmName(); }}>
            {searchParams.get("required") === "1" ? <p className="lf-setup-help">Just a minute of set-up before you go in.</p> : null}
            <h1 ref={headingRef} tabIndex={-1}>{nameKnown ? "Is this right?" : "What’s your name?"}</h1>
            <p className="lf-setup-help">We use it on your Vault and in emails to you.</p>
            <label className="lf-setup-field">
              <span>First name</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required />
            </label>
            <label className="lf-setup-field">
              <span>Last name</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required />
            </label>
            <button type="submit" className="lf-setup-primary" disabled={saving}>{saving ? "Saving…" : nameKnown ? "Yes, continue" : "Continue"}</button>
            <p className="lf-setup-legal">
              By continuing or skipping, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.
            </p>
          </form>
        ) : null}

        {step === "welcome" ? (
          <div className="lf-setup-body">
            <h1 ref={headingRef} tabIndex={-1}>Welcome, {firstName}</h1>
            <p className="lf-setup-help">Let’s get your Vault started. It takes about 5 minutes. You can skip any step, or skip set-up altogether.</p>
            {/* TEST and live refuse to show pages inside other pages (X-Frame-Options: DENY), so the tour opens as its own page with a way back. */}
            <a className="lf-setup-choice" href="/how-it-works?from=setup">
              <Icon name="play_circle" size={28} />
              <span><strong>Watch a 1-minute tour first</strong><small>With voice-over and captions. Then come straight back.</small></span>
              <Icon name="chevron_right" size={22} />
            </a>
            <button type="button" className="lf-setup-primary" onClick={() => setStep("keep")} disabled={saving}>Set up with me</button>
            <button type="button" className="lf-setup-quiet" onClick={() => void skipSetUp()} disabled={saving}>
              {saving ? "Opening your Vault…" : "Skip set-up"}
            </button>
            <p className="lf-setup-help">If you skip set-up, you’ll go straight to your Vault with all six areas. You can add things whenever you like.</p>
          </div>
        ) : null}

        {step === "keep" ? (
          <div className="lf-setup-body">
            <h1 ref={headingRef} tabIndex={-1}>What would you like to keep safe?</h1>
            <p className="lf-setup-help">Tick any that apply. We’ll start with the everyday things.</p>
            <div className="lf-setup-answers" role="group" aria-label="What would you like to keep safe?">
              {KEEP_OPTIONS.map((option) => (
                <button key={option.key} type="button" className="lf-setup-choice lf-setup-tick" aria-pressed={keep.includes(option.key)} onClick={() => toggleKeep(option.key)}>
                  <Icon name={option.icon} size={28} />
                  <span><strong>{option.title}</strong><small>{option.help}</small></span>
                  <Icon name={keep.includes(option.key) ? "check_box" : "check_box_outline_blank"} size={26} />
                </button>
              ))}
            </div>
            <button type="button" className="lf-setup-primary" onClick={() => setStep("first")}>Continue</button>
            <button type="button" className="lf-setup-quiet" onClick={() => { setKeep([]); setStep("first"); }}>Skip this step</button>
          </div>
        ) : null}

        {step === "first" ? (
          <div className="lf-setup-body">
            <h1 ref={headingRef} tabIndex={-1}>Let’s add your first thing</h1>
            <p className="lf-setup-help">Pick whichever is easiest. You can add the rest later.</p>
            {firstChoices.map((choice) => (
              <button key={choice.href} type="button" className="lf-setup-choice" disabled={saving} onClick={() => void finish(choice.href)}>
                <Icon name={choice.icon} size={28} />
                <span><strong>{choice.title}</strong><small>{choice.help}</small></span>
                <Icon name="chevron_right" size={22} />
              </button>
            ))}
            <button type="button" className="lf-setup-quiet" onClick={() => setStep("person")} disabled={saving}>Skip this step</button>
          </div>
        ) : null}

        {step === "person" ? (
          <div className="lf-setup-body">
            <h1 ref={headingRef} tabIndex={-1}>Who should know about your Vault?</h1>
            <p className="lf-setup-help">Someone you trust, such as a partner, son or daughter, or a close friend. Adding them doesn’t share anything or send them anything.</p>
            <button type="button" className="lf-setup-choice" disabled={saving} onClick={() => void finish("/contacts?group=family&add=1")}>
              <Icon name="family_restroom" size={28} />
              <span><strong>Someone in my family</strong><small>A partner, son or daughter, or another relative.</small></span>
              <Icon name="chevron_right" size={22} />
            </button>
            <button type="button" className="lf-setup-choice" disabled={saving} onClick={() => void finish("/contacts?group=trusted-contacts&add=1")}>
              <Icon name="person_add" size={28} />
              <span><strong>Someone else I trust</strong><small>A close friend or an adviser.</small></span>
              <Icon name="chevron_right" size={22} />
            </button>
            <button type="button" className="lf-setup-quiet" onClick={() => void finish("/dashboard")} disabled={saving}>
              {saving ? "Opening your Vault…" : "Skip this step"}
            </button>
          </div>
        ) : null}

        {status ? <p className="lf-setup-status" role="alert">{status}</p> : null}
      </div>

      </div>
    </main>
  );
}
