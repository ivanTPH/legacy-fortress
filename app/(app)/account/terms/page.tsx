import { Suspense } from "react";
import TermsPageClient from "./TermsPageClient";

export default function TermsPage() {
  return (
    <Suspense fallback={null}>
      <TermsPageClient />
    </Suspense>
  );
}
