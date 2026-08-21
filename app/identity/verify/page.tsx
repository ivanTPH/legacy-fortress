import { Suspense } from "react";
import IdentityVerificationPageClient from "./IdentityVerificationPageClient";

export default function IdentityVerificationPage() {
  return (
    <Suspense fallback={<main className="lf-auth"><section className="lf-auth-form-side">Preparing identity verification...</section></main>}>
      <IdentityVerificationPageClient />
    </Suspense>
  );
}
