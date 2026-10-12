"use client";

import { Suspense } from "react";
import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { INVESTMENTS_WORKSPACE_CONFIG } from "../../../../lib/assets/workspaceCategoryConfig";

export default function InvestmentsPage() {
  return (
    <Suspense fallback={null}>
      <UniversalRecordWorkspace
        sectionKey={INVESTMENTS_WORKSPACE_CONFIG.sectionKey}
        categoryKey={INVESTMENTS_WORKSPACE_CONFIG.categoryKey}
        title={INVESTMENTS_WORKSPACE_CONFIG.title}
        subtitle={INVESTMENTS_WORKSPACE_CONFIG.subtitle}
      />
    </Suspense>
  );
}
