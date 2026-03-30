"use client";

import AccessibilitySettingsCard from "../../../../components/accessibility/AccessibilitySettingsCard";
import { SettingsPageShell } from "../../components/settings/SettingsPrimitives";

export default function AccessibilityPage() {
  return (
    <SettingsPageShell
      title="Accessibility"
      subtitle="Keep text, contrast, spacing, guided help, and read-aloud preferences in the same account settings area as the rest of your account controls."
    >
      <AccessibilitySettingsCard />
    </SettingsPageShell>
  );
}
