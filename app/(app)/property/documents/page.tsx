"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function PropertyDocumentsPage() {
  return (
    <SectionWorkspace
      sectionKey="property"
      categoryKey="documents"
      title="Property · Documents"
      subtitle="Upload deeds, tenancy records, utility references, and insurance files."
      addLabel="Add property document record"
    />
  );
}

