"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function DirectDebitsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="direct-debits"
      title="Finances · Direct debits"
      subtitle="Regular payments out of your accounts, who they go to, and what should happen to each one after your death."
    />
  );
}
