import { Suspense } from "react";
import InvitationAcceptPageClient from "./InvitationAcceptPageClient";

export default function InvitationAcceptPage() {
  return (
    <Suspense fallback={null}>
      <InvitationAcceptPageClient />
    </Suspense>
  );
}
