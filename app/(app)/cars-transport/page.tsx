"use client";

import SectionWorkspace from "../../../components/sections/SectionWorkspace";

export default function CarsTransportPage() {
  return (
    <SectionWorkspace
      sectionKey="cars_transport"
      categoryKey="records"
      title="Cars & Transport"
      subtitle="Track vehicles, ownership details, finance, insurance, and key transport documentation."
      addLabel="Add transport record"
    />
  );
}

