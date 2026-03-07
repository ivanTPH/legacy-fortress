"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function DebtsPage() {
  return (
    <SectionWorkspace
      sectionKey="finances"
      categoryKey="debts"
      title="Finances · Debts"
      subtitle="Track loans, balances, repayment instructions, and supporting files."
      addLabel="Add debt record"
    />
  );
}

