"use client";

import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import InfoTip from "../ui/InfoTip";
import { useAccessibilityPreferences } from "./AccessibilityPreferencesContext";
import { saveAccessibilityPreferences, type AccessibilityPreferences } from "../../lib/accessibilityPreferences";
import { supabase } from "../../lib/supabaseClient";
import { getSafeUserData } from "../../lib/auth/requireActiveUser";
import {
  SettingsCard,
  ghostBtn,
  gridStyle,
  primaryBtn,
} from "../../app/(app)/components/settings/SettingsPrimitives";
import { FormField, SelectInput } from "../forms/asset/AssetFormControls";

export default function AccessibilitySettingsCard() {
  const { preferences, setPreferences } = useAccessibilityPreferences();
  const [draft, setDraft] = useState<AccessibilityPreferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  async function save() {
    setSaving(true);
    setStatus("");

    try {
      const { data: userData, error } = await getSafeUserData(supabase);
      if (error || !userData.user) {
        setStatus("Sign in again to update accessibility preferences.");
        return;
      }

      const saved = await saveAccessibilityPreferences(supabase, userData.user.id, draft);
      setPreferences(saved);
      setDraft(saved);
      setStatus("Accessibility preferences saved.");
    } catch (saveError) {
      setStatus(`Could not save accessibility preferences: ${saveError instanceof Error ? saveError.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Accessibility"
      description="Set the reading and guidance preferences that make the workspace easier to use across navigation, cards, forms, contacts, support, and records."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Personal accessibility preferences</strong>
        <InfoTip
          label="Explain accessibility preferences"
          message="Choose larger text, stronger contrast, roomier spacing, read-aloud support, and a guided help mode. These settings apply across the signed-in workspace."
        />
      </div>
      <div style={gridStyle}>
        <FormField label="Text size" iconName="format_size">
          <SelectInput
            value={draft.textSize}
            onChange={(value) => setDraft((current) => ({ ...current, textSize: value as AccessibilityPreferences["textSize"] }))}
            options={[
              { value: "default", label: "Standard" },
              { value: "large", label: "Large" },
              { value: "xlarge", label: "Extra large" },
            ]}
            disabled={saving}
          />
        </FormField>
        <FormField label="Contrast mode" iconName="contrast">
          <SelectInput
            value={draft.contrastMode}
            onChange={(value) => setDraft((current) => ({ ...current, contrastMode: value as AccessibilityPreferences["contrastMode"] }))}
            options={[
              { value: "default", label: "Standard" },
              { value: "high", label: "High contrast" },
            ]}
            disabled={saving}
          />
        </FormField>
        <FormField label="Layout spacing" iconName="open_in_full">
          <SelectInput
            value={draft.spacingMode}
            onChange={(value) => setDraft((current) => ({ ...current, spacingMode: value as AccessibilityPreferences["spacingMode"] }))}
            options={[
              { value: "default", label: "Standard" },
              { value: "comfortable", label: "More space" },
            ]}
            disabled={saving}
          />
        </FormField>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={preferenceToggleStyle}>
          <input
            type="checkbox"
            checked={draft.helpWizardEnabled}
            onChange={(event) => setDraft((current) => ({ ...current, helpWizardEnabled: event.target.checked }))}
          />
          <span>
            <strong>Help wizard</strong>
            <span style={preferenceHelpStyle}>Show guided next-step hints in places like Support and contact access setup.</span>
          </span>
        </label>
        <label style={preferenceToggleStyle}>
          <input
            type="checkbox"
            checked={draft.readAloudEnabled}
            onChange={(event) => setDraft((current) => ({ ...current, readAloudEnabled: event.target.checked }))}
          />
          <span>
            <strong>Read aloud support</strong>
            <span style={preferenceHelpStyle}>Enable spoken guidance controls where read-aloud support is offered.</span>
          </span>
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
          <Icon name="save" size={16} />
          {saving ? "Saving..." : "Save accessibility preferences"}
        </button>
        <button type="button" style={ghostBtn} disabled={saving} onClick={() => setDraft(preferences)}>
          <Icon name="restart_alt" size={16} />
          Reset changes
        </button>
      </div>
      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
    </SettingsCard>
  );
}

const preferenceToggleStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
} as const;

const preferenceHelpStyle = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  marginTop: 4,
} as const;
