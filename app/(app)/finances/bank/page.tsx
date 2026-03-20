"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { BANK_WORKSPACE_CONFIG } from "../../../../lib/assets/workspaceCategoryConfig";

export default function FinancesBankPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey={BANK_WORKSPACE_CONFIG.sectionKey}
      categoryKey={BANK_WORKSPACE_CONFIG.categoryKey}
      title={BANK_WORKSPACE_CONFIG.title}
      subtitle={BANK_WORKSPACE_CONFIG.subtitle}
    />
  );
}
