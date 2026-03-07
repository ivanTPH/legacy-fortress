"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function InvestmentsPage() {
  return (
    <SectionWorkspace
      sectionKey="finances"
      categoryKey="investments"
      title="Finances · Investments"
      subtitle="Track investments, premiums, certificates, and portfolio details."
      addLabel="Add investment record"
    />
  );
}

