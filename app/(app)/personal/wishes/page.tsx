"use client";

import SectionWorkspace from "../../../../components/sections/SectionWorkspace";

export default function PersonalWishesPage() {
  return (
    <SectionWorkspace
      sectionKey="personal"
      categoryKey="wishes"
      title="Personal · Wishes"
      subtitle="Record personal wishes and guidance for family, executors, and advisers."
      addLabel="Add wish"
    />
  );
}

