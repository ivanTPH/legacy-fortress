"use client";

import { useEffect, useState } from "react";
import Icon from "../../../../components/ui/Icon";
import { applyAppearancePreference, readAppearancePreference, saveAppearancePreference, type AppearancePreference } from "../../../../lib/appearancePreference";
import { SettingsPageShell } from "../../components/settings/SettingsPrimitives";

const OPTIONS: { value: AppearancePreference; label: string; description: string; icon: string }[] = [
  { value: "automatic", label: "Automatic", description: "Follow this device's appearance setting.", icon: "brightness_auto" },
  { value: "light", label: "Light", description: "Use a light background on this device.", icon: "light_mode" },
  { value: "dark", label: "Dark", description: "Use a dark background on this device.", icon: "dark_mode" },
];

export default function AppearancePage() {
  const [choice, setChoice] = useState<AppearancePreference>("automatic");
  useEffect(() => {
    const saved = readAppearancePreference();
    setChoice(saved);
    applyAppearancePreference(saved);
  }, []);

  return <SettingsPageShell title="Appearance" subtitle="Choose how your Vault looks on this device.">
    <fieldset className="lf-v52-appearance-options">
      <legend>Theme</legend>
      {OPTIONS.map((option) => <label key={option.value} className="lf-v52-appearance-row">
        <span className="lf-v52-settings-icon"><Icon name={option.icon} size={20} /></span>
        <span><strong>{option.label}</strong><small>{option.description}</small></span>
        <input type="radio" name="appearance" value={option.value} checked={choice === option.value} onChange={() => { setChoice(option.value); saveAppearancePreference(option.value); }} />
      </label>)}
    </fieldset>
    <p className="lf-v52-settings-hint">Your choice is saved on this device. Automatic follows your device settings.</p>
  </SettingsPageShell>;
}
