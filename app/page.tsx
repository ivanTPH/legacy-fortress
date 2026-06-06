import { Suspense } from "react";
import PublicHomeEntry from "../components/auth/PublicHomeEntry";

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <PublicHomeEntry />
    </Suspense>
  );
}
