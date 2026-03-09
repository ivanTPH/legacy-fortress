"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function FinancesBankPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="bank"
      title="Finances · Bank"
      subtitle="Add and manage current and savings account records with documents in one place."
    />
  );
}
