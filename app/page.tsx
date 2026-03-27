import { Suspense } from "react";
import PublicAuthEntry from "../components/auth/PublicAuthEntry";

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <PublicAuthEntry initialMode="sign-in" />
    </Suspense>
  );
}
