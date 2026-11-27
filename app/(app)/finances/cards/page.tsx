"use client";

import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";

export default function CardsPage() {
  return (
    <UniversalRecordWorkspace
      sectionKey="finances"
      categoryKey="cards"
      title="Finances · Cards"
      subtitle="Credit and debit cards, loyalty points, discount memberships and gift cards. Never the full card number."
    />
  );
}
