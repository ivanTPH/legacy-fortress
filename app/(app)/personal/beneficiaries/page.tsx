"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function PersonalBeneficiariesPage() {
  return (
    <UniversalRecordWorkspace
      sectionId="beneficiaries"
      sectionKey="personal"
      categoryKey="beneficiaries"
      title="Personal · Beneficiaries"
      subtitle="Store beneficiary records with relationship details, share allocations, supporting notes, and linked documents."
    />
  );
}
