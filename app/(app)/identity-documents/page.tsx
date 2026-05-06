"use client";

import UniversalRecordWorkspace from "../../../components/records/UniversalRecordWorkspace";

export default function IdentityDocumentsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="legal"
      categoryKey="identity-documents"
      title="Identity Documents"
      subtitle="Keep passports, driving licences, and other proof-of-identity documents together in one place."
      forceCanonicalRead
    />
  );
}
