"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function PersonalSubscriptionsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="personal"
      categoryKey="subscriptions"
      title="Personal · Subscriptions"
      subtitle="Track recurring subscriptions with linked contacts, documents, and clean archive controls."
    />
  );
}
