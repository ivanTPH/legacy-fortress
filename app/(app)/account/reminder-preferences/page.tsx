"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsCard, SettingsPageShell, StatusNote, inputStyle, primaryBtn } from "../../components/settings/SettingsPrimitives";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";

type ReminderPrefs = {
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  monthly_review_day: number;
  advance_notice_days: number;
};

const EMPTY: ReminderPrefs = {
  email_enabled: true,
  sms_enabled: false,
  in_app_enabled: true,
  monthly_review_day: 1,
  advance_notice_days: 7,
};

export default function ReminderPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [prefs, setPrefs] = useState<ReminderPrefs>(EMPTY);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      const { data } = await supabase
        .from("reminder_preferences")
        .select("email_enabled,sms_enabled,in_app_enabled,monthly_review_day,advance_notice_days")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (mounted && data) {
        const row = data as Partial<ReminderPrefs>;
        setPrefs({
          email_enabled: Boolean(row.email_enabled),
          sms_enabled: Boolean(row.sms_enabled),
          in_app_enabled: Boolean(row.in_app_enabled),
          monthly_review_day: Number(row.monthly_review_day ?? 1),
          advance_notice_days: Number(row.advance_notice_days ?? 7),
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
    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const { error } = await supabase.from("reminder_preferences").upsert(
      {
        user_id: userData.user.id,
        ...prefs,
        monthly_review_day: Math.min(28, Math.max(1, Number(prefs.monthly_review_day || 1))),
        advance_notice_days: Math.min(30, Math.max(1, Number(prefs.advance_notice_days || 7))),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    setStatus(error ? `❌ ${error.message}` : "✅ Reminder preferences saved.");
  };

  return (
    <SettingsPageShell
      title="Reminder Preferences"
      subtitle="Configure periodic reminders for profile updates, document checks, and estate record reviews."
    >
      <SettingsCard title="Reminder schedule" description="Choose where reminders are sent and how far in advance.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}
        <div className="lf-content-grid">
          <Toggle label="Email reminders" checked={prefs.email_enabled} onChange={(checked) => setPrefs({ ...prefs, email_enabled: checked })} />
          <Toggle label="SMS reminders" checked={prefs.sms_enabled} onChange={(checked) => setPrefs({ ...prefs, sms_enabled: checked })} />
          <Toggle label="In-app reminders" checked={prefs.in_app_enabled} onChange={(checked) => setPrefs({ ...prefs, in_app_enabled: checked })} />
        </div>

        <div className="lf-content-grid">
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>Monthly review day (1-28)</span>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={28}
              value={prefs.monthly_review_day}
              onChange={(e) => setPrefs({ ...prefs, monthly_review_day: Number(e.target.value) || 1 })}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>Advance notice days (1-30)</span>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={30}
              value={prefs.advance_notice_days}
              onChange={(e) => setPrefs({ ...prefs, advance_notice_days: Number(e.target.value) || 7 })}
            />
          </label>
        </div>

        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save reminder preferences"}
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

