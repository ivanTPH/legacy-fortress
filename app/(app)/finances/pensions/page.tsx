"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function PensionsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="pensions"
      title="Finances · Pensions"
      subtitle="Store pension references, providers, values, and notes."
    />
  );
}
