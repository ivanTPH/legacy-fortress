"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function InsurancePage() {
  return (
    <SectionWorkspace
      sectionKey="finances"
      categoryKey="insurance"
      title="Finances · Insurance"
      subtitle="Record policy providers, policy references, and claim guidance."
      addLabel="Add insurance record"
    />
  );
}

