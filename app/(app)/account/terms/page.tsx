"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsCard, SettingsPageShell } from "../../components/settings/SettingsPrimitives";
import { supabase } from "../../../../lib/supabaseClient";

type TermsRow = {
  terms_version: string | null;
  accepted: boolean | null;
  accepted_at: string | null;
  updated_at: string | null;
};

export default function TermsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [row, setRow] = useState<TermsRow | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        router.replace("/signin");
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

  return (
    <SettingsPageShell
      title="Terms and Conditions"
      subtitle="Review the currently accepted terms version and acceptance timestamp for your account."
    >
      <SettingsCard title="Terms status" description="Terms acceptance is required for account use.">
        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div><strong>Version:</strong> {row?.terms_version || "Not accepted yet"}</div>
          <div><strong>Status:</strong> {row?.accepted ? "Accepted" : "Pending acceptance"}</div>
          <div><strong>Accepted at:</strong> {row?.accepted_at ? new Date(row.accepted_at).toLocaleString() : "Not available"}</div>
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Latest terms are reviewed during onboarding and can be re-reviewed when versions change.
        </div>
        {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      </SettingsCard>
    </SettingsPageShell>
  );
}
