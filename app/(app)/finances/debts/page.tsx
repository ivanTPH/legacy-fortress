"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function DebtsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="debts"
      title="Finances · Debts"
      subtitle="Track loans, balances, repayment instructions, and supporting files."
    />
  );
}
