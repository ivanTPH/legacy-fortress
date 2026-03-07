"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsCard, SettingsPageShell, StatusNote, primaryBtn } from "../../components/settings/SettingsPrimitives";
import { supabase } from "../../../../lib/supabaseClient";

type Comms = {
  sms_enabled: boolean;
  phone_enabled: boolean;
  email_enabled: boolean;
  letter_enabled: boolean;
};

const EMPTY: Comms = {
  sms_enabled: true,
  phone_enabled: false,
  email_enabled: true,
  letter_enabled: false,
};

export default function CommunicationsPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [comms, setComms] = useState<Comms>(EMPTY);

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
        .from("communication_preferences")
        .select("sms_enabled,phone_enabled,email_enabled,letter_enabled")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (mounted && data) {
        const row = data as Partial<Comms>;
        setComms({
          sms_enabled: Boolean(row.sms_enabled),
          phone_enabled: Boolean(row.phone_enabled),
          email_enabled: Boolean(row.email_enabled),
          letter_enabled: Boolean(row.letter_enabled),
        });
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

    const { error } = await supabase.from("communication_preferences").upsert(
      {
        user_id: userData.user.id,
        ...comms,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    setStatus(error ? `❌ ${error.message}` : "✅ Communication preferences saved.");
  };

  return (
    <SettingsPageShell
      title="Communications Preferences"
      subtitle="Choose the channels allowed for account, security, and estate lifecycle communication."
    >
      <SettingsCard title="Allowed channels" description="Toggle channels on or off as needed.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

        <div className="lf-content-grid">
          <Toggle label="Text (SMS)" checked={comms.sms_enabled} onChange={(checked) => setComms({ ...comms, sms_enabled: checked })} />
          <Toggle label="Phone call" checked={comms.phone_enabled} onChange={(checked) => setComms({ ...comms, phone_enabled: checked })} />
          <Toggle label="Email" checked={comms.email_enabled} onChange={(checked) => setComms({ ...comms, email_enabled: checked })} />
          <Toggle label="Letter" checked={comms.letter_enabled} onChange={(checked) => setComms({ ...comms, letter_enabled: checked })} />
        </div>

        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save communications"}
        </button>

        <StatusNote message={status} />
      </SettingsCard>
    </SettingsPageShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        background: "#fff",
      }}
    >
      <span style={{ fontSize: 14 }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
