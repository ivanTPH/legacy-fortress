"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function PersonalSubscriptionsPage() {
  return (
    <SectionWorkspace
      sectionKey="personal"
      categoryKey="subscriptions"
      title="Personal · Subscriptions"
      subtitle="Track subscriptions, providers, renewal dates, and cancellation guidance."
      addLabel="Add subscription"
    />
  );
}

