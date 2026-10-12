"use client";

import { Suspense } from "react";
import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { PROPERTY_WORKSPACE_CONFIG } from "../../../../lib/assets/workspaceCategoryConfig";

export default function PropertyVaultPage() {
  return (
    <Suspense fallback={null}>
      <UniversalRecordWorkspace
        sectionKey={PROPERTY_WORKSPACE_CONFIG.sectionKey}
        categoryKey={PROPERTY_WORKSPACE_CONFIG.categoryKey}
        title={PROPERTY_WORKSPACE_CONFIG.title}
        subtitle={PROPERTY_WORKSPACE_CONFIG.subtitle}
      />
    </Suspense>
  );
}
