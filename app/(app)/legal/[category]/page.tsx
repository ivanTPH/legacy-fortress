"use client";

import { useParams } from "next/navigation";
import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { getLegalCategoryBySlug } from "../../../../lib/legalCategories";

export default function LegalCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = getLegalCategoryBySlug(params.category || "");

  if (!category) {
    return <div style={{ color: "#6b7280" }}>Unknown legal category.</div>;
  }

  return (
    <UniversalRecordWorkspace
      sectionKey="legal"
      categoryKey={category.slug}
      title={`Legal · ${category.label}`}
      subtitle={category.description}
    />
  );
}
