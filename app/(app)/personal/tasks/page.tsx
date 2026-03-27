"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function PersonalTasksPage() {
  return (
    <UniversalRecordWorkspace
      sectionId="tasks"
      sectionKey="personal"
      categoryKey="tasks"
      title="Personal · Tasks & Follow-up"
      subtitle="Track the practical follow-up that still matters: who needs to be called, which records need checking, and what would help someone act confidently later."
    />
  );
}
