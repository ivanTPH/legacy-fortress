"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import OnboardingShell from "../../components/onboarding/OnboardingShell";
import GuidedTourPrompt from "../../components/onboarding/GuidedTourPrompt";
import { ONBOARDING_STEPS, type OnboardingStepId } from "../../config/onboarding.config";
import { supabase } from "../../lib/supabaseClient";
import { isEmailVerified } from "../../lib/auth/user";
import {
  getOrCreateOnboardingState,
  markStepComplete,
  nextStep,
  saveOnboardingState,
} from "../../lib/onboarding";
import type { OnboardingContactDraft, OnboardingStateRow } from "../../lib/onboarding/types";
import { normalizePhone, normalizePostCode, sanitizeAddress, sanitizeName } from "../../lib/validation/profile";

export default function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<OnboardingStateRow | null>(null);
  const [draftContacts, setDraftContacts] = useState<OnboardingContactDraft[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mobile, setMobile] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("UK");
  const [postCode, setPostCode] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRole, setContactRole] = useState("professional_advisor");

  const step = state?.current_step ?? "identity";
  const destination = params.get("next") || "/dashboard";

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/signin");
        return;
      }

      const authUser = data.user;
      const nextState = await getOrCreateOnboardingState(supabase, authUser.id);

      if (!mounted) return;

      setUser(authUser);
      setState(nextState);
      setTermsAccepted(nextState.terms_accepted);
      setMarketingOptIn(nextState.marketing_opt_in);

      const profile = await supabase
        .from("user_profiles")
        .select("first_name,last_name")
        .eq("user_id", authUser.id)
        .maybeSingle();
      const contact = await supabase
        .from("contact_details")
        .select("secondary_email,telephone,mobile_number")
        .eq("user_id", authUser.id)
        .maybeSingle();
      const address = await supabase
        .from("addresses")
        .select("house_name_or_number,street_name,town,city,country,post_code")
        .eq("user_id", authUser.id)
        .maybeSingle();
      const drafts = await supabase
        .from("onboarding_invite_contacts")
        .select("id,full_name,email,assigned_role,created_at")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      const p = (profile.data ?? {}) as { first_name?: string | null; last_name?: string | null };
      setFirstName(p.first_name ?? (authUser.user_metadata?.first_name as string | undefined) ?? "");
      setLastName(p.last_name ?? (authUser.user_metadata?.last_name as string | undefined) ?? "");

      const c = (contact.data ?? {}) as {
        secondary_email?: string | null;
        telephone?: string | null;
        mobile_number?: string | null;
      };
      setSecondaryEmail(c.secondary_email ?? "");
      setTelephone(c.telephone ?? "");
      setMobile(c.mobile_number ?? "");

      const a = (address.data ?? {}) as {
        house_name_or_number?: string | null;
        street_name?: string | null;
        town?: string | null;
        city?: string | null;
        country?: string | null;
        post_code?: string | null;
      };
      setHouseNumber(a.house_name_or_number ?? "");
      setStreet(a.street_name ?? "");
      setTown(a.town ?? "");
      setCity(a.city ?? "");
      setCountry(a.country ?? "UK");
      setPostCode(a.post_code ?? "");

      setDraftContacts((drafts.data ?? []) as OnboardingContactDraft[]);

      setLoading(false);
    }

    void init();
    return () => {
      mounted = false;
    };
  }, [router]);

  const stepMeta = useMemo(() => ONBOARDING_STEPS.find((s) => s.id === step), [step]);

  async function continueTo(next: OnboardingStepId) {
    if (!state || !user) return;

    const completed = markStepComplete(state, step);
    const saved = await saveOnboardingState(supabase, user.id, {
      current_step: next,
      completed_steps: completed,
      is_completed: next === "complete",
      terms_accepted: termsAccepted,
      marketing_opt_in: marketingOptIn,
    });
    setState(saved);

    if (next === "complete") {
      router.replace(destination);
    }
  }

  async function saveIdentity() {
    if (!user || !state) return;
    if (!firstName.trim() || !lastName.trim()) {
      setStatus("First and last name are required.");
      return;
    }

    setStatus("");
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          first_name: sanitizeName(firstName) || null,
          last_name: sanitizeName(lastName) || null,
          display_name: `${sanitizeName(firstName)} ${sanitizeName(lastName)}`.trim() || null,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      setStatus(`Could not save identity: ${error.message}`);
      return;
    }

    await continueTo(nextStep("identity"));
  }

  async function refreshVerification() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/signin");
      return;
    }

    setUser(data.user);

    if (isEmailVerified(data.user)) {
      setStatus("Email verified.");
      await continueTo(nextStep("verification"));
    } else {
      setStatus("Email not verified yet. Please check your inbox and click the verification link.");
    }
  }

  async function resendVerification() {
    if (!user?.email) return;

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}` : undefined;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: redirectTo },
    });

    setStatus(error ? `Could not resend verification email: ${error.message}` : "Verification email resent.");
  }

  async function saveConsent() {
    if (!user || !state) return;
    if (!termsAccepted) {
      setStatus("You must accept Terms and Conditions to continue.");
      return;
    }

    const version = "2026-03";
    const now = new Date().toISOString();

    const [termsRes, marketingRes] = await Promise.all([
      supabase.from("terms_acceptances").upsert(
        {
          user_id: user.id,
          terms_version: version,
          accepted_at: now,
          accepted: true,
          updated_at: now,
        },
        { onConflict: "user_id" },
      ),
      supabase.from("marketing_preferences").upsert(
        {
          user_id: user.id,
          marketing_opt_in: marketingOptIn,
          updated_at: now,
        },
        { onConflict: "user_id" },
      ),
    ]);

    if (termsRes.error || marketingRes.error) {
      setStatus(`Could not save consent: ${termsRes.error?.message || marketingRes.error?.message}`);
      return;
    }

    await continueTo(nextStep("consent"));
  }

  async function savePersonalDetails() {
    if (!user || !state) return;
    const now = new Date().toISOString();

    const [contactRes, addressRes] = await Promise.all([
      supabase.from("contact_details").upsert(
        {
          user_id: user.id,
          secondary_email: secondaryEmail.trim() || null,
          telephone: normalizePhone(telephone) || null,
          mobile_number: normalizePhone(mobile) || null,
          updated_at: now,
        },
        { onConflict: "user_id" },
      ),
      supabase.from("addresses").upsert(
        {
          user_id: user.id,
          house_name_or_number: sanitizeAddress(houseNumber) || null,
          street_name: sanitizeAddress(street) || null,
          town: sanitizeAddress(town) || null,
          city: sanitizeAddress(city) || null,
          country: sanitizeAddress(country) || null,
          post_code: normalizePostCode(postCode) || null,
          updated_at: now,
        },
        { onConflict: "user_id" },
      ),
    ]);

    if (contactRes.error || addressRes.error) {
      setStatus(`Could not save personal details: ${contactRes.error?.message || addressRes.error?.message}`);
      return;
    }

    await continueTo(nextStep("personal_details"));
  }

  async function addDraftContact() {
    if (!user) return;
    if (!contactName.trim() || !contactEmail.trim()) {
      setStatus("Contact name and email are required.");
      return;
    }

    const { error } = await supabase.from("onboarding_invite_contacts").insert({
      user_id: user.id,
      full_name: contactName.trim(),
      email: contactEmail.trim().toLowerCase(),
      assigned_role: contactRole,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setStatus(`Could not add contact: ${error.message}`);
      return;
    }

    const drafts = await supabase
      .from("onboarding_invite_contacts")
      .select("id,full_name,email,assigned_role,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setDraftContacts((drafts.data ?? []) as OnboardingContactDraft[]);
    setContactName("");
    setContactEmail("");
    setContactRole("professional_advisor");
    setStatus("Contact saved.");
  }

  async function deleteDraftContact(id: string) {
    if (!user) return;
    const { error } = await supabase.from("onboarding_invite_contacts").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      setStatus(`Could not delete contact: ${error.message}`);
      return;
    }
    setDraftContacts((rows) => rows.filter((row) => row.id !== id));
  }

  async function sendInvitesNow() {
    if (!user) return;

    for (const draft of draftContacts) {
      const inserted = await supabase
        .from("contact_invitations")
        .insert({
          owner_user_id: user.id,
          contact_name: draft.full_name,
          contact_email: draft.email,
          assigned_role: draft.assigned_role,
          invitation_status: "pending",
          invited_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (inserted.error || !inserted.data) {
        setStatus(`Could not create invitation for ${draft.email}: ${inserted.error?.message}`);
        continue;
      }

      await supabase.from("role_assignments").upsert(
        {
          owner_user_id: user.id,
          invitation_id: inserted.data.id,
          assigned_role: draft.assigned_role,
          activation_status: "invited",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "invitation_id" },
      );

      await supabase.from("onboarding_invite_contacts").update({ converted_to_invitation: true, updated_at: new Date().toISOString() }).eq("id", draft.id).eq("user_id", user.id);
    }

    await continueTo(nextStep("send_invites"));
  }

  async function finishTour(optIn: boolean) {
    if (!user || !state) return;
    await saveOnboardingState(supabase, user.id, {
      tour_opt_in: optIn,
      current_step: "complete",
      completed_steps: [...new Set<OnboardingStepId>([...state.completed_steps, step, "complete"])],
      is_completed: true,
      terms_accepted: termsAccepted,
      marketing_opt_in: marketingOptIn,
    });
    router.replace(destination);
  }

  if (loading || !state || !user) {
    return (
      <OnboardingShell step="identity" title="Loading onboarding" subtitle="Preparing your workspace...">
        <div className="lf-muted-note">Loading...</div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={step}
      title={stepMeta?.label || "Onboarding"}
      subtitle="Complete these steps to configure your account and access your dashboard."
    >
      {step === "identity" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <label className="lf-label"><span>First name</span><input className="lf-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
          <label className="lf-label"><span>Last name</span><input className="lf-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
          <button className="lf-primary-btn" type="button" onClick={() => void saveIdentity()}>Continue</button>
        </div>
      ) : null}

      {step === "verification" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="lf-muted-note">
            Verify your email before continuing. Current status: <strong>{isEmailVerified(user) ? "Verified" : "Unverified"}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="lf-primary-btn" type="button" onClick={() => void refreshVerification()}>I have verified</button>
            <button className="lf-link-btn" type="button" onClick={() => void resendVerification()}>Resend verification email</button>
          </div>
        </div>
      ) : null}

      {step === "consent" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "start" }}>
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            <span>I have reviewed and accept the <Link href="/account/terms">Terms and Conditions</Link>.</span>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "start" }}>
            <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
            <span>I agree to receive optional marketing updates.</span>
          </label>
          <button className="lf-primary-btn" type="button" onClick={() => void saveConsent()}>Continue</button>
        </div>
      ) : null}

      {step === "personal_details" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="lf-content-grid">
            <label className="lf-label"><span>Primary email</span><input className="lf-input" value={user.email || ""} disabled /></label>
            <label className="lf-label"><span>Second email (optional)</span><input className="lf-input" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} /></label>
            <label className="lf-label"><span>Telephone</span><input className="lf-input" value={telephone} onChange={(e) => setTelephone(normalizePhone(e.target.value))} /></label>
            <label className="lf-label"><span>Mobile</span><input className="lf-input" value={mobile} onChange={(e) => setMobile(normalizePhone(e.target.value))} /></label>
            <label className="lf-label"><span>House name/number</span><input className="lf-input" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} /></label>
            <label className="lf-label"><span>Street</span><input className="lf-input" value={street} onChange={(e) => setStreet(e.target.value)} /></label>
            <label className="lf-label"><span>Town</span><input className="lf-input" value={town} onChange={(e) => setTown(e.target.value)} /></label>
            <label className="lf-label"><span>City</span><input className="lf-input" value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label className="lf-label"><span>Country</span><input className="lf-input" value={country} onChange={(e) => setCountry(e.target.value)} /></label>
            <label className="lf-label"><span>Post code</span><input className="lf-input" value={postCode} onChange={(e) => setPostCode(normalizePostCode(e.target.value))} /></label>
          </div>
          <button className="lf-primary-btn" type="button" onClick={() => void savePersonalDetails()}>Continue</button>
        </div>
      ) : null}

      {step === "invite_contacts" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="lf-content-grid">
            <label className="lf-label"><span>Contact name</span><input className="lf-input" value={contactName} onChange={(e) => setContactName(e.target.value)} /></label>
            <label className="lf-label"><span>Contact email</span><input className="lf-input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
            <label className="lf-label"><span>Role</span>
              <select className="lf-input" value={contactRole} onChange={(e) => setContactRole(e.target.value)}>
                <option value="professional_advisor">Professional Advisor</option>
                <option value="accountant">Accountant</option>
                <option value="financial_advisor">Financial Advisor</option>
                <option value="lawyer">Lawyer</option>
                <option value="executor">Executor</option>
                <option value="power_of_attorney">Power of Attorney</option>
                <option value="friend_or_family">Friend or Family</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="lf-primary-btn" type="button" onClick={() => void addDraftContact()}>Add contact</button>
            <button className="lf-link-btn" type="button" onClick={() => void continueTo(nextStep("invite_contacts"))}>Skip for now</button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {draftContacts.map((draft) => (
              <div key={draft.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{draft.full_name}</div>
                  <div className="lf-muted-note">{draft.email} · {draft.assigned_role.replace(/_/g, " ")}</div>
                </div>
                <button className="lf-link-btn" type="button" onClick={() => void deleteDraftContact(draft.id)}>Delete</button>
              </div>
            ))}
          </div>
          <button className="lf-primary-btn" type="button" onClick={() => void continueTo(nextStep("invite_contacts"))}>Continue</button>
        </div>
      ) : null}

      {step === "send_invites" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="lf-muted-note">You can send invitations now or do this later from the dashboard.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="lf-primary-btn" type="button" onClick={() => void sendInvitesNow()} disabled={draftContacts.length === 0}>Send invitations</button>
            <button className="lf-link-btn" type="button" onClick={() => void continueTo(nextStep("send_invites"))}>Skip and send later</button>
          </div>
        </div>
      ) : null}

      {step === "guided_tour" ? <GuidedTourPrompt onStart={() => void finishTour(true)} onSkip={() => void finishTour(false)} /> : null}

      {step === "complete" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="lf-muted-note">Onboarding complete. Launching your dashboard.</div>
          <button className="lf-primary-btn" type="button" onClick={() => router.replace(destination)}>Go to dashboard</button>
        </div>
      ) : null}

      {status ? <div className="lf-muted-note">{status}</div> : null}
    </OnboardingShell>
  );
}
