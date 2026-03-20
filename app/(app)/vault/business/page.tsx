"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { BUSINESS_WORKSPACE_CONFIG } from "../../../../lib/assets/workspaceCategoryConfig";

export default function BusinessVaultPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey={BUSINESS_WORKSPACE_CONFIG.sectionKey}
      categoryKey={BUSINESS_WORKSPACE_CONFIG.categoryKey}
      title={BUSINESS_WORKSPACE_CONFIG.title}
      subtitle={BUSINESS_WORKSPACE_CONFIG.subtitle}
    />
  );
}
