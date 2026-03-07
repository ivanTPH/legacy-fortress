"use client";

import SectionWorkspace from "../../../components/sections/SectionWorkspace";

export default function EmploymentPage() {
  return (
    <SectionWorkspace
      sectionKey="employment"
      categoryKey="records"
      title="Employment"
      subtitle="Capture employment records, benefits, death-in-service details, and associated files."
      addLabel="Add employment record"
    />
  );
}

