"use client";

import { useParams } from "next/navigation";
import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { assetMatchesLegalCategory, getLegalCategoryBySlug, usesCanonicalLegalAssetRead } from "../../../../lib/legalCategories";

export default function LegalCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = getLegalCategoryBySlug(params.category || "");

  if (!category) {
    return <div style={{ color: "#6b7280" }}>Unknown legal category.</div>;
  }

  if (category.slug === "wills") {
    return (
      <UniversalRecordWorkspace
        sectionKey="personal"
        categoryKey="executors"
        title={`Legal · ${category.label}`}
        subtitle={category.description}
        recordFilter={(row) => assetMatchesLegalCategory(row, "wills")}
      />
    );
  }

  if (usesCanonicalLegalAssetRead(category.slug)) {
    return (
      <UniversalRecordWorkspace
        sectionKey="legal"
        categoryKey={category.slug}
        title={`Legal · ${category.label}`}
        subtitle={category.description}
        forceCanonicalRead
        recordFilter={(row) => assetMatchesLegalCategory(row, category.slug)}
      />
    );
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
