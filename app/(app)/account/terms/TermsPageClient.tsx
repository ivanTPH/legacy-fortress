"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsCard, SettingsPageShell } from "../../components/settings/SettingsPrimitives";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";
import { CURRENT_TERMS_VERSION, saveTermsAcceptance } from "../../../../lib/onboarding";

type TermsRow = {
  terms_version: string | null;
  accepted: boolean | null;
  accepted_at: string | null;
  updated_at: string | null;
};

export default function TermsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");
  const [row, setRow] = useState<TermsRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("terms_acceptances")
        .select("terms_version,accepted,accepted_at,updated_at")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        setStatus(`Could not load terms status: ${error.message}`);
      } else {
        setRow((data ?? null) as TermsRow | null);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function acceptTerms() {
    setSaving(true);
    setStatus("");
    try {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      const saved = await saveTermsAcceptance(supabase, userData.user.id, {
        accepted: true,
        source: "terms-page",
      });
      setRow({
        terms_version: saved.terms_version,
        accepted: saved.accepted,
        accepted_at: saved.accepted_at,
        updated_at: saved.updated_at,
      });
      setStatus("Terms accepted. You can continue into your workspace.");

      if (searchParams.get("required") === "1") {
        router.replace("/dashboard");
      }
    } catch (error) {
      setStatus(`Could not accept terms: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPageShell
      title="Terms and Conditions"
      subtitle="Review and confirm the current terms so your account is ready to use."
    >
      <SettingsCard title="Terms status" description="Terms acceptance is required for account use.">
        {searchParams.get("required") === "1" ? (
          <div style={{ color: "#475569", fontSize: 13 }}>
            Your account needs terms acceptance before you can continue into the main workspace.
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div><strong>Version:</strong> {row?.terms_version || CURRENT_TERMS_VERSION}</div>
          <div><strong>Status:</strong> {row?.accepted ? "Accepted" : "Pending acceptance"}</div>
          <div><strong>Accepted at:</strong> {row?.accepted_at ? new Date(row.accepted_at).toLocaleString() : "Not available"}</div>
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Latest terms are reviewed during onboarding and can be re-reviewed when versions change.
        </div>
        {row?.accepted ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Terms are already accepted for this account. <Link href="/dashboard">Return to the dashboard</Link>.
          </div>
        ) : (
          <button className="lf-primary-btn" type="button" onClick={() => void acceptTerms()} disabled={saving}>
            {saving ? "Saving..." : "Accept terms and continue"}
          </button>
        )}
        {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      </SettingsCard>
    </SettingsPageShell>
  );
}
