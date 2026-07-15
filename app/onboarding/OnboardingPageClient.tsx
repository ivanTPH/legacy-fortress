"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "../../components/ui/Icon";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { getOrCreateOnboardingState, saveOnboardingState, saveTermsAcceptance } from "../../lib/onboarding";
import {
  VAULT_CATEGORY_DEFINITIONS,
  getVaultSubsectionsForGroup,
  loadVaultPreferences,
  saveVaultPreferences,
  type VaultPreferences,
  type VaultSubsectionKey,
} from "../../lib/vaultPreferences";
import {
  PlatformNotice,
  PlatformSection,
} from "../../components/ui/PlatformPrimitives";

export default function OnboardingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [vaultPreferences, setVaultPreferences] = useState<VaultPreferences | null>(null);

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
      const nextVaultPreferences = await loadVaultPreferences(supabase, user.id);
      if (!mounted) return;

      setTermsAccepted(onboarding.terms_accepted);
      setMarketingOptIn(onboarding.marketing_opt_in);
      setVaultPreferences(nextVaultPreferences);

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
      setStatus("Accept the Terms and Conditions to continue. You can skip category choices for now and update them later in My Vault.");
      window.requestAnimationFrame(() => {
        document.querySelector(".lf-onboarding-action-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
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
      await saveVaultPreferences(supabase, user.id, vaultPreferences ?? await loadVaultPreferences(supabase, user.id));

      await saveOnboardingState(supabase, user.id, {
        current_step: "complete",
        completed_steps: ["identity", "verification", "consent", "personal_details", "vault_categories", "complete"],
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

  function toggleSubsection(key: VaultSubsectionKey) {
    setVaultPreferences((current) => current ? {
      ...current,
      subsections: {
        ...current.subsections,
        [key]: !current.subsections[key],
      },
    } : current);
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
    <main className="lf-auth lf-onboarding-main">
      <section className="lf-auth-form-side lf-onboarding-form-side">
        <div className="lf-auth-card lf-onboarding-card">
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

          <section className="lf-onboarding-action-panel" aria-label="Continue or skip setup choices">
            <div>
              <strong>Ready to go in?</strong>
              <p>
                Category choices are optional. Accept the Terms and Conditions, then continue now and adjust the setup
                later in My Vault.
              </p>
            </div>
            <div className="lf-onboarding-action-controls">
              <label className="lf-label lf-onboarding-required-terms">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                <span>
                  I accept the{" "}
                  <button
                    type="button"
                    className="lf-onboarding-terms-link"
                    onClick={(event) => {
                      event.preventDefault();
                      setTermsModalOpen(true);
                    }}
                  >
                    Terms and Conditions
                  </button>
                </span>
              </label>
              <label className="lf-label">
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
            </div>
            {status ? <div className="lf-onboarding-status" role="alert">{status}</div> : null}
          </section>

          <PlatformSection
            title="What happens here"
            detail="Only the terms acceptance is required. Everything else on this page is a preference you can change later."
            icon="checklist"
            emphasis="primary"
          >
            <ul className="lf-onboarding-explainer" aria-label="Onboarding choices explained">
              <li>
                <strong>Accept the Terms and Conditions</strong>
                <span>This is required before the secure workspace opens.</span>
              </li>
              <li>
                <strong>Choose visible vault categories</strong>
                <span>Optional. Untick anything you do not want to focus on today.</span>
              </li>
              <li>
                <strong>Continue to Profile</strong>
                <span>Your saved choices are applied, then you can add or edit your identity details.</span>
              </li>
            </ul>
            <PlatformNotice icon="verified_user">
              Tasks and reminders stay inside Action Centre, so the dashboard remains a calm summary once setup is complete.
            </PlatformNotice>
          </PlatformSection>

          {vaultPreferences ? (
            <section
              style={{
                border: "1px solid #dbe3eb",
                borderRadius: 14,
                background: "#fff",
                padding: 14,
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700 }}>Choose your vault categories</div>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Keep only the sections you want to focus on right now. You can change these later in My Vault settings.
                </div>
              </div>
              <div className="lf-onboarding-category-grid">
                {VAULT_CATEGORY_DEFINITIONS.map((category) => (
                  <label
                    key={category.key}
                    style={categoryCardStyle}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={vaultPreferences.groups[category.key]}
                        onChange={() => setVaultPreferences((current) => current ? {
                          ...current,
                          groups: {
                            ...current.groups,
                            [category.key]: !current.groups[category.key],
                          },
                        } : current)}
                      />
                      <span style={{ fontWeight: 700 }}>{category.label}</span>
                    </span>
                    <span style={{ color: "#64748b", fontSize: 13 }}>{category.description}</span>
                    {getVaultSubsectionsForGroup(category.key).length ? (
                      <span style={{ display: "grid", gap: 6, paddingLeft: 24 }}>
                        {getVaultSubsectionsForGroup(category.key).map((subsection) => (
                          <label key={subsection.key} style={{ display: "grid", gap: 3 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={vaultPreferences.subsections[subsection.key]}
                                disabled={!vaultPreferences.groups[category.key]}
                                onChange={() => toggleSubsection(subsection.key)}
                              />
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{subsection.label}</span>
                            </span>
                            <span style={{ color: "#64748b", fontSize: 12 }}>{subsection.description}</span>
                          </label>
                        ))}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <button className="lf-primary-btn" onClick={() => void completeOnboarding()} disabled={saving}>
            <Icon name="arrow_forward" size={16} />
            {saving ? "Saving..." : "Continue into your secure record"}
          </button>

          <div className="lf-muted-note" style={{ display: "grid", gap: 4 }}>
            <div>You can add the rest in stages. Good progress means the next person can quickly understand who to contact, what exists, and what still needs review.</div>
            <div>Profile, your selected vault sections, contacts, and the next practical tasks will then guide the rest of your dashboard.</div>
          </div>
          <p className="lf-muted-note">
            Need a different account? <Link className="lf-inline-link" href="/sign-in">Sign in</Link>
          </p>
        </div>
      </section>
      {termsModalOpen ? (
        <div className="lf-onboarding-modal-backdrop" role="presentation" onClick={() => setTermsModalOpen(false)}>
          <section
            className="lf-onboarding-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-terms-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lf-onboarding-modal-header">
              <h2 id="onboarding-terms-title">Terms and Conditions</h2>
              <button type="button" className="lf-icon-button" aria-label="Close terms" onClick={() => setTermsModalOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="lf-onboarding-modal-body">
              <p>
                Legacy Fortress stores sensitive estate and account information. By accepting, you confirm that the
                information you add is yours to store, that you will keep access details accurate, and that you
                understand shared access should only be granted to people you trust.
              </p>
              <p>
                You can review your acceptance record later from Profile / Terms and Conditions.
              </p>
              <Link className="lf-inline-link" href="/account/terms">
                Open full terms status page
              </Link>
            </div>
            <div className="lf-onboarding-modal-actions">
              <button type="button" className="lf-primary-btn" onClick={() => {
                setTermsAccepted(true);
                setTermsModalOpen(false);
              }}>
                Accept terms
              </button>
              <button type="button" className="lf-secondary-btn" onClick={() => setTermsModalOpen(false)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

const categoryCardStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
  display: "grid",
  gap: 6,
  boxShadow: "0 1px 2px rgba(33,17,13,0.018)",
};
