"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsCard, SettingsPageShell, StatusNote, primaryBtn } from "../../components/settings/SettingsPrimitives";
import { supabase } from "../../../../lib/supabaseClient";

export default function MarketingPreferencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [marketingAllowed, setMarketingAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      const { data } = await supabase
        .from("marketing_preferences")
        .select("marketing_opt_in")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (mounted && data) {
        setMarketingAllowed(Boolean((data as { marketing_opt_in?: boolean | null }).marketing_opt_in));
      }
      if (mounted) setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const save = async () => {
    setSaving(true);
    setStatus("");

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const { error } = await supabase.from("marketing_preferences").upsert(
      {
        user_id: userData.user.id,
        marketing_opt_in: marketingAllowed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    setStatus(error ? `❌ ${error.message}` : "✅ Marketing preference saved.");
  };

  return (
    <SettingsPageShell title="Marketing Preference" subtitle="Control whether product and campaign updates are sent to your account contacts.">
      <SettingsCard title="Marketing consent" description="You can update this at any time.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={marketingAllowed} onChange={(e) => setMarketingAllowed(e.target.checked)} />
          <span style={{ fontSize: 14 }}>Allow marketing emails and product offers</span>
        </label>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save preference"}
        </button>
        <StatusNote message={status} />
      </SettingsCard>
    </SettingsPageShell>
  );
}
