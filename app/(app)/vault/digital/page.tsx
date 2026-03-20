"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { DIGITAL_WORKSPACE_CONFIG } from "../../../../lib/assets/workspaceCategoryConfig";

export default function DigitalVaultPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey={DIGITAL_WORKSPACE_CONFIG.sectionKey}
      categoryKey={DIGITAL_WORKSPACE_CONFIG.categoryKey}
      title={DIGITAL_WORKSPACE_CONFIG.title}
      subtitle={DIGITAL_WORKSPACE_CONFIG.subtitle}
    />
  );
}
