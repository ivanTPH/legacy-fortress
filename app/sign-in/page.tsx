import { Suspense } from "react";
import SignInPageClient from "./SignInPageClient";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageClient />
    </Suspense>
  );
}
