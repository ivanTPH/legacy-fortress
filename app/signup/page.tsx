import { Suspense } from "react";
import SignUpPageClient from "./SignUpPageClient";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageClient />
    </Suspense>
  );
}
