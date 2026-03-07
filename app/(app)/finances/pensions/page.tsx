"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function PensionsPage() {
  return (
    <SectionWorkspace
      sectionKey="finances"
      categoryKey="pensions"
      title="Finances · Pensions"
      subtitle="Store pension references, providers, values, and notes."
      addLabel="Add pension record"
    />
  );
}

