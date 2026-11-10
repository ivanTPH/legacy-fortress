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
  setVaultApplicability,
  type VaultPreferences,
} from "../../lib/vaultPreferences";
import type { OnboardingStepId } from "../../config/onboarding.config";
import {
  loadProfileWorkspace,
  saveProfileWorkspace,
  type LoadedProfileWorkspace,
} from "../../lib/profile/workspace";

// Guided set-up (UX review, agreed by the owner 10 Nov 2026; design: Onboarding board on the design canvas).
// Few steps, one question per screen, everything skippable. Skip keeps all six areas on by default.
// Nothing here shares anything or emails anyone: the person steps hand over to the normal People pages.

type Answer = "yes" | "no" | "unsure";
type QuestionKey = "will" | "capacity_arrangements" | "home";
type Step = "name" | "welcome" | "q0" | "q1" | "q2" | "first" | "person";

const QUESTIONS: Array<{ key: QuestionKey; icon: string; title: string; help: string }> = [
  { key: "will", icon: "history_edu", title: "Do you have a Will?", help: "This helps us suggest the right next steps. There are no wrong answers." },
  { key: "capacity_arrangements", icon: "handshake", title: "Do you have a Power of Attorney?", help: "A Lasting Power of Attorney lets someone you trust make decisions if you can’t." },
  { key: "home", icon: "home", title: "Do you own your home?", help: "On your own, jointly, or with a mortgage." },
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
  const [answers, setAnswers] = useState<Partial<Record<QuestionKey, Answer>>>({});
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

  async function confirmName() {
    setStatus("");
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setStatus("Please add your first and last name.");
      return;
    }
    setSaving(true);
    try {
      const user = await activeUserOrSignIn();
      if (!user) return;
      // "By continuing you agree…" — continuing from this screen is the acceptance, recorded as before.
      await saveTermsAcceptance(supabase, user.id, { accepted: true, source: "onboarding" });
      const profile = profileRef.current;
      if (profile && (profile.form.first_name !== first || profile.form.last_name !== last)) {
        await saveProfileWorkspace(supabase, {
          userId: user.id,
          form: { ...profile.form, first_name: first, last_name: last },
          support: profile.support,
        });
      }
      setStep("welcome");
    } catch (error) {
      setStatus(`Could not save that: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function finish(destination: string, finalAnswers: Partial<Record<QuestionKey, Answer>> = answers) {
    setStatus("");
    setSaving(true);
    try {
      const user = await activeUserOrSignIn();
      if (!user) return;
      let preferences = preferencesRef.current ?? await loadVaultPreferences(supabase, user.id);
      for (const [key, value] of Object.entries(finalAnswers)) {
        if (value) preferences = setVaultApplicability(preferences, key, value);
      }
      await saveVaultPreferences(supabase, user.id, preferences);
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

  function answer(index: number, value: Answer | null) {
    const question = QUESTIONS[index];
    const next = { ...answers };
    if (value) next[question.key] = value;
    else delete next[question.key];
    setAnswers(next);
    setStep(index < QUESTIONS.length - 1 ? (`q${index + 1}` as Step) : "first");
  }

  if (loading) {
    return (
      <main className="lf-setup">
        <div className="lf-setup-card"><p className="lf-setup-help">Getting your Vault ready…</p></div>
      </main>
    );
  }

  const questionIndex = step === "q0" ? 0 : step === "q1" ? 1 : step === "q2" ? 2 : -1;
  const guidedStep = questionIndex >= 0 ? 1 : step === "first" ? 2 : step === "person" ? 3 : 0;
  const progress = questionIndex >= 0 ? (questionIndex + 1) / 5 : step === "first" ? 4 / 5 : step === "person" ? 1 : 0;
  const back: Record<Step, Step | null> = { name: null, welcome: "name", q0: "welcome", q1: "q0", q2: "q1", first: "q2", person: "first" };

  const firstChoices = [
    answers.will === "yes"
      ? { icon: "history_edu", title: "Your Will", help: "Where the original is kept, and who your executors are.", href: "/legal/wills?add=1" }
      : answers.home === "yes"
        ? { icon: "home", title: "Your home", help: "The address, and where the deeds are kept.", href: "/vault/property?add=1" }
        : null,
    { icon: "account_balance", title: "A bank account", help: "Just the bank and account name to start.", href: "/finances/bank?add=1" },
    { icon: "add_circle", title: "Something else", help: "Choose from all six areas of your Vault.", href: "/add" },
  ].filter(Boolean) as Array<{ icon: string; title: string; help: string; href: string }>;

  return (
    <main className="lf-setup">
      <div className="lf-setup-card">
        <div className="lf-setup-top">
          {back[step] && !saving ? (
            <button type="button" className="lf-setup-back" onClick={() => setStep(back[step] as Step)}>
              <Icon name="arrow_back" size={20} />Back
            </button>
          ) : <span className="lf-setup-brand"><Icon name="shield" size={20} />Legacy Fortress</span>}
          {guidedStep ? <span className="lf-setup-steplabel">Step {guidedStep} of 3</span> : null}
        </div>
        {guidedStep ? (
          <div className="lf-setup-progress" aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
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
              By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.
            </p>
          </form>
        ) : null}

        {step === "welcome" ? (
          <div className="lf-setup-body">
            <h1 ref={headingRef} tabIndex={-1}>Welcome, {firstName}</h1>
            <p className="lf-setup-help">Let’s get your Vault started. It takes about 5 minutes, and you can stop at any time.</p>
            {/* TEST and live refuse to show pages inside other pages (X-Frame-Options: DENY), so the tour opens as its own page with a way back. */}
            <a className="lf-setup-choice" href="/how-it-works?from=setup">
              <Icon name="play_circle" size={28} />
              <span><strong>Watch a 1-minute tour first</strong><small>With voice-over and captions. Then come straight back.</small></span>
              <Icon name="chevron_right" size={22} />
            </a>
            <button type="button" className="lf-setup-primary" onClick={() => setStep("q0")} disabled={saving}>Set up with me</button>
            <button type="button" className="lf-setup-quiet" onClick={() => void finish("/dashboard", {})} disabled={saving}>
              {saving ? "Opening your Vault…" : "Skip, I’ll explore on my own"}
            </button>
            <p className="lf-setup-help">If you skip, you’ll see all six areas of your Vault. You can come back to this from Help.</p>
          </div>
        ) : null}

        {questionIndex >= 0 ? (
          <div className="lf-setup-body">
            <span className="lf-setup-icon"><Icon name={QUESTIONS[questionIndex].icon} size={28} /></span>
            <h1 ref={headingRef} tabIndex={-1}>{QUESTIONS[questionIndex].title}</h1>
            <p className="lf-setup-help">{QUESTIONS[questionIndex].help}</p>
            <div className="lf-setup-answers" role="group" aria-label={QUESTIONS[questionIndex].title}>
              <button type="button" className="lf-setup-answer" aria-pressed={answers[QUESTIONS[questionIndex].key] === "yes"} onClick={() => answer(questionIndex, "yes")}>Yes</button>
              <button type="button" className="lf-setup-answer" aria-pressed={answers[QUESTIONS[questionIndex].key] === "no"} onClick={() => answer(questionIndex, "no")}>No</button>
              <button type="button" className="lf-setup-answer" aria-pressed={answers[QUESTIONS[questionIndex].key] === "unsure"} onClick={() => answer(questionIndex, "unsure")}>Not sure</button>
            </div>
            <button type="button" className="lf-setup-quiet" onClick={() => answer(questionIndex, null)}>Skip this question</button>
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
            <button type="button" className="lf-setup-quiet" onClick={() => setStep("person")} disabled={saving}>I’ll do this later</button>
          </div>
        ) : null}

        {step === "person" ? (
          <div className="lf-setup-body">
            <h1 ref={headingRef} tabIndex={-1}>Who should know about your Vault?</h1>
            <p className="lf-setup-help">Someone you trust, such as a partner, son or daughter, or your executor. Adding them doesn’t share anything or send them anything.</p>
            <button type="button" className="lf-setup-choice" disabled={saving} onClick={() => void finish("/contacts?group=executors&add=1")}>
              <Icon name="gavel" size={28} />
              <span><strong>My executor</strong><small>The person who’ll sort things out.</small></span>
              <Icon name="chevron_right" size={22} />
            </button>
            <button type="button" className="lf-setup-choice" disabled={saving} onClick={() => void finish("/contacts?group=trusted-contacts&add=1")}>
              <Icon name="person_add" size={28} />
              <span><strong>Someone I trust</strong><small>Family, a friend or an adviser.</small></span>
              <Icon name="chevron_right" size={22} />
            </button>
            <button type="button" className="lf-setup-quiet" onClick={() => void finish("/dashboard")} disabled={saving}>
              {saving ? "Opening your Vault…" : "I’ll do this later"}
            </button>
          </div>
        ) : null}

        {status ? <p className="lf-setup-status" role="alert">{status}</p> : null}
      </div>

    </main>
  );
}
