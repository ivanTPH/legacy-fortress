"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function InsurancePage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="insurance"
      title="Finances · Insurance"
      subtitle="Record policy providers, policy references, and claim guidance."
    />
  );
}
