"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function PersonalTasksPage() {
  return (
    <UniversalRecordWorkspace
      sectionId="tasks"
      sectionKey="personal"
      categoryKey="tasks"
      title="Personal · Tasks & Action Tracking"
      subtitle="Track estate actions against canonical assets, beneficiaries, executors, and supporting documents."
    />
  );
}
