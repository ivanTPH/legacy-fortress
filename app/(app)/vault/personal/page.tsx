"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function PersonalPossessionsPage() {
  return (
    <UniversalRecordWorkspace
      sectionId="possessions"
      sectionKey="personal"
      categoryKey="possessions"
      variant="possessions"
      title="Personal · Possessions"
      subtitle="Capture personal possessions with values, references, locations, attachments, and photos."
    />
  );
}
