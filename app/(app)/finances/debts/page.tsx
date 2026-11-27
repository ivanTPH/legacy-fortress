"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function DebtsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="debts"
      title="Finances · Loans & mortgages"
      subtitle="Mortgages, loans, car finance and anything else you owe, with who it is owed to and what is left to pay."
    />
  );
}
