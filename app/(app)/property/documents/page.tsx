"use client";

import DocumentsWorkspace from "../../../../components/documents/DocumentsWorkspace";

export default function PropertyDocumentsPage() {
  return (
    <DocumentsWorkspace
      title="Documents"
      subtitle="Property records"
      sectionFilter="property"
      showPageHeading
    />
  );
}
