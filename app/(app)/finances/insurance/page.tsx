"use client";

import { Suspense } from "react";
import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function InsurancePage() {
  return (
    <Suspense fallback={null}>
      <UniversalRecordWorkspace
        sectionKey="finances"
        categoryKey="insurance"
        title="Finances · Insurance"
        subtitle="Record policy providers, policy references, and claim guidance."
      />
    </Suspense>
  );
}
