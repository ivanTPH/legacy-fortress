"use client";

import UniversalRecordWorkspace from "../../../components/records/UniversalRecordWorkspace";

export default function TrustPage() {
  return (
    <UniversalRecordWorkspace
      sectionId="executors"
      sectionKey="personal"
      categoryKey="executors"
      title="Personal · Executors / Trusted Contacts"
      subtitle="Store executors and trusted contacts with authority, jurisdiction, supporting notes, and linked documents."
    />
  );
}
